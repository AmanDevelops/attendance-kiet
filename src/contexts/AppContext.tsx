import {
	createContext,
	type Dispatch,
	type SetStateAction,
	useContext,
} from "react";
import type { ScheduleEntry, StudentDetails } from "../types/response";

export type AttendanceDataContextType = {
	attendanceData: StudentDetails | null;
	setAttendanceData: Dispatch<SetStateAction<StudentDetails | null>>;
	scheduleData: ScheduleEntry[] | null;
	setScheduleData: Dispatch<SetStateAction<ScheduleEntry[] | null>>;
};

export const AttendanceDataContext = createContext<
	AttendanceDataContextType | undefined
>(undefined);

export const useAppContext = (): AttendanceDataContextType => {
	const context = useContext(AttendanceDataContext);
	if (context === undefined) {
		throw new Error("useAppContext must be used within an AppProvider");
	}
	return context;
};
