import type { LectureListProps, StudentDetails } from "./response";

export type CheckupVerdict =
	| "present"
	| "absent"
	| "not-marked"
	| "upcoming"
	| "unknown";

/**
 * Distinguishes empty states so the UI can accurately reflect schedule status.
 */
export type CheckupStatus = "ok" | "no-classes";

export interface NormalizedClass {
	courseCode: string;
	courseName: string;
	courseCompName: string;
	dateKey: string;
	startMinutes: number;
	startLabel: string;
	endLabel: string;
}

export interface NormalizedLecture {
	dateKey: string;
	startMinutes: number | null;
	attendance: LectureListProps["attendance"];
	consumed: boolean;
}

export interface ResolvedSubject {
	courseId: number;
	courseComponentId: number;
	courseName: string;
	componentName: string;
	periodsHeld: number;
}

export interface CheckupEntry {
	courseCode: string;
	courseName: string;
	courseCompName: string;
	startTime: string;
	endTime: string;
	verdict: CheckupVerdict;
	reason?: string;
}

export interface CheckupCompleteness {
	recorded: number;
	expected: number;
}

export interface CheckupSubject {
	courseCode: string;
	courseName: string;
	courseCompName: string;
	entries: CheckupEntry[];
	error?: string;
	completeness?: CheckupCompleteness;
}

export interface CheckupSummary {
	present: number;
	absent: number;
	notMarked: number;
	upcoming: number;
	unknown: number;
}

export interface CheckupReport {
	date: string;
	status: CheckupStatus;
	subjects: CheckupSubject[];
	summary: CheckupSummary;
}

export interface CheckupParams {
	token: string;
	studentId: number;
	attendanceData: StudentDetails;
	now?: Date;
}
