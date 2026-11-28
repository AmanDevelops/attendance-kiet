import type {
	AttendanceComponentInfo,
	LectureListProps,
} from "../types/response";

export interface RowAttendance {
	/** Slots with a PRESENT or ADJUSTED row. */
	attended: number;
	/** Distinct lecture slots the ERP returned. */
	held: number;
	/** Slots with at least one ADJUSTED row. */
	adjusted: number;
	/** Slots whose attendance value is not one of the three known statuses. */
	unknown: number;
}

export interface CachedCorrection {
	fingerprint: string;
	/** Fingerprint after applying this correction; lets reloads skip a fetch. */
	resultFingerprint?: string;
	stats: RowAttendance;
	expiresAt: number;
}

export type AttendanceStatus = "PRESENT" | "ADJUSTED" | "ABSENT";

export function toCount(value: unknown): number {
	const count = typeof value === "number" ? value : Number(value);
	return Number.isFinite(count) && count > 0 ? count : 0;
}

export function normalizeAttendanceStatus(
	value: unknown,
): AttendanceStatus | null {
	const status = String(value ?? "")
		.trim()
		.toUpperCase();
	if (status === "PRESENT" || status === "ADJUSTED" || status === "ABSENT") {
		return status;
	}
	return null;
}

/** "2026-11-10" or "10/11/2026" -> "2026-11-10"; other values are kept. */
export function normalizeLectureDate(value: unknown): string {
	const raw = String(value ?? "").trim();
	if (!raw) return "";
	const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
	const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (dmy) {
		return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
	}
	return raw.toLowerCase().replace(/\s+/g, " ");
}

/** First HH:MM in a free-text slot -> minute of day; other values are kept. */
export function normalizeTimeSlot(value: unknown): string {
	const raw = String(value ?? "").trim();
	if (!raw) return "";
	const match = raw.match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
	if (!match) return raw.toLowerCase().replace(/\s+/g, " ");

	let hours = Number.parseInt(match[1], 10);
	const minutes = Number.parseInt(match[2], 10);
	const meridiem = match[3]?.toUpperCase();
	if (hours > 23 || minutes > 59) {
		return raw.toLowerCase().replace(/\s+/g, " ");
	}

	if (meridiem === "PM" && hours < 12) {
		hours += 12;
	} else if (meridiem === "AM" && hours === 12) {
		hours = 0;
	} else if (!meridiem && hours >= 1 && hours <= 6) {
		// Same assumption as the checkup: 1-6 without AM/PM is afternoon.
		hours += 12;
	}

	return String(hours * 60 + minutes);
}

function lectureKey(row: LectureListProps, index: number): string {
	const date = normalizeLectureDate(row.planLecDate);
	const slot = normalizeTimeSlot(row.timeSlot);
	// Without both parts there is no safe way to tell a duplicate from a
	// genuinely separate lecture, so let each row stand on its own.
	if (!date || !slot) return `row:${index}`;
	return `${date}|${slot}`;
}

interface MergedRow {
	attended: boolean;
	adjusted: boolean;
	unknown: boolean;
}

/**
 * Collapses duplicate rows for the same day and slot.
 *
 * Duplicates are treated as corrections, not independent lectures: if any
 * copy is attended, the merged slot is attended. This makes the result
 * independent of the order the ERP returns the rows in. ADJUSTED is also
 * remembered separately so extra/special attendance can be de-duplicated
 * against the ERP's aggregate later.
 */
export function countRowAttendance(
	lectures: LectureListProps[],
): RowAttendance {
	const merged = new Map<string, MergedRow>();

	lectures.forEach((lecture, index) => {
		const status = normalizeAttendanceStatus(lecture.attendance);
		const candidate: MergedRow = {
			attended: status === "PRESENT" || status === "ADJUSTED",
			adjusted: status === "ADJUSTED",
			unknown: status === null,
		};
		const key = lectureKey(lecture, index);
		const existing = merged.get(key);

		if (!existing) {
			merged.set(key, candidate);
			return;
		}

		// A known status is always better than an unrecognized one.
		if (existing.unknown && !candidate.unknown) {
			merged.set(key, candidate);
			return;
		}
		if (candidate.unknown) return;

		existing.attended = existing.attended || candidate.attended;
		existing.adjusted = existing.adjusted || candidate.adjusted;
		existing.unknown = false;
	});

	let attended = 0;
	let adjusted = 0;
	let unknown = 0;
	for (const row of merged.values()) {
		if (row.unknown) {
			unknown += 1;
			continue;
		}
		if (row.attended) attended += 1;
		if (row.adjusted) adjusted += 1;
	}

	return { attended, held: merged.size, adjusted, unknown };
}

/**
 * Fingerprint of the ERP's own numbers. When these change, the cached row
 * correction is stale and the subject is worth re-checking.
 */
export function componentFingerprint(
	component: AttendanceComponentInfo,
): string {
	return [
		toCount(component.numberOfPeriods),
		toCount(component.numberOfPresent),
		toCount(component.numberOfExtraAttendance),
		component.presentPercentage ?? "null",
	].join("|");
}

export function needsRowFetch(
	component: AttendanceComponentInfo,
	entry: CachedCorrection | undefined,
	now = Date.now(),
): boolean {
	if (!entry) return true;
	if (entry.expiresAt <= now) return true;
	const fingerprint = componentFingerprint(component);
	// Accept either the raw ERP aggregate or the already-corrected result.
	// Callers that display cached corrections before scheduling should not
	// trigger a fresh sweep just because the numbers have already been fixed.
	return (
		entry.fingerprint !== fingerprint && entry.resultFingerprint !== fingerprint
	);
}

function withCounts(
	component: AttendanceComponentInfo,
	present: number,
	periods: number,
	extra: number,
): AttendanceComponentInfo {
	const percentage = periods > 0 ? (present / periods) * 100 : null;
	return {
		...component,
		numberOfPeriods: periods,
		numberOfPresent: present,
		numberOfExtraAttendance: extra,
		presentPercentage: percentage,
		presentPercentageWith:
			percentage === null ? "" : `${Math.round(percentage)}%`,
	};
}

/**
 * Reconciles one component's ERP aggregate with its daywise rows.
 *
 * The two sources disagree in both directions. The rules here are deliberately
 * conservative:
 *
 * - Rows only replace the aggregate when they cover at least as many slots as
 *   the ERP has already charged for. Partial row lists (or a lab row that
 *   stands for two periods) otherwise leave the ERP numerator in place, so the
 *   fix can never make a subject's percentage lower than it was before.
 * - Special/extra attendance is kept, but any ADJUSTED row is treated as the
 *   same credit. This preserves manual OD credit while avoiding the double
 *   count the old UI had when a subject already included adjusted rows in
 *   `numberOfPresent`.
 * - An unrecognized attendance status leaves the component untouched rather
 *   than silently counting it as absent.
 */
export function reconcileComponentWithRows(
	component: AttendanceComponentInfo,
	stats: RowAttendance,
): AttendanceComponentInfo {
	const erpPresent = toCount(component.numberOfPresent);
	const erpExtra = toCount(component.numberOfExtraAttendance);
	const erpPeriods = toCount(component.numberOfPeriods);
	const base = withCounts(component, erpPresent, erpPeriods, erpExtra);

	if (stats.held === 0 || stats.unknown > 0) return base;

	// ADJUSTED rows already represent the special credit. Keep only the part
	// of numberOfExtraAttendance that the rows do not account for.
	const remainingExtra = Math.max(0, erpExtra - stats.adjusted);
	const periods = Math.max(erpPeriods, stats.held);
	const rowTotal = stats.attended + remainingExtra;
	const rowsCoverErpPeriods = erpPeriods > 0 && stats.held >= erpPeriods;

	// If rows are complete, trust them even when they are lower than the
	// aggregate. If they are partial, never drop below what the ERP already
	// reported.
	const present = rowsCoverErpPeriods
		? rowTotal
		: Math.max(rowTotal, erpPresent + erpExtra);

	return withCounts(component, present, periods, 0);
}

export interface AttendanceProjection {
	status: "safe" | "warning";
	message: string;
}

export function resolveSubjectTarget(
	courseCode: string,
	subjectOverrides: Record<string, number> = {},
	globalCriteria: number = 75,
): number {
	const override = subjectOverrides[courseCode];
	if (typeof override === "number" && Number.isFinite(override)) {
		return Math.max(0, Math.min(100, Math.round(override)));
	}
	const fallback =
		typeof globalCriteria === "number" && Number.isFinite(globalCriteria)
			? globalCriteria
			: 75;
	return Math.max(0, Math.min(100, Math.round(fallback)));
}

export function calculateAttendanceProjection(
	present: number,
	total: number,
	targetPercentage: number = 75,
): AttendanceProjection {
	if (total === 0) {
		return { status: "safe", message: "No classes held yet." };
	}

	if (targetPercentage <= 0) {
		return {
			status: "safe",
			message:
				"You can miss all remaining classes without dropping below target",
		};
	}

	if (targetPercentage >= 100) {
		if (present < total) {
			return {
				status: "warning",
				message: "100% attendance is no longer mathematically achievable",
			};
		}
		return {
			status: "safe",
			message: "Try not to miss any more classes",
		};
	}

	const currentPercentage = (present / total) * 100;

	if (currentPercentage >= targetPercentage) {
		const target = targetPercentage / 100;
		const canMiss = Math.max(
			0,
			Math.floor((present - target * total) / target),
		);
		return {
			status: "safe",
			message:
				canMiss > 0
					? `You can miss ${canMiss} class${canMiss === 1 ? "" : "es"} only`
					: "Try not to miss any more classes",
		};
	}

	const target = targetPercentage / 100;
	const needToAttend = Math.max(
		1,
		Math.ceil((target * total - present) / (1 - target)),
	);
	return {
		status: "warning",
		message: `Need to attend next ${needToAttend} class${
			needToAttend === 1 ? "" : "es"
		}`,
	};
}
