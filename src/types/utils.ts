import axios from "axios";
import { getBaseUrl, NON_WORKING_DAYS } from "./constants";

const NON_WORKING_DAY_SET = new Set(NON_WORKING_DAYS);

export function formatAuthHeader(token: string): string {
	if (!token) return "";
	const clean = token
		.replace(/^"|"$/g, "")
		.trim()
		.replace(/^(GlobalEducation\s*)+/i, "");
	return `GlobalEducation ${clean}`;
}

const STUDENT_ID_CACHE_TTL_MS = 5 * 60 * 1000;
let studentIdCache: {
	token: string;
	id: number;
	expiresAt: number;
} | null = null;
let studentIdInFlight: {
	token: string;
	promise: Promise<number | null>;
} | null = null;

export function clearStudentIdCache(): void {
	studentIdCache = null;
	studentIdInFlight = null;
}

export async function fetchStudentId(
	token: string,
	timeoutMs = 10000,
): Promise<number | null> {
	if (
		studentIdCache &&
		studentIdCache.token === token &&
		studentIdCache.expiresAt > Date.now()
	) {
		return studentIdCache.id;
	}
	if (studentIdInFlight?.token === token) {
		return studentIdInFlight.promise;
	}

	const promise = (async (): Promise<number | null> => {
		try {
			const response = await axios.get(
				`${getBaseUrl()}/api/student/dashboard/registered-courses`,
				{
					headers: { Authorization: formatAuthHeader(token) },
					timeout: timeoutMs,
				},
			);

			const rows = Array.isArray(response.data?.data) ? response.data.data : [];
			if (rows.length === 0) return null;

			const id = Number(rows[0]?.studentId);
			if (!Number.isFinite(id) || id <= 0) return null;

			studentIdCache = {
				token,
				id,
				expiresAt: Date.now() + STUDENT_ID_CACHE_TTL_MS,
			};
			return id;
		} catch (error) {
			console.error("Error fetching registered courses", error);
			return null;
		}
	})();

	studentIdInFlight = { token, promise };
	try {
		return await promise;
	} finally {
		if (studentIdInFlight?.promise === promise) {
			studentIdInFlight = null;
		}
	}
}

/** Local-time YYYY-MM-DD. Deliberately not toISOString, which shifts to UTC. */
export const toDateKey = (date: Date): string => {
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
};

/** "10/01/2024" or "2024-01-10" -> local Date. Returns null if malformed. */
export const parseScheduleDate = (lectureDate: string): Date | null => {
	if (!lectureDate) return null;
	const trimmed = lectureDate.trim();
	const dmy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
	if (dmy) {
		const day = Number.parseInt(dmy[1], 10);
		const month = Number.parseInt(dmy[2], 10);
		const year = Number.parseInt(dmy[3], 10);
		if (month < 1 || month > 12 || day < 1 || day > 31) return null;
		const date = new Date(year, month - 1, day);
		if (date.getDate() !== day || date.getMonth() !== month - 1) return null;
		return date;
	}
	const ymd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (ymd) {
		const year = Number.parseInt(ymd[1], 10);
		const month = Number.parseInt(ymd[2], 10);
		const day = Number.parseInt(ymd[3], 10);
		if (month < 1 || month > 12 || day < 1 || day > 31) return null;
		const date = new Date(year, month - 1, day);
		if (date.getDate() !== day || date.getMonth() !== month - 1) return null;
		return date;
	}
	return null;
};

export const isNonWorkingDayKey = (dateKey: string): boolean =>
	NON_WORKING_DAY_SET.has(dateKey);

export const isNonWorkingDayDate = (date: Date): boolean =>
	isNonWorkingDayKey(toDateKey(date));

/** Checks an ERP schedule entry, which may use either date format. */
export const isNonWorkingScheduleDate = (
	lectureDate?: string | null,
	start?: string | null,
): boolean => {
	const raw = lectureDate || start?.split(" ")[0] || "";
	const date = parseScheduleDate(raw);
	return date !== null && isNonWorkingDayDate(date);
};

export const formatNonWorkingDay = (dateKey: string): string => {
	const [year, month, day] = dateKey.split("-").map(Number);
	if (!year || !month || !day) return dateKey;
	return new Date(year, month - 1, day).toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
};

export function getWeekRange() {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dayOfWeek = today.getDay();

	const startDate = new Date(today);
	startDate.setDate(today.getDate() - dayOfWeek);

	const endDate = new Date(startDate);
	endDate.setDate(startDate.getDate() + 6);

	return {
		startDate: toDateKey(startDate),
		endDate: toDateKey(endDate),
	};
}
