import { TARGET_PERCENTAGE } from "../types/constants";
import type { StudentDetails } from "../types/response";

const SESSION_NOTIFY_PREFIX = "kiet-low-attendance:";

export function requestNotificationPermission(): void {
	if (typeof Notification === "undefined") return;
	if (Notification.permission === "default") {
		void Notification.requestPermission();
	}
}

export function showNotification(title: string, message: string): void {
	if (
		typeof Notification === "undefined" ||
		Notification.permission !== "granted"
	) {
		return;
	}
	new Notification(title, { body: message });
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
