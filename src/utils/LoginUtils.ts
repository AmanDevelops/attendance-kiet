import axios from "axios";
import CryptoJS from "crypto-js";
import { getBaseUrl } from "../types/constants";
import type {
	StudentAttendanceApiResponse,
	StudentDetails,
} from "../types/response";
import { formatAuthHeader } from "../types/utils";
import { reconcileAttendanceFromRows } from "./attendance";

export const fetchAttendanceData = async (
	token: string,
): Promise<StudentDetails> => {
	try {
		const attendanceResponse = await axios.get<StudentAttendanceApiResponse>(
			`${getBaseUrl()}/api/attendance/course/component/student`,
			{
				headers: {
					Authorization: formatAuthHeader(token),
				},
			},
		);
		return await reconcileAttendanceFromRows(
			token,
			attendanceResponse.data.data,
		);
	} catch (err: unknown) {
		if (axios.isAxiosError(err)) {
			const status = err.response?.status;
			if (status === 401 || status === 403) {
				throw new Error("Session expired. Please login again.");
			}
		}
		throw new Error(
			"CyberVidya didn't return your attendance data. Please try again in a moment.",
		);
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
