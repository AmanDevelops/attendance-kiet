import axios from "axios";
import type {
	StudentAttendanceApiResponse,
	StudentDetails,
} from "../types/response";

export const fetchAttendanceData = async (
	token: string,
): Promise<StudentDetails> => {
	try {
		const attendanceResponse = await axios.get<StudentAttendanceApiResponse>(
			"https://kiet.cybervidya.net/api/attendance/course/component/student",
			{
				headers: {
					Authorization: `GlobalEducation ${token}`,
				},
			},
		);
		return attendanceResponse.data.data;
	} catch (err: unknown) {
		if (axios.isAxiosError(err)) {
			if (err.response?.status === 401) {
				throw new Error("Session expired. Please login again.");
			}
		}
		throw new Error("Failed to fetch attendance data");
	}
};
