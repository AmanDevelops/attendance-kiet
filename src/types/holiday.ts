export interface PlannedClass {
	id: string;
	dateKey: string; // YYYY-MM-DD
	courseName: string;
	courseCode: string;
	courseCompName: string;
	startTime: string; // Formatted e.g. "9:00 AM"
	endTime: string; // Formatted e.g. "9:55 AM"
	rawStart: string;
	rawEnd: string;
	dateLabel: string; // e.g. "Mon, Nov 4"
	isAbsent: boolean;
	markedInErp?: boolean;
	erpAttendance?: "PRESENT" | "ABSENT" | "ADJUSTED";
}

export interface SavedHoliday {
	id: string;
	name: string;
	startDate: string; // YYYY-MM-DD
	endDate: string; // YYYY-MM-DD
	applied: boolean;
	appliedCounts: Record<string, number>; // courseCode -> count
	classes: PlannedClass[];
	isGeneratedFromWeeklyTemplate?: boolean;
}
