import type {
	AttendanceComponentInfo,
	LectureListProps,
	StudentDetails,
} from "../types/response";
import { fetchStudentId } from "../types/utils";
import { fetchSubjectLectures } from "./checkup";

/**
 * Recomputes attendance from the lecture rows instead of trusting the
 * aggregates CyberVidya returns with the course list.
 *
 * The row list is the finest-grained data the ERP exposes, and it disagrees
 * with those aggregates often enough to matter: a subject with 39 PRESENT and
 * 2 ADJUSTED rows still reports numberOfPresent 41, while a subject whose
 * adjusted lectures were credited separately keeps them out of the same field
 * and out of the subject's percentage. Reading PRESENT/ADJUSTED rows and
 * dividing by the rows actually held gives one consistent answer for both.
 *
 * A lecture is counted as attended when it is marked PRESENT or ADJUSTED.
 * ABSENT rows are not. The result is written back onto numberOfPresent and
 * numberOfPeriods, so every existing view (course cards, the overall bar, the
 * projection maths) agrees without any new UI.
 */

const MAX_CONCURRENT_SUBJECTS = 4;

/** Collapses duplicate rows for the same day and slot. */
function uniqueRows(lectures: LectureListProps[]): LectureListProps[] {
	const seen = new Map<string, LectureListProps>();
	for (const lecture of lectures) {
		seen.set(`${lecture.planLecDate}|${lecture.timeSlot}`, lecture);
	}
	return Array.from(seen.values());
}

export interface RowAttendance {
	/** Rows that count as attended: PRESENT and ADJUSTED. */
	attended: number;
	/** Rows the ERP has recorded for this subject. */
	held: number;
}

/**
 * Attended and held counts for one subject's row list.
 */
export function countRowAttendance(
	lectures: LectureListProps[],
): RowAttendance {
	const rows = uniqueRows(lectures);
	let attended = 0;
	for (const row of rows) {
		if (row.attendance === "PRESENT" || row.attendance === "ADJUSTED") {
			attended += 1;
		}
	}
	return { attended, held: rows.length };
}

function toFiniteCount(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

async function mapWithLimit<T, R>(
	items: T[],
	limit: number,
	run: (item: T) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	let nextIndex = 0;

	const worker = async () => {
		while (nextIndex < items.length) {
			const index = nextIndex;
			nextIndex += 1;
			results[index] = await run(items[index]);
		}
	};

	const workers = Math.min(limit, items.length);
	await Promise.all(Array.from({ length: workers }, worker));
	return results;
}

async function reconcileComponent(
	lecturesByComponent: Map<number, LectureListProps[] | null>,
	component: AttendanceComponentInfo,
): Promise<AttendanceComponentInfo> {
	const base: AttendanceComponentInfo = {
		...component,
		numberOfExtraAttendance: toFiniteCount(component.numberOfExtraAttendance),
	};

	const lectures = lecturesByComponent.get(component.courseComponentId);
	if (!lectures || lectures.length === 0) return base;

	const { attended, held } = countRowAttendance(lectures);
	if (held === 0) return base;

	// Never shrink the denominator below what the ERP has already charged the
	// student for: rows can lag behind the scheduled count while a lecture is
	// still being recorded.
	const periods = Math.max(toFiniteCount(component.numberOfPeriods), held);

	return {
		...base,
		numberOfPeriods: periods,
		numberOfPresent: Math.min(attended, periods),
		// Adjusted rows are already inside numberOfPresent now, so the old
		// separate allowance would double count them.
		numberOfExtraAttendance: 0,
	};
}

/**
 * Rewrites every subject's counts from its own lecture rows.
 *
 * Failures are swallowed per subject and leave that subject on the ERP's
 * numbers: a login should never break over this.
 */
export async function reconcileAttendanceFromRows(
	token: string,
	data: StudentDetails,
): Promise<StudentDetails> {
	let studentId: number | null = null;
	try {
		studentId = await fetchStudentId(token);
	} catch (error) {
		console.warn("Could not resolve student id for attendance rows", error);
	}
	if (!studentId || studentId <= 0) return data;

	const courses = data.attendanceCourseComponentInfoList ?? [];

	const components = courses.flatMap((course) =>
		course.attendanceCourseComponentNameInfoList.map((component) => ({
			courseId: course.courseId,
			component,
		})),
	);

	const lectureLists = await mapWithLimit(
		components,
		MAX_CONCURRENT_SUBJECTS,
		async ({ courseId, component }) => {
			const lectures = await fetchSubjectLectures(token, {
				courseId,
				courseCompId: component.courseComponentId,
				studentId,
			});
			return {
				courseComponentId: component.courseComponentId,
				lectures: Array.isArray(lectures) ? lectures : null,
			};
		},
	);

	const lecturesByComponent = new Map<number, LectureListProps[] | null>();
	for (const entry of lectureLists) {
		lecturesByComponent.set(entry.courseComponentId, entry.lectures);
	}

	const reconciled = await mapWithLimit(
		courses,
		MAX_CONCURRENT_SUBJECTS,
		async (course) => ({
			...course,
			attendanceCourseComponentNameInfoList: await Promise.all(
				course.attendanceCourseComponentNameInfoList.map((component) =>
					reconcileComponent(lecturesByComponent, component),
				),
			),
		}),
	);

	return {
		...data,
		attendanceCourseComponentInfoList: reconciled,
	};
}
