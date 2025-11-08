export interface LoginResponse {
	data: {
		token: string;
	};
}

export interface AttendanceDataSummaryResponse {
	data: {
		presentPerc: number;
		absentPerc: number;
	};
}

// ---------------- DAYWISE-ATTENDANCE-API-RESPONSE ----------------

export interface DaywiseReportProps {
	token: string;
	payload: {
		courseCompId: number;
		courseId: number;
		sessionId: number | null;
		studentId: number | string;
	};
}

export interface LectureListProps {
	planLecDate: string;
	dayName: string;
	timeSlot: string;
	attendance: "PRESENT" | "ADJUSTED" | "ABSENT";
}

export interface AttendanceApiResponse {
	data: {
		lectureList: LectureListProps[];
	}[];
}

export interface AttendanceResponse {
	data: {
		fullName: string;
		registrationNumber: string;
		rollNumber: string;
		sectionName: string;
		branchShortName: string;
		degreeName: string;
		semesterName: string;
		admissionBatchName: string;
		academicSessionName: string;
		attendanceCourseComponentInfoList: {
			courseName: string;
			courseCode: string;
			courseId: number; // Added for daywise attendance payload
			attendanceCourseComponentNameInfoList: {
				courseComponentId: number; // Added for daywise attendance payload
				numberOfExtraAttendance: number;
				componentName: string;
				numberOfPeriods: number;
				numberOfPresent: number;
				presentPercentage: number | null;
				presentPercentageWith: string;
			}[];
		}[];
	};
	message: string;
}

export interface Course {
	courseName: string;
	courseCode: string;
	attendanceCourseComponentNameInfoList: {
		numberOfExtraAttendance: number;
		componentName: string;
		numberOfPeriods: number;
		numberOfPresent: number;
		presentPercentage: number | null;
		presentPercentageWith: string;
	}[];
}

// --- Types for the 'What-if' Projection feature ---

export interface ScheduleEntry {
	id: string | null;
	start: string;
	end: string;
	title: string;
	courseName: string;
	courseCode: string;
	courseCompName: string;
	facultyName: string;
	lectureDate: string; // e.g., "10/01/2024"
	type: "CLASS" | "HOLIDAY";
}

export interface ScheduleResponse {
	data: ScheduleEntry[];
	message: string;
}
