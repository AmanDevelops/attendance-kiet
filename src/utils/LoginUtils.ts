import axios from "axios";
import CryptoJS from "crypto-js";
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
		const errorMessage =
			err instanceof Error
				? err.message
				: typeof err === "string"
					? err
					: JSON.stringify(err);
		throw new Error(`Failed to fetch attendance data: ${errorMessage}`);
	}
};

export function encryptPassword(plaintext: string) {
	const key = CryptoJS.enc.Base64.parse("NPdLWA5w7yFQhPeUuKmO/A==");
	const iv = CryptoJS.enc.Base64.parse("bV5V6nK4phvQG9ZhkAjugQ==");

	const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
		iv: iv,
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.Pkcs7,
	});

	return encrypted.toString();
}
