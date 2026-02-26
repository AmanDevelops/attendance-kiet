import axios from "axios";
import Cookies from "js-cookie";
import { AUTH_COOKIE_NAME } from "../types/constants";

export interface ScheduleEntry {
	id: string | null;
	start: string;
	end: string;
	title: string;
	courseName: string;
	courseCode: string;
	courseCompName: string;
	facultyName: string;
	lectureDate: string | null;
	type: "CLASS" | "HOLIDAY";
}

export interface ScheduleResponse {
	data: ScheduleEntry[];
	message: string;
}

export async function exportSemesterICS() {
	const token = Cookies.get(AUTH_COOKIE_NAME);
	if (!token) throw new Error("Authentication token not found");

	// Fetch wide range (1 year ahead)
	const today = new Date();
	const oneYearLater = new Date();
	oneYearLater.setFullYear(today.getFullYear() + 1);

	const fullSchedule = await fetchFullSemesterSchedule(
		token,
		today,
		oneYearLater,
	);

	if (!fullSchedule.length) {
		throw new Error("No schedule data found.");
	}

	const semesterStart = getMinDate(fullSchedule);
	const semesterEnd = getMaxDate(fullSchedule);

	const finalSchedule = await fetchFullSemesterSchedule(
		token,
		semesterStart,
		semesterEnd,
	);

	const ics = generateICS(finalSchedule);
	downloadICS(ics);
}

async function fetchFullSemesterSchedule(
	token: string,
	semesterStart: Date,
	semesterEnd: Date,
): Promise<ScheduleEntry[]> {
	const weeks = getAllWeeks(semesterStart, semesterEnd);
	const allClasses: ScheduleEntry[] = [];

	for (const week of weeks) {
		const response = await axios.get<ScheduleResponse>(
			"https://kiet.cybervidya.net/api/student/schedule/class",
			{
				params: {
					weekStartDate: week.startDate,
					weekEndDate: week.endDate,
				},
				headers: {
					Authorization: `GlobalEducation ${token}`,
				},
			},
		);

		if (response.data?.data?.length) {
			allClasses.push(...response.data.data);
		}
	}

	return removeDuplicates(allClasses);
}

function getAllWeeks(start: Date, end: Date) {
	const weeks: { startDate: string; endDate: string }[] = [];
	const current = new Date(start);

	while (current <= end) {
		const weekStart = new Date(current);
		const weekEnd = new Date(current);
		weekEnd.setDate(weekStart.getDate() + 6);

		weeks.push({
			startDate: formatDate(weekStart),
			endDate: formatDate(weekEnd),
		});

		current.setDate(current.getDate() + 7);
	}

	return weeks;
}

function formatDate(date: Date) {
	return date.toISOString().split("T")[0];
}

function parseLectureDate(dateString: string | null): Date | null {
	if (!dateString) return null;

	const parts = dateString.split("/");
	if (parts.length !== 3) return null;

	const [day, month, year] = parts.map(Number);
	if (!day || !month || !year) return null;

	return new Date(year, month - 1, day);
}

function getMinDate(schedule: ScheduleEntry[]): Date {
	const validDates = schedule
		.filter((e) => e.type === "CLASS")
		.map((e) => parseLectureDate(e.lectureDate))
		.filter((d): d is Date => d !== null);

	if (!validDates.length) {
		throw new Error("No valid lecture dates found");
	}

	return new Date(Math.min(...validDates.map((d) => d.getTime())));
}

function getMaxDate(schedule: ScheduleEntry[]): Date {
	const validDates = schedule
		.filter((e) => e.type === "CLASS")
		.map((e) => parseLectureDate(e.lectureDate))
		.filter((d): d is Date => d !== null);

	if (!validDates.length) {
		throw new Error("No valid lecture dates found");
	}

	return new Date(Math.max(...validDates.map((d) => d.getTime())));
}

function removeDuplicates(schedule: ScheduleEntry[]) {
	const seen = new Set<string>();

	return schedule.filter((entry) => {
		if (!entry.lectureDate) return false;

		const key = `${entry.courseCode}-${entry.lectureDate}-${entry.start}`;
		if (seen.has(key)) return false;

		seen.add(key);
		return true;
	});
}

function toICSDateTime(dateString: string, time: string) {
	const [day, month, year] = dateString.split("/").map(Number);
	const [hours, minutes, seconds] = time.split(":");

	const date = new Date(
		year,
		month - 1,
		day,
		Number(hours),
		Number(minutes),
		Number(seconds || 0),
	);

	return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function generateICS(events: ScheduleEntry[]) {
	const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

	let ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kiet Attendance//Semester Timetable//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
`;

	for (const event of events) {
		if (event.type !== "CLASS") continue;
		if (!event.lectureDate) continue;

		const startTime = event.start?.split(" ")[1];
		const endTime = event.end?.split(" ")[1];

		if (!startTime || !endTime) continue;

		const dtStart = toICSDateTime(event.lectureDate, startTime);
		const dtEnd = toICSDateTime(event.lectureDate, endTime);

		ics += `BEGIN:VEVENT
UID:${event.courseCode}-${dtStart}@kietattendance
DTSTAMP:${now}
DTSTART:${dtStart}
DTEND:${dtEnd}
SUMMARY:${escapeICS(event.courseName)}
DESCRIPTION:Course Code: ${escapeICS(event.courseCode)}\\nFaculty: ${escapeICS(event.facultyName)}\\nComponent: ${escapeICS(event.courseCompName)}
END:VEVENT
`;
	}

	ics += `END:VCALENDAR`;
	return ics;
}

function escapeICS(text: string) {
	if (!text) return "";
	return text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\n/g, "\\n");
}

function downloadICS(content: string) {
	const blob = new Blob([content], {
		type: "text/calendar;charset=utf-8",
	});

	const url = window.URL.createObjectURL(blob);

	const a = document.createElement("a");
	a.href = url;
	a.download = "semester-timetable.ics";

	document.body.appendChild(a);
	a.click();
	a.remove();

	window.URL.revokeObjectURL(url);
}
