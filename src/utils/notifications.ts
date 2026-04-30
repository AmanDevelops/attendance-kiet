import { TARGET_PERCENTAGE } from "../types/constants";
import type { StudentDetails } from "../types/response";

const SESSION_NOTIFY_PREFIX = "kiet-low-attendance:";
const ABSENT_DAYWISE_NOTIFY_PREFIX = "absent-";
const WHATSAPP_KEY_PREFIX = "kiet-whatsapp:";
const WHATSAPP_REGISTER_PREFIX = "kiet-whatsapp-registered:";
const notifierUrl = import.meta.env.VITE_NOTIFIER_URL?.trim() || "";

export function requestNotificationPermission(): void {
	if (typeof Notification === "undefined") return;
	if (Notification.permission === "default") {
		void Notification.requestPermission();
	}
}

function showFallbackAlert(title: string, message: string): void {
	if (typeof window === "undefined") return;
	window.alert(`${title}\n${message}`);
}

export async function showNotification(
	title: string,
	message: string,
): Promise<void> {
	if (typeof Notification === "undefined") {
		showFallbackAlert(title, message);
		return;
	}

	if (Notification.permission === "granted") {
		new Notification(title, { body: message });
		return;
	}

	if (Notification.permission === "default") {
		const permission = await Notification.requestPermission();
		if (permission === "granted") {
			new Notification(title, { body: message });
			return;
		}
	}

	showFallbackAlert(title, message);
}

export function notifyLowAttendanceIfNeeded(
	attendanceData: StudentDetails,
): void {
	for (const course of attendanceData.attendanceCourseComponentInfoList) {
		for (const component of course.attendanceCourseComponentNameInfoList) {
			const attended =
				component.numberOfPresent + component.numberOfExtraAttendance;
			const total = component.numberOfPeriods;
			if (total === 0) continue;

			const percentage = (attended / total) * 100;
			if (percentage >= TARGET_PERCENTAGE) continue;

			const sessionKey = `${SESSION_NOTIFY_PREFIX}${course.courseId}:${component.courseComponentId}`;
			if (sessionStorage.getItem(sessionKey)) continue;
			sessionStorage.setItem(sessionKey, "1");

			showNotification(
				"Low attendance",
				`${course.courseName} (${component.componentName}): ${percentage.toFixed(1)}%`,
			);
		}
	}
}

interface DaywiseAttendanceEntry {
	date: string;
	attendance: "PRESENT" | "ABSENT";
}

export function notifyIfAbsentFromDaywise(
	subjectName: string,
	componentName: string,
	daywiseData: DaywiseAttendanceEntry[],
): void {
	if (daywiseData.length === 0) return;

	const sortedDaywiseData = [...daywiseData].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
	const latestEntry = sortedDaywiseData[0];
	if (latestEntry.attendance !== "ABSENT") return;

	const sessionKey = `${ABSENT_DAYWISE_NOTIFY_PREFIX}${subjectName}-${componentName}-${latestEntry.date}`;
	if (sessionStorage.getItem(sessionKey)) return;
	sessionStorage.setItem(sessionKey, "1");

	showNotification(
		"Absent Marked 🚨",
		`${subjectName} (${componentName}) marked ABSENT on ${latestEntry.date}`,
	);
}

function getWhatsappStorageKey(registrationNumber: string): string {
	return `${WHATSAPP_KEY_PREFIX}${registrationNumber}`;
}

function getRegisterStorageKey(registrationNumber: string): string {
	return `${WHATSAPP_REGISTER_PREFIX}${registrationNumber}`;
}

function getAbsentCountBySubject(
	attendanceData: StudentDetails,
): Record<string, number> {
	const absentCounts: Record<string, number> = {};
	for (const course of attendanceData.attendanceCourseComponentInfoList) {
		let absentForCourse = 0;
		for (const component of course.attendanceCourseComponentNameInfoList) {
			const attended =
				component.numberOfPresent + component.numberOfExtraAttendance;
			const absent = Math.max(component.numberOfPeriods - attended, 0);
			absentForCourse += absent;
		}
		absentCounts[course.courseName] = absentForCourse;
	}
	return absentCounts;
}

export function getSavedWhatsappNumber(
	registrationNumber: string,
): string | null {
	const value = localStorage.getItem(getWhatsappStorageKey(registrationNumber));
	return value ? value : null;
}

export function saveWhatsappNumber(
	registrationNumber: string,
	number: string,
): void {
	localStorage.setItem(getWhatsappStorageKey(registrationNumber), number);
	sessionStorage.removeItem(getRegisterStorageKey(registrationNumber));
}

export async function syncAbsenceNotifier(
	attendanceData: StudentDetails,
): Promise<void> {
	if (!notifierUrl) return;

	const phone = getSavedWhatsappNumber(attendanceData.registrationNumber);
	if (!phone) return;

	const absentCounts = getAbsentCountBySubject(attendanceData);
	const registerKey = getRegisterStorageKey(attendanceData.registrationNumber);

	try {
		if (!sessionStorage.getItem(registerKey)) {
			await fetch(`${notifierUrl}/register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rollNumber: attendanceData.registrationNumber,
					name: attendanceData.fullName,
					phone,
					subjects: absentCounts,
				}),
			});
			sessionStorage.setItem(registerKey, "1");
		}

		await fetch(`${notifierUrl}/check-absences`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				rollNumber: attendanceData.registrationNumber,
				name: attendanceData.fullName,
				currentAbsents: absentCounts,
			}),
		});
	} catch (error) {
		console.error("Failed to sync WhatsApp notifier", error);
	}
}
