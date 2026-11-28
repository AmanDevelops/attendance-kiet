import assert from "node:assert/strict";
import { test } from "node:test";
import type {
	AttendanceComponentInfo,
	LectureListProps,
} from "../src/types/response.ts";
import {
	calculateAttendanceProjection,
	componentFingerprint,
	countRowAttendance,
	needsRowFetch,
	reconcileComponentWithRows,
	resolveSubjectTarget,
	toCount,
} from "../src/utils/attendanceMath.ts";

type Status = LectureListProps["attendance"];

function component(
	overrides: Partial<AttendanceComponentInfo> = {},
): AttendanceComponentInfo {
	return {
		courseComponentId: 1,
		numberOfExtraAttendance: 0,
		componentName: "Theory",
		numberOfPeriods: 0,
		numberOfPresent: 0,
		presentPercentage: null,
		presentPercentageWith: "",
		isProjected: false,
		...overrides,
	};
}

function dateAt(index: number): string {
	return new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10);
}

/** Builds rows with unique date/time slots in a predictable order. */
function rows(
	present: number,
	adjusted: number,
	absent: number,
): LectureListProps[] {
	const result: LectureListProps[] = [];
	let index = 0;
	const add = (attendance: Status, count: number) => {
		for (let i = 0; i < count; i++) {
			result.push({
				planLecDate: dateAt(index),
				dayName: "Monday",
				timeSlot: "09:00 - 10:00",
				attendance,
			});
			index += 1;
		}
	};
	add("PRESENT", present);
	add("ADJUSTED", adjusted);
	add("ABSENT", absent);
	return result;
}

function percentage(present: number, periods: number): number {
	return (present / periods) * 100;
}

test("toCount accepts numeric strings and rejects junk", () => {
	assert.equal(toCount("52"), 52);
	assert.equal(toCount(0), 0);
	assert.equal(toCount(-4), 0);
	assert.equal(toCount(Number.NaN), 0);
	assert.equal(toCount(undefined), 0);
	assert.equal(toCount("not a number"), 0);
});

test("IT311E: 52 PRESENT + 8 ADJUSTED + 10 ABSENT becomes 60/70", () => {
	const stats = countRowAttendance(rows(52, 8, 10));
	assert.deepEqual(stats, {
		attended: 60,
		held: 70,
		adjusted: 8,
		unknown: 0,
	});

	const result = reconcileComponentWithRows(
		component({ numberOfPeriods: 70, numberOfPresent: 52 }),
		stats,
	);
	assert.equal(result.numberOfPresent, 60);
	assert.equal(result.numberOfPeriods, 70);
	assert.equal(result.numberOfExtraAttendance, 0);
	assert.equal(
		result.presentPercentage?.toFixed(4),
		percentage(60, 70).toFixed(4),
	);
});

test("IT401B: 39 PRESENT + 2 ADJUSTED + 9 ABSENT stays 41/50", () => {
	const stats = countRowAttendance(rows(39, 2, 9));
	const result = reconcileComponentWithRows(
		component({ numberOfPeriods: 50, numberOfPresent: 41 }),
		stats,
	);
	assert.equal(result.numberOfPresent, 41);
	assert.equal(result.numberOfPeriods, 50);
	assert.equal(result.numberOfExtraAttendance, 0);
});

test("issue #13: 27 PRESENT + 4 ADJUSTED + 5 ABSENT preserves 86.1%", () => {
	const stats = countRowAttendance(rows(27, 4, 5));
	const result = reconcileComponentWithRows(
		component({
			numberOfPeriods: 36,
			numberOfPresent: 27,
			numberOfExtraAttendance: 4,
		}),
		stats,
	);
	assert.equal(result.numberOfPresent, 31);
	assert.equal(result.numberOfPeriods, 36);
	assert.equal(result.numberOfExtraAttendance, 0);
	assert.equal(
		result.presentPercentage?.toFixed(4),
		percentage(31, 36).toFixed(4),
	);
});

test("special extra not represented by ADJUSTED rows is preserved", () => {
	const stats = countRowAttendance(rows(27, 0, 9));
	assert.equal(stats.held, 36);
	const result = reconcileComponentWithRows(
		component({
			numberOfPeriods: 36,
			numberOfPresent: 27,
			numberOfExtraAttendance: 4,
		}),
		stats,
	);
	assert.equal(result.numberOfPresent, 31);
	assert.equal(result.numberOfExtraAttendance, 0);
});

test("redundant extra is not double-counted when ADJUSTED rows cover it", () => {
	const stats = countRowAttendance(rows(27, 2, 7));
	const result = reconcileComponentWithRows(
		component({
			numberOfPeriods: 36,
			numberOfPresent: 27,
			numberOfExtraAttendance: 4,
		}),
		stats,
	);
	// 29 attended rows + 2 extra that the adjusted rows did not explain = 31.
	assert.equal(result.numberOfPresent, 31);
	assert.equal(result.numberOfPeriods, 36);
});

test("partial rows never drop below the ERP present + extra", () => {
	const stats = countRowAttendance(rows(45, 0, 5));
	assert.equal(stats.held, 50);
	const result = reconcileComponentWithRows(
		component({ numberOfPeriods: 70, numberOfPresent: 52 }),
		stats,
	);
	assert.equal(result.numberOfPresent, 52);
	assert.equal(result.numberOfPeriods, 70);
});

test("partial rows with adjusted lectures still never lower the ERP number", () => {
	const stats = countRowAttendance(rows(40, 8, 2));
	assert.equal(stats.held, 50);
	const result = reconcileComponentWithRows(
		component({ numberOfPeriods: 70, numberOfPresent: 52 }),
		stats,
	);
	assert.equal(result.numberOfPresent, 52);
	assert.equal(result.numberOfPeriods, 70);
});

test("multi-period lab rows do not inflate or deflate the denominator", () => {
	// Ten lab rows each represent two periods, so `held` (10) is below the
	// ERP's 20 periods. The partial-row guard keeps the ERP aggregate intact.
	const stats = countRowAttendance(rows(10, 0, 0));
	const result = reconcileComponentWithRows(
		component({
			componentName: "Lab",
			numberOfPeriods: 20,
			numberOfPresent: 18,
		}),
		stats,
	);
	assert.equal(result.numberOfPresent, 18);
	assert.equal(result.numberOfPeriods, 20);
});

test("empty rows leave the ERP aggregate and extra attendance untouched", () => {
	const result = reconcileComponentWithRows(
		component({
			numberOfPeriods: 36,
			numberOfPresent: 27,
			numberOfExtraAttendance: 4,
		}),
		countRowAttendance([]),
	);
	assert.equal(result.numberOfPresent, 27);
	assert.equal(result.numberOfPeriods, 36);
	assert.equal(result.numberOfExtraAttendance, 4);
});

test("complete rows can raise a lower ERP aggregate", () => {
	const stats = countRowAttendance(rows(25, 0, 5));
	const result = reconcileComponentWithRows(
		component({ numberOfPeriods: 30, numberOfPresent: 20 }),
		stats,
	);
	assert.equal(result.numberOfPresent, 25);
	assert.equal(result.numberOfPeriods, 30);
});

test("duplicate rows merge order-independently with attended precedence", () => {
	const duplicate = (first: Status, second: Status) => [
		{
			planLecDate: "2026-02-10",
			dayName: "Tuesday",
			timeSlot: "09:00 - 10:00",
			attendance: first,
		},
		{
			planLecDate: "2026-02-10",
			dayName: "Tuesday",
			timeSlot: "09:00 - 10:00",
			attendance: second,
		},
	];

	const forward = countRowAttendance(duplicate("ABSENT", "PRESENT"));
	const reverse = countRowAttendance(duplicate("PRESENT", "ABSENT"));
	assert.deepEqual(forward, { attended: 1, held: 1, adjusted: 0, unknown: 0 });
	assert.deepEqual(reverse, forward);

	const adjusted = countRowAttendance(duplicate("PRESENT", "ADJUSTED"));
	assert.deepEqual(adjusted, { attended: 1, held: 1, adjusted: 1, unknown: 0 });
});

test("equivalent date and time formats deduplicate to one slot", () => {
	const stats = countRowAttendance([
		{
			planLecDate: "2026-01-05",
			dayName: "Monday",
			timeSlot: "09:00",
			attendance: "ABSENT",
		},
		{
			planLecDate: "05/01/2026",
			dayName: "Monday",
			timeSlot: "9:00 AM",
			attendance: "PRESENT",
		},
	]);
	assert.deepEqual(stats, { attended: 1, held: 1, adjusted: 0, unknown: 0 });
});

test("unrecognized statuses leave the ERP component unchanged", () => {
	const unknownRows = [
		...rows(1, 0, 0),
		{
			planLecDate: "2026-03-01",
			dayName: "Sunday",
			timeSlot: "11:00",
			attendance: "EXEMPT" as Status,
		},
	];
	const stats = countRowAttendance(unknownRows);
	assert.equal(stats.unknown, 1);

	const original = component({
		numberOfPeriods: 40,
		numberOfPresent: 30,
		numberOfExtraAttendance: 2,
	});
	const result = reconcileComponentWithRows(original, stats);
	assert.equal(result.numberOfPresent, 30);
	assert.equal(result.numberOfPeriods, 40);
	assert.equal(result.numberOfExtraAttendance, 2);
});

test("numeric-string aggregates are handled like numbers", () => {
	const stringComponent = {
		...component(),
		numberOfPeriods: "70",
		numberOfPresent: "52",
		numberOfExtraAttendance: "0",
	} as unknown as AttendanceComponentInfo;
	const result = reconcileComponentWithRows(
		stringComponent,
		countRowAttendance(rows(52, 8, 10)),
	);
	assert.equal(result.numberOfPresent, 60);
	assert.equal(result.numberOfPeriods, 70);
});

test("rows missing a date or slot are not collapsed together", () => {
	const missingDates = countRowAttendance([
		{
			planLecDate: "",
			dayName: "Monday",
			timeSlot: "09:00",
			attendance: "PRESENT",
		},
		{
			planLecDate: "",
			dayName: "Monday",
			timeSlot: "09:00",
			attendance: "ABSENT",
		},
	]);
	assert.equal(missingDates.held, 2);
	assert.equal(missingDates.attended, 1);

	const missingSlots = countRowAttendance([
		{
			planLecDate: "2026-02-10",
			dayName: "Tuesday",
			timeSlot: "",
			attendance: "PRESENT",
		},
		{
			planLecDate: "2026-02-10",
			dayName: "Tuesday",
			timeSlot: "",
			attendance: "PRESENT",
		},
	]);
	assert.equal(missingSlots.held, 2);
	assert.equal(missingSlots.attended, 2);
});

test("needsRowFetch skips fresh matching corrections and retries stale ones", () => {
	const current = component({ numberOfPeriods: 70, numberOfPresent: 52 });
	const corrected = reconcileComponentWithRows(current, {
		attended: 60,
		held: 70,
		adjusted: 8,
		unknown: 0,
	});
	const entry = {
		fingerprint: componentFingerprint(current),
		resultFingerprint: componentFingerprint(corrected),
		expiresAt: Date.now() + 60_000,
		stats: { attended: 60, held: 70, adjusted: 8, unknown: 0 },
	};

	assert.equal(needsRowFetch(current, undefined), true);
	assert.equal(needsRowFetch(current, entry), false);
	assert.equal(needsRowFetch(corrected, entry), false);
	assert.equal(
		needsRowFetch(current, { ...entry, expiresAt: Date.now() - 1 }),
		true,
	);
	assert.equal(
		needsRowFetch(
			component({ numberOfPeriods: 70, numberOfPresent: 53 }),
			entry,
		),
		true,
	);
});

test("calculateAttendanceProjection: 0 total classes returns safe and no classes message", () => {
	const proj = calculateAttendanceProjection(0, 0, 75);
	assert.equal(proj.status, "safe");
	assert.equal(proj.message, "No classes held yet.");
});

test("calculateAttendanceProjection: 0% target allows missing all remaining classes", () => {
	const proj = calculateAttendanceProjection(5, 10, 0);
	assert.equal(proj.status, "safe");
	assert.equal(
		proj.message,
		"You can miss all remaining classes without dropping below target",
	);
});

test("calculateAttendanceProjection: 100% target when present < total is impossible", () => {
	const proj = calculateAttendanceProjection(9, 10, 100);
	assert.equal(proj.status, "warning");
	assert.equal(
		proj.message,
		"100% attendance is no longer mathematically achievable",
	);
});

test("calculateAttendanceProjection: 100% target when present === total", () => {
	const proj = calculateAttendanceProjection(10, 10, 100);
	assert.equal(proj.status, "safe");
	assert.equal(proj.message, "Try not to miss any more classes");
});

test("calculateAttendanceProjection: target met calculates classes you can miss", () => {
	// 16 / 20 = 80%. Target 75%.
	// Can miss floor((16 - 0.75 * 20) / 0.75) = floor((16 - 15) / 0.75) = floor(1 / 0.75) = 1.
	const proj1 = calculateAttendanceProjection(16, 20, 75);
	assert.equal(proj1.status, "safe");
	assert.equal(proj1.message, "You can miss 1 class only");

	// 18 / 20 = 90%. Target 75%.
	// floor((18 - 15) / 0.75) = floor(3 / 0.75) = 4.
	const proj2 = calculateAttendanceProjection(18, 20, 75);
	assert.equal(proj2.status, "safe");
	assert.equal(proj2.message, "You can miss 4 classes only");

	// Exactly on target: 15 / 20 = 75%. Target 75%.
	const proj3 = calculateAttendanceProjection(15, 20, 75);
	assert.equal(proj3.status, "safe");
	assert.equal(proj3.message, "Try not to miss any more classes");
});

test("calculateAttendanceProjection: target not met calculates classes to attend", () => {
	// 14 / 20 = 70%. Target 75%.
	// Need to attend ceil((0.75 * 20 - 14) / (1 - 0.75)) = ceil(1 / 0.25) = 4.
	const proj = calculateAttendanceProjection(14, 20, 75);
	assert.equal(proj.status, "warning");
	assert.equal(proj.message, "Need to attend next 4 classes");
});

test("calculateAttendanceProjection: edge cases never yield NaN or Infinity", () => {
	for (let target = 0; target <= 100; target++) {
		for (const [present, total] of [
			[0, 0],
			[0, 10],
			[5, 10],
			[10, 10],
			[12, 10],
		]) {
			const proj = calculateAttendanceProjection(present, total, target);
			assert.ok(proj.message.length > 0);
			assert.ok(!proj.message.includes("NaN"));
			assert.ok(!proj.message.includes("Infinity"));
		}
	}
});

test("resolveSubjectTarget: returns override when present and globalCriteria when absent", () => {
	const overrides = { CS302B: 70, HS110L: 30 };

	// Overridden subjects
	assert.equal(resolveSubjectTarget("CS302B", overrides, 75), 70);
	assert.equal(resolveSubjectTarget("HS110L", overrides, 75), 30);

	// Non-overridden subjects fall back to globalCriteria
	assert.equal(resolveSubjectTarget("IT401B", overrides, 75), 75);
	assert.equal(resolveSubjectTarget("IT401B", overrides, 60), 60);

	// Updating globalCriteria updates non-overridden but leaves overridden intact
	const newGlobal = 85;
	assert.equal(resolveSubjectTarget("CS302B", overrides, newGlobal), 70);
	assert.equal(resolveSubjectTarget("IT401B", overrides, newGlobal), 85);
});

test("resolveSubjectTarget: clamps and handles edge values", () => {
	assert.equal(resolveSubjectTarget("A", { A: -10 }, 75), 0);
	assert.equal(resolveSubjectTarget("B", { B: 150 }, 75), 100);
	assert.equal(resolveSubjectTarget("C", { C: 0 }, 75), 0);
	assert.equal(resolveSubjectTarget("D", { D: 100 }, 75), 100);
});

test("per-subject projection calculation with custom overrides", () => {
	const overrides: Record<string, number> = { CS302B: 70 };
	const globalCriteria = 75;

	// Subject 1: CS302B with 14/20 classes.
	// At global 75%: 14/20 is 70% < 75%, need to attend 4 classes.
	// At custom 70%: 14/20 is 70% >= 70%, target met!
	const targetCS = resolveSubjectTarget("CS302B", overrides, globalCriteria);
	assert.equal(targetCS, 70);
	const projCS = calculateAttendanceProjection(14, 20, targetCS);
	assert.equal(projCS.status, "safe");
	assert.equal(projCS.message, "Try not to miss any more classes");

	// Subject 2: IT401B (non-overridden) with 14/20 classes.
	// Uses global 75%.
	const targetIT = resolveSubjectTarget("IT401B", overrides, globalCriteria);
	assert.equal(targetIT, 75);
	const projIT = calculateAttendanceProjection(14, 20, targetIT);
	assert.equal(projIT.status, "warning");
	assert.equal(projIT.message, "Need to attend next 4 classes");
});

test("resolveSubjectTarget: in-memory fresh session defaults all subjects to 75%", () => {
	const freshOverrides: Record<string, number> = {};
	const freshGlobalCriteria = 75;

	for (const code of ["CS302B", "HS110L", "IT401B", "MA101"]) {
		assert.equal(
			resolveSubjectTarget(code, freshOverrides, freshGlobalCriteria),
			75,
		);
	}
});
