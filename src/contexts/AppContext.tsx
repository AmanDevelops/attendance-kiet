import {
	createContext,
	type Dispatch,
	type SetStateAction,
	useContext,
} from "react";
import type { StudentDetails } from "../types/response";

export type AttendanceDataContextType = {
	attendanceData: StudentDetails | null;
	setAttendanceData: Dispatch<SetStateAction<StudentDetails | null>>;
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
