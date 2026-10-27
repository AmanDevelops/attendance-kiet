import axios from "axios";
import Cookies from "js-cookie";
import type {
	CheckupEntry,
	CheckupParams,
	CheckupReport,
	CheckupSubject,
	CheckupSummary,
	NormalizedClass,
	NormalizedLecture,
	ResolvedSubject,
} from "../types/checkup";
import { getBaseUrl, STUDENT_ID_COOKIE_NAME } from "../types/constants";
import type {
	AttendanceApiResponse,
	CourseAttendanceInfo,
	LectureListProps,
	ScheduleEntry,
	ScheduleResponse,
} from "../types/response";
import {
	formatAuthHeader,
	isNonWorkingDayKey,
	parseScheduleDate,
	toDateKey,
} from "../types/utils";

/**
 * Collapses whitespace and lowercases, so that "Data Structures " and
 * "data   structures" compare equal. ERP name fields are not
 * consistently cased or spaced between endpoints.
 */
export function normalizeName(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** "09:05" or "09:05:30" -> 545. Returns null if unparseable. */
export function toMinutesSinceMidnight(hhmm: string): number | null {
	const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
	if (!match) return null;
	const hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2], 10);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
}

/** "09:00:00" -> "9:00 AM". */
function toDisplayTime(hhmm: string): string {
	const minutes = toMinutesSinceMidnight(hhmm);
	if (minutes === null) return hhmm;
	const hours = Math.floor(minutes / 60);
	const mm = String(minutes % 60).padStart(2, "0");
	const suffix = hours >= 12 ? "PM" : "AM";
	const displayHour = hours % 12 || 12;
	return `${displayHour}:${mm} ${suffix}`;
}

/**
 * The schedule endpoint gives `start` as "YYYY-MM-DD HH:MM:SS" (or "DD/MM/YYYY HH:MM:SS")
 * and `lectureDate` as "DD/MM/YYYY". Returns null when either is unparseable.
 */
export function normalizeClass(entry: ScheduleEntry): NormalizedClass | null {
	const rawDate = entry.lectureDate || entry.start?.split(" ")[0] || "";
	const date = parseScheduleDate(rawDate);
	if (!date) return null;

	const dateKey = toDateKey(date);
	if (isNonWorkingDayKey(dateKey)) return null;

	const startRaw = entry.start?.split(" ")[1];
	const endRaw = entry.end?.split(" ")[1];
	if (!startRaw || !endRaw) return null;

	const startMinutes = toMinutesSinceMidnight(startRaw);
	const endMinutes = toMinutesSinceMidnight(endRaw);
	if (startMinutes === null || endMinutes === null) return null;

	return {
		courseCode: entry.courseCode,
		courseName: entry.courseName,
		courseCompName: entry.courseCompName,
		dateKey,
		startMinutes,
		startLabel: toDisplayTime(startRaw),
		endLabel: toDisplayTime(endRaw),
	};
}

/**
 * Removes duplicate schedule entries returned by the ERP for multi-batch courses.
 */
export function deduplicateClasses(
	classes: NormalizedClass[],
): NormalizedClass[] {
	const seen = new Set<string>();
	return classes.filter((cls) => {
		const key = `${cls.courseCode}-${cls.courseCompName}-${cls.dateKey}-${cls.startMinutes}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * Parses lecture date string to YYYY-MM-DD directly without letting Date()
 * shift days due to UTC timezone offsets.
 */
export function parseLectureDateKey(planLecDate: string): string | null {
	if (!planLecDate) return null;
	const trimmed = planLecDate.trim();
	const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (ymd) {
		return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
	}
	const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (dmy) {
		return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
	}
	const date = new Date(trimmed);
	if (Number.isNaN(date.getTime())) return null;
	return toDateKey(date);
}

/**
 * Normalizes daywise lecture entry with timezone-safe date extraction.
 */
export function normalizeLecture(
	lecture: LectureListProps,
): NormalizedLecture | null {
	const rawDate = lecture.planLecDate || "";
	const dateKey = parseLectureDateKey(rawDate);
	if (!dateKey) return null;

	return {
		dateKey,
		startMinutes: parseTimeSlotStart(lecture.timeSlot),
		attendance: lecture.attendance,
		consumed: false,
	};
}

/**
 * First HH:MM-like token in a free-text time slot, handling 12h/24h and AM/PM.
 */
export function parseTimeSlotStart(timeSlot: string): number | null {
	if (!timeSlot) return null;
	const match = timeSlot.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
	if (!match) return null;
	let hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2], 10);
	const meridiem = match[3]?.toUpperCase();

	if (hours > 23 || minutes > 59) return null;

	if (meridiem === "PM" && hours < 12) {
		hours += 12;
	} else if (meridiem === "AM" && hours === 12) {
		hours = 0;
	} else if (!meridiem && hours >= 1 && hours <= 6) {
		// In a standard college schedule, slots with hours 1-6 are afternoon classes (13:00-18:00)
		hours += 12;
	}

	return hours * 60 + minutes;
}

/**
 * Finds the course and component the daywise endpoint needs.
 *
 * Returns an `error` object rather than throwing, so an unresolvable subject
 * is reported alongside the rest of the report instead of failing the run.
 */
export function resolveSubject(
	courseCode: string,
	courseCompName: string,
	courses: CourseAttendanceInfo[],
	courseName?: string,
): ResolvedSubject | { error: string } {
	const targetCode = normalizeName(courseCode);
	let course = courses.find((c) => normalizeName(c.courseCode) === targetCode);
	if (!course && courseName) {
		const targetName = normalizeName(courseName);
		course = courses.find((c) => normalizeName(c.courseName) === targetName);
	}
	if (!course) {
		return { error: "subject not in your enrolled list" };
	}

	const wanted = normalizeName(courseCompName);
	const match = course.attendanceCourseComponentNameInfoList?.find(
		(component) => normalizeName(component.componentName) === wanted,
	);

	// Single-component courses have only one possible answer, so a name
	// mismatch is cosmetic rather than ambiguous. This keeps `unknown`
	// reserved for genuinely unresolvable data.
	const component =
		match ??
		(course.attendanceCourseComponentNameInfoList?.length === 1
			? course.attendanceCourseComponentNameInfoList[0]
			: undefined);

	if (!component) {
		return { error: "component not found in your enrolled list" };
	}

	if (!course.courseId || !component.courseComponentId) {
		return {
			error: "Invalid course or component identifier in your enrolled list",
		};
	}

	return {
		courseId: course.courseId,
		courseComponentId: component.courseComponentId,
		courseName: course.courseName,
		componentName: component.componentName,
		periodsHeld: component.numberOfPeriods,
	};
}

/**
 * Groups classes by the (courseCode, courseCompName) pair rather than by
 * courseCode alone, so a theory and a lab for the same subject never share
 * a single daywise response.
 */
export function groupBySubject(
	classes: NormalizedClass[],
): Map<string, NormalizedClass[]> {
	const groups = new Map<string, NormalizedClass[]>();
	for (const cls of classes) {
		const key = `${cls.courseCode}||${cls.courseCompName}`;
		const existing = groups.get(key);
		if (existing) {
			existing.push(cls);
		} else {
			groups.set(key, [cls]);
		}
	}
	return groups;
}

/**
 * Assigns a verdict to each class in a subject group.
 *
 * Match strategy, two-pass:
 *   1. exact - same date and same start time (claims exact matches first)
 *   2. loose - same date, consumed in chronological order for unmatched classes
 *
 * A class with no matching lecture is `not-marked` (or `upcoming` if yet to start).
 */
export function reconcileGroup(
	key: string,
	classes: NormalizedClass[],
	lectures: NormalizedLecture[],
	resolved: ResolvedSubject | null,
	resolveError: string | null,
	nowMinutes?: number,
): CheckupSubject {
	const [courseCode = "", courseCompName = ""] = key.split("||");
	const first = classes[0];
	const courseName = first?.courseName ?? "";

	if (!resolved || resolveError) {
		return {
			courseCode,
			courseName,
			courseCompName,
			entries: classes.map((cls) => ({
				courseCode: cls.courseCode,
				courseName: cls.courseName,
				courseCompName: cls.courseCompName,
				startTime: cls.startLabel,
				endTime: cls.endLabel,
				verdict: "unknown" as const,
				reason: resolveError ?? "subject could not be resolved",
			})),
			error: resolveError ?? undefined,
		};
	}

	// Unclaimed lectures bucketed by date, sorted by start time
	const poolByDate = new Map<string, NormalizedLecture[]>();
	for (const lecture of lectures) {
		if (lecture.consumed) continue;
		const bucket = poolByDate.get(lecture.dateKey);
		if (bucket) {
			bucket.push(lecture);
		} else {
			poolByDate.set(lecture.dateKey, [lecture]);
		}
	}
	for (const bucket of poolByDate.values()) {
		bucket.sort((a, b) => {
			const aStart = a.startMinutes ?? Number.MAX_SAFE_INTEGER;
			const bStart = b.startMinutes ?? Number.MAX_SAFE_INTEGER;
			return aStart - bStart;
		});
	}

	// Two-pass matching:
	// Pass 1: exact matches (same date & same start time)
	const matchedLectures = new Map<NormalizedClass, NormalizedLecture>();
	for (const cls of classes) {
		const pool = poolByDate.get(cls.dateKey) ?? [];
		const exact = pool.find(
			(l) => !l.consumed && l.startMinutes === cls.startMinutes,
		);
		if (exact) {
			exact.consumed = true;
			matchedLectures.set(cls, exact);
		}
	}

	// Pass 2: loose matches for remaining classes (same date, chronological order)
	for (const cls of classes) {
		if (matchedLectures.has(cls)) continue;
		const pool = poolByDate.get(cls.dateKey) ?? [];
		const loose = pool.find((l) => !l.consumed);
		if (loose) {
			loose.consumed = true;
			matchedLectures.set(cls, loose);
		}
	}

	const entries: CheckupEntry[] = classes.map((cls) => {
		const base = {
			courseCode: cls.courseCode,
			courseName: cls.courseName,
			courseCompName: cls.courseCompName,
			startTime: cls.startLabel,
			endTime: cls.endLabel,
		};

		const matched = matchedLectures.get(cls);
		if (!matched) {
			const isUpcoming =
				nowMinutes !== undefined && cls.startMinutes > nowMinutes;
			const verdict: CheckupEntry["verdict"] = isUpcoming
				? "upcoming"
				: "not-marked";
			return { ...base, verdict };
		}

		const verdict: CheckupEntry["verdict"] =
			matched.attendance === "ABSENT" ? "absent" : "present";
		return { ...base, verdict };
	});

	return {
		courseCode,
		courseName,
		courseCompName,
		entries,
		// Signal B: completeness proves whether unrecorded lectures exist in ERP
		completeness: {
			recorded: lectures.length,
			expected: resolved.periodsHeld,
		},
	};
}

const emptySummary = (): CheckupSummary => ({
	present: 0,
	absent: 0,
	notMarked: 0,
	upcoming: 0,
	unknown: 0,
});

/**
 * Today's timetable.
 */
async function fetchTodaysClasses(token: string, now: Date) {
	const dateKey = toDateKey(now);

	const response = await axios.get<ScheduleResponse>(
		`${getBaseUrl()}/api/student/schedule/class`,
		{
			params: {
				weekStartDate: dateKey,
				weekEndDate: dateKey,
			},
			headers: { Authorization: formatAuthHeader(token) },
		},
	);

	return response.data.data ?? [];
}

/**
 * One daywise call per subject. Failures are per-subject: the subject carries
 * an error and the rest of the report still renders.
 */
async function fetchSubjectLectures(
	token: string,
	payload: { courseCompId: number; courseId: number; studentId: number },
): Promise<LectureListProps[] | { error: string }> {
	if (
		!payload.studentId ||
		payload.studentId <= 0 ||
		Number.isNaN(payload.studentId) ||
		!payload.courseCompId ||
		payload.courseCompId <= 0 ||
		!payload.courseId ||
		payload.courseId <= 0
	) {
		console.warn("fetchSubjectLectures skipped due to invalid IDs:", payload);
		return { error: "Missing or invalid subject/student identifier." };
	}

	const authHeader = formatAuthHeader(token);
	const maxAttempts = 3;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			const response = await axios.post<AttendanceApiResponse>(
				`${getBaseUrl()}/api/attendance/schedule/student/course/attendance/percentage`,
				{
					courseCompId: payload.courseCompId,
					courseId: payload.courseId,
					sessionId: null,
					studentId: payload.studentId,
				},
				{
					headers: {
						"Content-Type": "application/json",
						Authorization: authHeader,
					},
					timeout: 15000,
				},
			);
			const buckets = response.data.data;
			if (!buckets || buckets.length === 0) return [];
			return buckets[0].lectureList ?? [];
		} catch (err) {
			const status = axios.isAxiosError(err) ? err.response?.status : undefined;
			// Only retry on network drops/timeouts or 5xx server errors. Never retry 4xx client errors (400, 401, 403, 404).
			const shouldRetry =
				attempt < maxAttempts - 1 && (!status || status >= 500);

			if (shouldRetry) {
				await new Promise((resolve) =>
					setTimeout(resolve, 400 * (attempt + 1)),
				);
				continue;
			}

			console.error(
				"fetchSubjectLectures failed for subject:",
				payload,
				"Status:",
				status,
				"Data:",
				axios.isAxiosError(err) ? err.response?.data : err,
			);

			const resData = axios.isAxiosError(err) ? err.response?.data : undefined;
			const serverMsg =
				resData?.error?.reason ??
				resData?.message ??
				(typeof resData?.error === "string" ? resData.error : undefined);

			if (resData?.error?.reason === "No data found") {
				// The studentId cookie was stale or invalid for this course. Clear it to force re-fetch.
				Cookies.remove(STUDENT_ID_COOKIE_NAME);
			}

			return {
				error:
					status === 401
						? "Session expired. Please log in again."
						: (serverMsg ?? "Could not load attendance for this subject."),
			};
		}
	}
	return { error: "Could not load attendance for this subject." };
}

/**
 * Runs the checkup for today's classes.
 */
export async function runCheckup({
	token,
	studentId,
	attendanceData,
	now = new Date(),
}: CheckupParams): Promise<CheckupReport> {
	const dateKey = toDateKey(now);
	const nowMinutes = now.getHours() * 60 + now.getMinutes();

	// Don't hit the ERP for a date the college has explicitly marked off.
	if (isNonWorkingDayKey(dateKey)) {
		return {
			date: dateKey,
			status: "no-classes",
			subjects: [],
			summary: emptySummary(),
		};
	}

	const rawClasses = await fetchTodaysClasses(token, now);
	const allClasses = deduplicateClasses(
		rawClasses
			.filter((entry) => entry.type === "CLASS")
			.map(normalizeClass)
			.filter((c): c is NormalizedClass => c !== null),
	);

	const todaysClasses = allClasses
		.filter((c) => c.dateKey === dateKey)
		.sort((a, b) => a.startMinutes - b.startMinutes);

	if (todaysClasses.length === 0) {
		return {
			date: dateKey,
			status: "no-classes",
			subjects: [],
			summary: emptySummary(),
		};
	}

	const courses: CourseAttendanceInfo[] =
		attendanceData.attendanceCourseComponentInfoList ?? [];

	const subjectGroups = Array.from(groupBySubject(todaysClasses).entries());

	// Process subject groups with controlled concurrency (2 at a time) to prevent
	// network dropped packets or rate limits from the proxy.
	const subjects: CheckupSubject[] = [];
	const chunkSize = 2;
	for (let i = 0; i < subjectGroups.length; i += chunkSize) {
		const chunk = subjectGroups.slice(i, i + chunkSize);
		const chunkResults = await Promise.all(
			chunk.map(async ([key, classes]) => {
				const sample = classes[0];
				const resolution = resolveSubject(
					sample.courseCode,
					sample.courseCompName,
					courses,
					sample.courseName,
				);

				if ("error" in resolution) {
					return reconcileGroup(
						key,
						classes,
						[],
						null,
						resolution.error,
						nowMinutes,
					);
				}

				const result = await fetchSubjectLectures(token, {
					courseCompId: resolution.courseComponentId,
					courseId: resolution.courseId,
					studentId,
				});

				if ("error" in result) {
					return reconcileGroup(
						key,
						classes,
						[],
						resolution,
						result.error,
						nowMinutes,
					);
				}

				const lectures = result
					.map(normalizeLecture)
					.filter((l): l is NormalizedLecture => l !== null);
				return reconcileGroup(
					key,
					classes,
					lectures,
					resolution,
					null,
					nowMinutes,
				);
			}),
		);
		subjects.push(...chunkResults);
	}

	const summary = emptySummary();
	const countKey: Record<CheckupEntry["verdict"], keyof CheckupSummary> = {
		present: "present",
		absent: "absent",
		"not-marked": "notMarked",
		upcoming: "upcoming",
		unknown: "unknown",
	};
	for (const subject of subjects) {
		for (const entry of subject.entries) {
			summary[countKey[entry.verdict]] += 1;
		}
	}

	return { date: dateKey, status: "ok", subjects, summary };
}
