import Cookies from "js-cookie";
import type { Dispatch, SetStateAction } from "react";
import { STUDENT_ID_COOKIE_NAME } from "../types/constants";
import type {
	AttendanceComponentInfo,
	CourseAttendanceInfo,
	StudentDetails,
} from "../types/response";
import { fetchStudentId } from "../types/utils";
import {
	type CachedCorrection,
	componentFingerprint,
	countRowAttendance,
	needsRowFetch,
	reconcileComponentWithRows,
	toCount,
} from "./attendanceMath";
import { fetchSubjectLectures } from "./checkup";

/**
 * Row corrections are cached per student/component and invalidated when the
 * ERP's own aggregate changes. This is what keeps a reload from turning into
 * another daywise sweep: a normal visit applies the cache and makes zero extra
 * requests. The TTL only exists to catch changes the aggregate does not
 * reveal (for example an adjusted row that leaves the totals untouched).
 */
const CORRECTION_CACHE_KEY = "kiet_attendance_row_corrections_v1";
const CORRECTION_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILED_FETCH_TTL_MS = 10 * 60 * 1000;
const UNKNOWN_STATUS_TTL_MS = 30 * 60 * 1000;
const START_DELAY_MS = 250;
const REQUEST_STAGGER_MS = 200;
const MAX_CONCURRENT_REQUESTS = 2;
const RUN_BUDGET_MS = 20_000;

type CorrectionCache = Record<string, CachedCorrection>;

interface ReconcileTask {
	courseId: number;
	component: AttendanceComponentInfo;
	cacheKey: string;
	fingerprint: string;
	bypassCache: boolean;
	priority: number;
}

interface ScheduleOptions {
	token: string;
	data: StudentDetails;
	studentId?: number | null;
	setAttendanceData: Dispatch<SetStateAction<StudentDetails | null>>;
}

let activeController: AbortController | null = null;

function registrationKey(data: StudentDetails): string {
	return String(data.registrationNumber ?? "")
		.trim()
		.toLowerCase();
}

function cacheEntryKey(
	registration: string,
	courseId: number,
	componentId: number,
): string {
	return `${registration}:${courseId}:${componentId}`;
}

function readCorrectionCache(): CorrectionCache {
	if (typeof window === "undefined") return {};
	try {
		const raw = localStorage.getItem(CORRECTION_CACHE_KEY);
		if (!raw) return {};
		const parsed: unknown = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return {};

		const now = Date.now();
		const cache: CorrectionCache = {};
		for (const [key, value] of Object.entries(
			parsed as Record<string, unknown>,
		)) {
			if (!value || typeof value !== "object") continue;
			const entry = value as Partial<CachedCorrection>;
			if (
				typeof entry.fingerprint !== "string" ||
				typeof entry.expiresAt !== "number" ||
				entry.expiresAt <= now ||
				!entry.stats
			) {
				continue;
			}
			const stats = entry.stats as Partial<CachedCorrection["stats"]>;
			if (
				typeof stats.attended !== "number" ||
				typeof stats.held !== "number" ||
				typeof stats.adjusted !== "number" ||
				typeof stats.unknown !== "number"
			) {
				continue;
			}
			cache[key] = {
				fingerprint: entry.fingerprint,
				resultFingerprint:
					typeof entry.resultFingerprint === "string"
						? entry.resultFingerprint
						: undefined,
				expiresAt: entry.expiresAt,
				stats: {
					attended: stats.attended,
					held: stats.held,
					adjusted: stats.adjusted,
					unknown: stats.unknown,
				},
			};
		}
		return cache;
	} catch {
		return {};
	}
}

function writeCorrectionCache(cache: CorrectionCache): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(CORRECTION_CACHE_KEY, JSON.stringify(cache));
	} catch {
		// Private mode/full storage must not break the dashboard.
	}
}

function sameCounts(
	left: AttendanceComponentInfo,
	right: AttendanceComponentInfo,
): boolean {
	return (
		left.numberOfPresent === right.numberOfPresent &&
		left.numberOfPeriods === right.numberOfPeriods &&
		left.numberOfExtraAttendance === right.numberOfExtraAttendance
	);
}

function reconcileCourseList(
	courses: CourseAttendanceInfo[],
	registration: string,
	corrections: Map<string, CachedCorrection>,
): { courses: CourseAttendanceInfo[]; changed: boolean } {
	let changed = false;

	const nextCourses = courses.map((course) => {
		const components = course.attendanceCourseComponentNameInfoList;
		if (!Array.isArray(components)) return course;

		let courseChanged = false;
		const nextComponents = components.map((component) => {
			if (!component || component.isProjected) return component;
			const entry = corrections.get(
				cacheEntryKey(
					registration,
					course.courseId,
					component.courseComponentId,
				),
			);
			if (!entry || entry.fingerprint !== componentFingerprint(component)) {
				return component;
			}

			const reconciled = reconcileComponentWithRows(component, entry.stats);
			if (sameCounts(component, reconciled)) return component;
			courseChanged = true;
			return reconciled;
		});

		if (!courseChanged) return course;
		changed = true;
		return {
			...course,
			attendanceCourseComponentNameInfoList: nextComponents,
		};
	});

	return { courses: changed ? nextCourses : courses, changed };
}

function applyCorrections(
	data: StudentDetails,
	corrections: Map<string, CachedCorrection>,
): StudentDetails {
	const registration = registrationKey(data);
	if (!registration || corrections.size === 0) return data;

	const { courses, changed } = reconcileCourseList(
		data.attendanceCourseComponentInfoList ?? [],
		registration,
		corrections,
	);
	if (!changed) return data;
	return {
		...data,
		attendanceCourseComponentInfoList: courses,
	};
}

/**
 * Applies any non-expired, fingerprint-matching correction synchronously.
 * This is the path a normal page load takes: no ERP daywise call at all.
 */
export function applyCachedAttendanceCorrections(
	data: StudentDetails,
): StudentDetails {
	const cache = readCorrectionCache();
	const entries = Object.entries(cache);
	if (entries.length === 0) return data;
	return applyCorrections(data, new Map(entries));
}

function applySingleCorrection(
	previous: StudentDetails | null,
	registration: string,
	courseId: number,
	componentId: number,
	entry: CachedCorrection,
): StudentDetails | null {
	if (!previous || registrationKey(previous) !== registration) return previous;

	let changed = false;
	const courses = previous.attendanceCourseComponentInfoList.map((course) => {
		if (course.courseId !== courseId) return course;
		const components = course.attendanceCourseComponentNameInfoList;
		if (!Array.isArray(components)) return course;

		let courseChanged = false;
		const nextComponents = components.map((component) => {
			if (
				component.courseComponentId !== componentId ||
				component.isProjected ||
				entry.fingerprint !== componentFingerprint(component)
			) {
				return component;
			}
			const reconciled = reconcileComponentWithRows(component, entry.stats);
			if (sameCounts(component, reconciled)) return component;
			courseChanged = true;
			return reconciled;
		});

		if (!courseChanged) return course;
		changed = true;
		return {
			...course,
			attendanceCourseComponentNameInfoList: nextComponents,
		};
	});

	if (!changed) return previous;
	return {
		...previous,
		attendanceCourseComponentInfoList: courses,
	};
}

function reconcilePriority(
	component: AttendanceComponentInfo,
	hasStaleEntry: boolean,
): number {
	const periods = toCount(component.numberOfPeriods);
	const present =
		toCount(component.numberOfPresent) +
		toCount(component.numberOfExtraAttendance);
	let priority = hasStaleEntry ? 1 : 0;
	if (toCount(component.numberOfExtraAttendance) > 0) priority += 4;
	if (
		periods > 0 &&
		typeof component.presentPercentage === "number" &&
		Math.abs(component.presentPercentage - (present / periods) * 100) > 1
	) {
		priority += 2;
	}
	return priority;
}

function collectTasks(
	data: StudentDetails,
	cache: CorrectionCache,
): { registration: string; tasks: ReconcileTask[] } {
	const registration = registrationKey(data);
	if (!registration) return { registration, tasks: [] };

	const tasks: ReconcileTask[] = [];
	for (const course of data.attendanceCourseComponentInfoList ?? []) {
		const components = course.attendanceCourseComponentNameInfoList;
		if (!Array.isArray(components)) continue;
		if (!course.courseId || course.courseId <= 0) continue;

		for (const component of components) {
			if (
				!component ||
				component.isProjected ||
				!component.courseComponentId ||
				component.courseComponentId <= 0
			) {
				continue;
			}

			// Nothing to correct when the ERP has no numbers at all for this
			// component; skip the request entirely.
			if (
				toCount(component.numberOfPeriods) === 0 &&
				toCount(component.numberOfPresent) === 0 &&
				toCount(component.numberOfExtraAttendance) === 0
			) {
				continue;
			}

			const cacheKey = cacheEntryKey(
				registration,
				course.courseId,
				component.courseComponentId,
			);
			const entry = cache[cacheKey];
			if (!needsRowFetch(component, entry)) continue;

			tasks.push({
				courseId: course.courseId,
				component,
				cacheKey,
				fingerprint: componentFingerprint(component),
				bypassCache: Boolean(entry),
				priority: reconcilePriority(component, Boolean(entry)),
			});
		}
	}

	tasks.sort((left, right) => right.priority - left.priority);
	return { registration, tasks };
}

function readStudentIdCookie(): number | null {
	const raw = (Cookies.get(STUDENT_ID_COOKIE_NAME) || "")
		.replace(/^"|"$/g, "")
		.trim();
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function resolveStudentId(
	token: string,
	provided: number | null | undefined,
): Promise<number | null> {
	if (provided && Number.isFinite(provided) && provided > 0) return provided;
	const cookieId = readStudentIdCookie();
	if (cookieId) return cookieId;
	try {
		return await fetchStudentId(token, 8000);
	} catch {
		return null;
	}
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
	return new Promise((resolve) => {
		if (signal.aborted) {
			resolve();
			return;
		}
		const timer = setTimeout(() => {
			signal.removeEventListener("abort", onAbort);
			resolve();
		}, ms);
		const onAbort = () => {
			clearTimeout(timer);
			resolve();
		};
		signal.addEventListener("abort", onAbort, { once: true });
	});
}

async function mapWithLimit<T>(
	items: T[],
	limit: number,
	run: (item: T) => Promise<void>,
): Promise<void> {
	let nextIndex = 0;
	const worker = async () => {
		while (nextIndex < items.length) {
			const index = nextIndex;
			nextIndex += 1;
			await run(items[index]);
		}
	};
	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, worker),
	);
}

async function runReconciliation(
	options: ScheduleOptions,
	controller: AbortController,
): Promise<void> {
	await wait(START_DELAY_MS, controller.signal);
	if (controller.signal.aborted) return;

	const cache = readCorrectionCache();
	const { registration, tasks } = collectTasks(options.data, cache);
	if (tasks.length === 0 || controller.signal.aborted) return;

	const studentId = await resolveStudentId(options.token, options.studentId);
	if (!studentId || controller.signal.aborted) return;

	const startedAt = Date.now();

	await mapWithLimit(tasks, MAX_CONCURRENT_REQUESTS, async (task) => {
		if (controller.signal.aborted) return;
		if (Date.now() - startedAt > RUN_BUDGET_MS) return;

		await wait(REQUEST_STAGGER_MS + Math.random() * 150, controller.signal);
		if (controller.signal.aborted) return;

		let stats: ReturnType<typeof countRowAttendance> | null = null;
		try {
			const result = await fetchSubjectLectures(
				options.token,
				{
					courseId: task.courseId,
					courseCompId: task.component.courseComponentId,
					studentId,
				},
				{
					signal: controller.signal,
					bypassCache: task.bypassCache,
				},
			);
			if (Array.isArray(result)) stats = countRowAttendance(result);
		} catch (error) {
			if (!controller.signal.aborted) {
				console.warn(
					"Attendance row reconciliation failed for component",
					task.component.courseComponentId,
					error,
				);
			}
		}

		if (controller.signal.aborted) return;

		const expiresAt =
			Date.now() +
			(stats === null
				? FAILED_FETCH_TTL_MS
				: stats.unknown > 0
					? UNKNOWN_STATUS_TTL_MS
					: CORRECTION_CACHE_TTL_MS);

		// Cache failures/unknown statuses briefly too. A broken subject should
		// not be retried on every reload while the upstream is struggling.
		const reconciled =
			stats && stats.held > 0 && stats.unknown === 0
				? reconcileComponentWithRows(task.component, stats)
				: null;
		const entry: CachedCorrection = {
			fingerprint: task.fingerprint,
			resultFingerprint: reconciled
				? componentFingerprint(reconciled)
				: undefined,
			expiresAt,
			stats: stats ?? { attended: 0, held: 0, adjusted: 0, unknown: 0 },
		};
		cache[task.cacheKey] = entry;
		writeCorrectionCache(cache);

		if (!stats || stats.held === 0 || stats.unknown > 0) return;

		options.setAttendanceData((previous) =>
			applySingleCorrection(
				previous,
				registration,
				task.courseId,
				task.component.courseComponentId,
				entry,
			),
		);
	});
}

/**
 * Starts a gentle background pass that corrects the ERP's aggregates from the
 * daywise rows.
 *
 * It deliberately does not block login. Only components whose cached
 * correction is missing, expired or tied to an older aggregate are fetched;
 * requests run two at a time with a small stagger and a hard time budget. A
 * normal reload therefore makes no daywise requests at all.
 */
export function scheduleAttendanceReconciliation(
	options: ScheduleOptions,
): void {
	const registration = registrationKey(options.data);
	if (!registration) return;

	cancelAttendanceReconciliation();
	const controller = new AbortController();
	activeController = controller;

	void runReconciliation(options, controller)
		.catch((error) => {
			if (!controller.signal.aborted) {
				console.warn("Attendance row reconciliation failed", error);
			}
		})
		.finally(() => {
			if (activeController === controller) activeController = null;
		});
}

/** Cancels any in-flight background pass, e.g. on logout or a user switch. */
export function cancelAttendanceReconciliation(): void {
	activeController?.abort();
	activeController = null;
}
