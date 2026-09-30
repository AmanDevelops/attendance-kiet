import type {
	LectureListProps,
	ScheduleEntry,
	StudentDetails,
} from "./response";

export type CheckupVerdict = "present" | "absent" | "not-marked" | "unknown";

/**
 * Distinguishes the three empty states so the UI never reports
 * "no classes today" when the truth is "none have finished yet".
 */
export type CheckupStatus = "ok" | "no-classes" | "none-finished";

export interface NormalizedClass {
	courseCode: string;
	courseName: string;
	courseCompName: string;
	dateKey: string;
	startMinutes: number;
	endMinutes: number;
	startLabel: string;
	endLabel: string;
	raw: ScheduleEntry;
}

export interface NormalizedLecture {
	dateKey: string;
	startMinutes: number | null;
	attendance: LectureListProps["attendance"];
	consumed: boolean;
	raw: LectureListProps;
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
