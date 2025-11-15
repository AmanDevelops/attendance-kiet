import {
	createContext,
	type Dispatch,
	type SetStateAction,
	useContext,
} from "react";
import type { AttendanceResponse } from "../types/response";

type AttendanceDataContextType = {
	attendanceData: AttendanceResponse | null;
	setAttendanceData: Dispatch<SetStateAction<AttendanceResponse | null>>;
};

export const AttendanceDataContext =
	createContext<AttendanceDataContextType | null>(null);

export function useAppContext() {
	const context = useContext(AttendanceDataContext);
	if (!context) {
		throw new Error("useAppContext must be used within an AppProvider");
	}
	return context;
}
