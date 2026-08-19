import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import Attendance from "./components/Attendance";
import Footer from "./components/Footer";
import LoginForm from "./components/LoginForm";
import TnC from "./components/TnC";
import { AttendanceDataContext } from "./contexts/AppContext";
import {
	AUTH_COOKIE_NAME,
	COOKIE_EXPIRY,
	STUDENT_ID_COOKIE_NAME,
} from "./types/constants";
import type { ScheduleEntry, StudentDetails } from "./types/response";
import { decompressAndDecode } from "./utils/compression";
import { fetchAttendanceData } from "./utils/LoginUtils";

function App() {
	const [attendanceData, setAttendanceData] = useState<StudentDetails | null>(
		null,
	);
	const [scheduleData, setScheduleData] = useState<ScheduleEntry[] | null>(
		null,
	);

	const [isTnCVisible, setIsTnCVisible] = useState<boolean>(false);

	useEffect(() => {
		const searchParams = new URLSearchParams(window.location.search);
		const urlToken = searchParams.get("token");
		const urlData = searchParams.get("data");

		if (urlData) {
			// Data mode: attendance data is pre-fetched by the extension
			window.history.replaceState({}, document.title, window.location.pathname);

			const loadFromData = async () => {
				try {
					const json = await decompressAndDecode(urlData);
					const parsed = JSON.parse(json);

					const updatedStudentDetails: StudentDetails = {
						...parsed.attendance,
						attendanceCourseComponentInfoList:
							parsed.attendance.attendanceCourseComponentInfoList.map(
								(
									course: StudentDetails["attendanceCourseComponentInfoList"][number],
								) => ({
									...course,
									attendanceCourseComponentNameInfoList:
										course.attendanceCourseComponentNameInfoList.map(
											(component) => ({
												...component,
												isProjected: false,
											}),
										),
								}),
							),
					};

					setAttendanceData(updatedStudentDetails);

					// Set schedule data from the pre-fetched data
					if (parsed.schedule) {
						setScheduleData(parsed.schedule);
					}

					// Cache studentId from the pre-fetched data
					if (parsed.studentId) {
						Cookies.set(STUDENT_ID_COOKIE_NAME, String(parsed.studentId), {
							expires: COOKIE_EXPIRY,
						});
					}
				} catch (error) {
					console.error("Failed to decode attendance data", error);
				}
			};
			loadFromData();
		} else if (urlToken) {
			// Token mode: fetch attendance data from the ERP API
			window.history.replaceState({}, document.title, window.location.pathname);

			const loginWithToken = async () => {
				try {
					Cookies.set(AUTH_COOKIE_NAME, urlToken, { expires: COOKIE_EXPIRY });
					const data = await fetchAttendanceData(urlToken);

					const updatedStudentDetails: StudentDetails = {
						...data,
						attendanceCourseComponentInfoList:
							data.attendanceCourseComponentInfoList.map((course) => ({
								...course,
								attendanceCourseComponentNameInfoList:
									course.attendanceCourseComponentNameInfoList.map(
										(component) => ({
											...component,
											isProjected: false,
										}),
									),
							})),
					};

					setAttendanceData(updatedStudentDetails);
				} catch (error) {
					console.error("Failed to login with URL token", error);
				}
			};
			loginWithToken();
		}
	}, []);

	return (
		<div className="min-h-screen bg-gray-100 flex flex-col">
			<div className="overflow-hidden m-auto bg-green-100 w-full">
				<div className="py-2 text-center text-sm font-medium text-green-600">
					YOUR CREDENTIALS ARE NEVER SHARED WITH US. THEY ARE SENT DIRECTLY TO
					CYBERVIDYA AND STORED LOCALLY.
					<a
						href="https://github.com/AmanDevelops/attendance-kiet"
						className="text-blue-400"
						target="_blank"
						rel="noopener"
					>
						{" "}
						VIEW SOURCE CODE
					</a>
				</div>
			</div>
			<div className="grow flex flex-col justify-center">
				<AttendanceDataContext.Provider
					value={{
						attendanceData,
						setAttendanceData,
						scheduleData,
						setScheduleData,
					}}
				>
					{!attendanceData ? (
						isTnCVisible ? (
							<TnC setIsPasswordVisible={setIsTnCVisible} />
						) : (
							<LoginForm setIsTnCVisible={setIsTnCVisible} />
						)
					) : (
						<Attendance />
					)}
				</AttendanceDataContext.Provider>
			</div>

			<Footer />
		</div>
	);
}

export default App;
