import type { PlannedClass } from "../types/holiday";
import type { CourseAttendanceInfo, LectureListProps } from "../types/response";
import { toDateKey } from "../types/utils";
import {
	fetchSubjectLectures,
	normalizeLecture,
	parseTimeSlotStart,
	resolveSubject,
	toMinutesSinceMidnight,
} from "./checkup";

/**
 * Calculates projected absence counts by courseCode, excluding any classes
 * that have already been marked in the college ERP.
 */
export function calculateProjectedAbsenceCounts(
	classes: PlannedClass[],
): Record<string, number> {
	const counts: Record<string, number> = {};
	for (const c of classes) {
		if (c.isAbsent && !c.markedInErp) {
			counts[c.courseCode] = (counts[c.courseCode] || 0) + 1;
		}
	}
	return counts;
}

/**
 * Extracts start minutes since midnight for a planned class.
 */
export function getPlannedClassStartMinutes(c: PlannedClass): number | null {
	if (c.rawStart) {
		const timePart = c.rawStart.includes(" ")
			? c.rawStart.split(" ")[1]
			: c.rawStart;
		const parsed =
			parseTimeSlotStart(timePart) ?? toMinutesSinceMidnight(timePart);
		if (parsed !== null) return parsed;
	}
	if (c.startTime) {
		const parsed =
			parseTimeSlotStart(c.startTime) ?? toMinutesSinceMidnight(c.startTime);
		if (parsed !== null) return parsed;
	}
	return null;
}

export interface ReconcileHolidayParams {
	classes: PlannedClass[];
	courses: CourseAttendanceInfo[];
	token: string;
	studentId: number;
}

/**
 * Checks all past and current-day classes in a holiday schedule against real ERP
 * lectures to detect if attendance has already been recorded (e.g. absent/present).
 *
 * Classes that are already marked in ERP are updated with:
 *   - markedInErp = true
 *   - erpAttendance = "ABSENT" | "PRESENT" | "ADJUSTED"
 *
 * This ensures they are not counted twice when projections are calculated.
 */
export async function reconcileHolidayClasses({
	classes,
	courses,
	token,
	studentId,
}: ReconcileHolidayParams): Promise<PlannedClass[]> {
	if (!classes || classes.length === 0) return [];
	if (
		!courses ||
		courses.length === 0 ||
		!token ||
		!studentId ||
		studentId <= 0
	) {
		return classes;
	}

	const todayKey = toDateKey(new Date());

	// Classes that could possibly be marked (today or in the past)
	const eligibleClasses = classes.filter((c) => c.dateKey <= todayKey);
	if (eligibleClasses.length === 0) {
		// All classes are in the future; none can be marked in ERP yet
		return classes.map((c) => ({
			...c,
			markedInErp: false,
			erpAttendance: undefined,
		}));
	}

	// Group eligible classes by subject component: "courseCode||courseCompName"
	const groupMap = new Map<string, PlannedClass[]>();
	for (const c of eligibleClasses) {
		const key = `${c.courseCode}||${c.courseCompName}`;
		const list = groupMap.get(key) || [];
		list.push(c);
		groupMap.set(key, list);
	}

	const subjectGroups = Array.from(groupMap.entries());
	const matchedClassMap = new Map<
		string,
		{ markedInErp: boolean; erpAttendance?: LectureListProps["attendance"] }
	>();

	// Fetch lectures in chunks of 4 to avoid overwhelming upstream ERP
	const chunkSize = 4;
	for (let i = 0; i < subjectGroups.length; i += chunkSize) {
		const chunk = subjectGroups.slice(i, i + chunkSize);
		await Promise.all(
			chunk.map(async ([, groupClasses]) => {
				const sample = groupClasses[0];
				if (!sample) return;

				const resolution = resolveSubject(
					sample.courseCode,
					sample.courseCompName,
					courses,
					sample.courseName,
				);

				if ("error" in resolution) {
					// Cannot resolve subject in enrolled list; leave as is
					return;
				}

				const result = await fetchSubjectLectures(token, {
					courseCompId: resolution.courseComponentId,
					courseId: resolution.courseId,
					studentId,
				});

				if ("error" in result || !Array.isArray(result)) {
					// Failed to fetch lectures for this subject
					return;
				}

				// Normalize lectures and bucket by dateKey
				const normalizedLectures = result
					.map(normalizeLecture)
					.filter((l) => l !== null);

				const poolByDate = new Map<string, typeof normalizedLectures>();
				for (const lec of normalizedLectures) {
					const list = poolByDate.get(lec.dateKey) || [];
					list.push(lec);
					poolByDate.set(lec.dateKey, list);
				}

				// Two-pass matching for this subject's classes:
				// Pass 1: Exact date and start time match
				const classWithMinutes = groupClasses.map((cls) => ({
					cls,
					startMinutes: getPlannedClassStartMinutes(cls),
				}));

				for (const item of classWithMinutes) {
					const pool = poolByDate.get(item.cls.dateKey) ?? [];
					const exact = pool.find(
						(l) =>
							!l.consumed &&
							item.startMinutes !== null &&
							l.startMinutes === item.startMinutes,
					);
					if (exact) {
						exact.consumed = true;
						matchedClassMap.set(item.cls.id, {
							markedInErp: true,
							erpAttendance: exact.attendance,
						});
					}
				}

				// Pass 2: Loose date match for remaining unmatched classes
				for (const item of classWithMinutes) {
					if (matchedClassMap.has(item.cls.id)) continue;
					const pool = poolByDate.get(item.cls.dateKey) ?? [];
					const loose = pool.find((l) => !l.consumed);
					if (loose) {
						loose.consumed = true;
						matchedClassMap.set(item.cls.id, {
							markedInErp: true,
							erpAttendance: loose.attendance,
						});
					} else {
						// Checked with ERP, but no lecture record exists yet (not marked yet)
						matchedClassMap.set(item.cls.id, {
							markedInErp: false,
							erpAttendance: undefined,
						});
					}
				}
			}),
		);
	}

	// Produce updated classes list
	return classes.map((cls) => {
		if (cls.dateKey > todayKey) {
			// Future class: cannot be marked yet
			return {
				...cls,
				markedInErp: false,
				erpAttendance: undefined,
			};
		}

		const match = matchedClassMap.get(cls.id);
		if (match) {
			return {
				...cls,
				markedInErp: match.markedInErp,
				erpAttendance: match.erpAttendance,
			};
		}

		// If subject could not be fetched or errored, keep existing status or false
		return {
			...cls,
			markedInErp: cls.markedInErp ?? false,
			erpAttendance: cls.erpAttendance,
		};
	});
}
