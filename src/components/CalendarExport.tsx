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
	classRoom: string;
}

export interface ScheduleResponse {
	data: ScheduleEntry[];
	message: string;
}

export async function exportSemesterICS() {
	const token = Cookies.get(AUTH_COOKIE_NAME);
	if (!token) throw new Error("Authentication token not found");

	const today = new Date();
	const oneYearLater = new Date();
	oneYearLater.setFullYear(today.getFullYear() + 1);

	const allSchedule = await fetchSchedule(token, today, oneYearLater);

	if (!allSchedule.length) {
		throw new Error("No schedule data found.");
	}

	const ics = generateICS(allSchedule);
	downloadICS(ics);
}

async function fetchSchedule(
	token: string,
	start: Date,
	end: Date,
): Promise<ScheduleEntry[]> {
	try {
		const res = await axios.get<ScheduleResponse>(
			"https://kiet.cybervidya.net/api/student/schedule/class",
			{
				params: {
					weekStartDate: formatDate(start),
					weekEndDate: formatDate(end),
				},
				headers: { Authorization: `GlobalEducation ${token}` },
			},
		);
		return removeDuplicates(res.data.data ?? []);
	} catch (err) {
		console.error("Failed to fetch schedule:", err);
		return [];
	}
}

function formatDate(date: Date) {
	return date.toISOString().split("T")[0];
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
	const [hours, minutes, seconds] = time.split(":").map(Number);
	const date = new Date(year, month - 1, day, hours, minutes, seconds || 0);
	return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function generateICS(events: ScheduleEntry[]) {
	const eol = "\r\n";

	const now = `${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;

	let ics = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Kiet Attendance//Semester Timetable//EN",
		"CALSCALE:GREGORIAN",
		"METHOD:PUBLISH",
		"",
	].join(eol);

	for (const event of events) {
		if (event.type !== "CLASS" || !event.lectureDate) continue;

		const startTime = event.start.split(" ").pop();
		const endTime = event.end.split(" ").pop();

		if (!startTime || !endTime) continue;

		const dtStart = toICSDateTime(event.lectureDate, startTime);
		const dtEnd = toICSDateTime(event.lectureDate, endTime);

		ics += [
			"BEGIN:VEVENT",
			`UID:${event.courseCode}-${event.courseCompName}-${dtStart}@kietattendance`,
			`DTSTAMP:${now}`,
			`DTSTART:${dtStart}`,
			`DTEND:${dtEnd}`,
			`LOCATION:${escapeICS(event.classRoom)}`,
			`SUMMARY:${escapeICS(event.courseName)}`,
			`DESCRIPTION:Course Code: ${escapeICS(event.courseCode)}\\nFaculty: ${escapeICS(event.facultyName)}\\nComponent: ${escapeICS(event.courseCompName)}`,
			"BEGIN:VALARM",
			"ACTION:DISPLAY",
			"DESCRIPTION:Reminder",
			"TRIGGER:-PT15M",
			"END:VALARM",
			"END:VEVENT",
			"",
		].join(eol);
	}

	ics += `END:VCALENDAR${eol}`;
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
	const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "semester-timetable.ics";
	document.body.appendChild(a);
	a.click();
	a.remove();
	window.URL.revokeObjectURL(url);
}
