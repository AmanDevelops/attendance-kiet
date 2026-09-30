import axios from "axios";
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
import { getBaseUrl } from "../types/constants";
import type {
	AttendanceApiResponse,
	CourseAttendanceInfo,
	LectureListProps,
	ScheduleEntry,
	ScheduleResponse,
} from "../types/response";

/**
 * Collapses whitespace and lowercases, so that "Data Structures " and
 * "data   structures" compare equal. ERP name fields are not
 * consistently cased or spaced between endpoints.
 */
export function normalizeName(name: string): string {
	return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Local-time YYYY-MM-DD. Deliberately not toISOString, which shifts to UTC. */
export function toDateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
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

/** "10/01/2024" -> local Date for 10 Jan 2024. Returns null if malformed. */
export function parseScheduleDate(lectureDate: string): Date | null {
	const parts = lectureDate.split("/").map((p) => Number.parseInt(p, 10));
	if (parts.length !== 3 || parts.some((p) => Number.isNaN(p))) return null;
	const [day, month, year] = parts;
	if (month < 1 || month > 12 || day < 1 || day > 31) return null;
	const date = new Date(year, month - 1, day);
	// Rejects overflow like 31/02, which would roll into the next month.
	if (date.getDate() !== day || date.getMonth() !== month - 1) return null;
	return date;
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
 * The schedule endpoint gives `start` as "YYYY-MM-DD HH:MM:SS" and
 * `lectureDate` as "DD/MM/YYYY". Returns null when either is unparseable.
 */
export function normalizeClass(entry: ScheduleEntry): NormalizedClass | null {
	const date = parseScheduleDate(entry.lectureDate ?? "");
	if (!date) return null;

	const startRaw = entry.start.split(" ")[1];
	const endRaw = entry.end.split(" ")[1];
	if (!startRaw || !endRaw) return null;

	const startMinutes = toMinutesSinceMidnight(startRaw);
	const endMinutes = toMinutesSinceMidnight(endRaw);
	if (startMinutes === null || endMinutes === null) return null;

	return {
		courseCode: entry.courseCode,
		courseName: entry.courseName,
		courseCompName: entry.courseCompName,
		dateKey: toDateKey(date),
		startMinutes,
		endMinutes,
		startLabel: toDisplayTime(startRaw),
		endLabel: toDisplayTime(endRaw),
		raw: entry,
	};
}

/**
 * `planLecDate` is fed straight into `new Date()` by the existing daywise
 * report, so it is treated the same way here. `timeSlot` is free text, so its
 * start time is best-effort: null when the first HH:MM-like token cannot be
 * read, which makes the caller fall back to date-only matching.
 */
export function normalizeLecture(
	lecture: LectureListProps,
): NormalizedLecture | null {
	const date = new Date(lecture.planLecDate);
	if (Number.isNaN(date.getTime())) return null;

	return {
		dateKey: toDateKey(date),
		startMinutes: parseTimeSlotStart(lecture.timeSlot),
		attendance: lecture.attendance,
		consumed: false,
		raw: lecture,
	};
}

/** First HH:MM-like token in a free-text time slot, or null. */
export function parseTimeSlotStart(timeSlot: string): number | null {
	if (!timeSlot) return null;
	const match = timeSlot.match(/(\d{1,2}):(\d{2})/);
	if (!match) return null;
	return toMinutesSinceMidnight(`${match[1]}:${match[2]}`);
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
): ResolvedSubject | { error: string } {
	const course = courses.find((c) => c.courseCode === courseCode);
	if (!course) {
		return { error: "subject not in your enrolled list" };
	}

	const wanted = normalizeName(courseCompName);
	const match = course.attendanceCourseComponentNameInfoList.find(
		(component) => normalizeName(component.componentName) === wanted,
	);

	// Single-component courses have only one possible answer, so a name
	// mismatch is cosmetic rather than ambiguous. This keeps `unknown`
	// reserved for genuinely unresolvable data.
	const component =
		match ??
		(course.attendanceCourseComponentNameInfoList.length === 1
			? course.attendanceCourseComponentNameInfoList[0]
			: undefined);

	if (!component) {
		return { error: "component not found in your enrolled list" };
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
 * Match strategy, most precise first:
 *   1. exact - same date and same start time
 *   2. loose - same date, consumed in chronological order. Used when the
 *              lecture's timeSlot could not be parsed
 *
 * A class with no matching lecture is `not-marked`. The ERP exposes no
 * "pending" flag, so absence of a record is the only available signal.
 */
export function reconcileGroup(
	key: string,
	classes: NormalizedClass[],
	lectures: NormalizedLecture[],
	resolved: ResolvedSubject | null,
	resolveError: string | null,
): CheckupSubject {
	const [courseCode = "", courseCompName = ""] = key.split("||");
	const first = classes[0];
	const courseName = first?.courseName ?? "";

	if (!resolved) {
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

	// Unclaimed lectures bucketed by date, so a class can only ever consume a
	// lecture from its own day. Sorted by start time so the loose match is
	// deterministic rather than dependent on ERP response order.
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

	const entries: CheckupEntry[] = classes.map((cls) => {
		const base = {
			courseCode: cls.courseCode,
			courseName: cls.courseName,
			courseCompName: cls.courseCompName,
			startTime: cls.startLabel,
			endTime: cls.endLabel,
		};

		const pool = poolByDate.get(cls.dateKey) ?? [];
		const exact = pool.find(
			(l) => !l.consumed && l.startMinutes === cls.startMinutes,
		);
		const loose = exact ?? pool.find((l) => !l.consumed);

		if (!loose) {
			return { ...base, verdict: "not-marked" as const };
		}

		loose.consumed = true;
		const verdict: CheckupEntry["verdict"] =
			loose.attendance === "ABSENT" ? "absent" : "present";
		return { ...base, verdict };
	});

	return {
		courseCode,
		courseName,
		courseCompName,
		entries,
		// Signal B: a short count proves unmarked lectures are genuinely
		// absent from the daywise response, and catches classes missing
		// from the schedule entirely.
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
	unknown: 0,
});

/**
 * Today's timetable. A failure here is fatal: without the schedule there is
 * nothing to check.
 */
async function fetchTodaysClasses(token: string, now: Date) {
	const start = new Date(now);
	start.setHours(0, 0, 0, 0);
	const end = new Date(now);
	end.setHours(23, 59, 59, 999);

	const response = await axios.get<ScheduleResponse>(
		`${getBaseUrl()}/api/student/schedule/class`,
		{
			params: {
				weekStartDate: toDateKey(start),
				weekEndDate: toDateKey(end),
			},
			headers: { Authorization: `GlobalEducation ${token}` },
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
					Authorization: `GlobalEducation ${token}`,
				},
			},
		);
		const buckets = response.data.data;
		if (!buckets || buckets.length === 0) return [];
		return buckets[0].lectureList ?? [];
	} catch (err) {
		const status = axios.isAxiosError(err) ? err.response?.status : undefined;
		return {
			error:
				status === 401
					? "Session expired. Please log in again."
					: "Could not load attendance for this subject.",
		};
	}
}

/**
 * Runs the checkup for today's classes that have already ended.
 *
 * Reads no cookies and imports no React, so it stays usable from a future
 * email job or scheduled Worker unchanged.
 */
export async function runCheckup({
	token,
	studentId,
	attendanceData,
	now = new Date(),
}: CheckupParams): Promise<CheckupReport> {
	const dateKey = toDateKey(now);
	const nowMinutes = now.getHours() * 60 + now.getMinutes();

	const rawClasses = await fetchTodaysClasses(token, now);
	const allClasses = rawClasses
		.filter((entry) => entry.type === "CLASS")
		.map(normalizeClass)
		.filter((c): c is NormalizedClass => c !== null);

	const todaysClasses = allClasses.filter((c) => c.dateKey === dateKey);

	// "Today so far": anything still running or yet to start is out of scope.
	const finished = todaysClasses
		.filter((c) => c.endMinutes <= nowMinutes)
		.sort((a, b) => a.startMinutes - b.startMinutes);

	// A free day and a day whose classes have not ended yet are different
	// states and must not be conflated.
	if (finished.length === 0) {
		return {
			date: dateKey,
			status: todaysClasses.length === 0 ? "no-classes" : "none-finished",
			subjects: [],
			summary: emptySummary(),
		};
	}

	const courses: CourseAttendanceInfo[] =
		attendanceData.attendanceCourseComponentInfoList ?? [];

	const subjects: CheckupSubject[] = [];
	for (const [key, classes] of groupBySubject(finished)) {
		const sample = classes[0];
		const resolution = resolveSubject(
			sample.courseCode,
			sample.courseCompName,
			courses,
		);

		if ("error" in resolution) {
			subjects.push(reconcileGroup(key, classes, [], null, resolution.error));
			continue;
		}

		const result = await fetchSubjectLectures(token, {
			courseCompId: resolution.courseComponentId,
			courseId: resolution.courseId,
			studentId,
		});

		if ("error" in result) {
			subjects.push({
				courseCode: sample.courseCode,
				courseName: sample.courseName,
				courseCompName: sample.courseCompName,
				entries: [],
				error: result.error,
			});
			continue;
		}

		const lectures = result
			.map(normalizeLecture)
			.filter((l): l is NormalizedLecture => l !== null);
		subjects.push(reconcileGroup(key, classes, lectures, resolution, null));
	}

	const summary = emptySummary();
	const countKey: Record<CheckupEntry["verdict"], keyof CheckupSummary> = {
		present: "present",
		absent: "absent",
		"not-marked": "notMarked",
		unknown: "unknown",
	};
	for (const subject of subjects) {
		for (const entry of subject.entries) {
			summary[countKey[entry.verdict]] += 1;
		}
	}

	return { date: dateKey, status: "ok", subjects, summary };
}
