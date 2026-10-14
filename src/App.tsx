import { useEffect, useRef, useState } from "react";
import Attendance from "./components/Attendance";
import ExtensionUpdateNotice from "./components/ExtensionUpdateNotice";
import Footer from "./components/Footer";
import LoginForm from "./components/LoginForm";
import TnC from "./components/TnC";
import { AttendanceDataContext } from "./contexts/AppContext";
import type { StudentDetails } from "./types/response";
import {
	clearAuthCookies,
	msUntilAuthExpiry,
	setAuthCookie,
} from "./utils/jwt";
import { fetchAttendanceData } from "./utils/LoginUtils";

function App() {
	const [attendanceData, setAttendanceData] = useState<StudentDetails | null>(
		null,
	);

	const [isTnCVisible, setIsTnCVisible] = useState<boolean>(false);
	const [showGreenBanner, setShowGreenBanner] = useState<boolean>(true);
	const hasSelectedLiveRef = useRef<boolean>(false);

	const handleModeChange = (mode: "proxy" | "live") => {
		if (mode === "live") {
			hasSelectedLiveRef.current = true;
		} else if (mode === "proxy" && hasSelectedLiveRef.current) {
			setShowGreenBanner(false);
		}
	};

	useEffect(() => {
		const searchParams = new URLSearchParams(window.location.search);
		const urlToken = searchParams.get("token");

		if (urlToken) {
			// Token mode: fetch attendance data from the ERP API.
			// The extension's DNR ruleset rewrites request headers so the
			// ERP accepts calls originating from this app.
			window.history.replaceState({}, document.title, window.location.pathname);

			const loginWithToken = async () => {
				try {
					setAuthCookie(urlToken);
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

	// Log out automatically the moment the JWT expires. Keyed on the boolean so
	// the timer is not rebuilt every time attendanceData is updated.
	const isLoggedIn = attendanceData !== null;
	useEffect(() => {
		if (!isLoggedIn) return;
		let timer: ReturnType<typeof setTimeout>;

		const schedule = () => {
			const remaining = msUntilAuthExpiry();
			if (remaining === null) return;
			if (remaining <= 0) {
				clearAuthCookies();
				setAttendanceData(null);
				return;
			}
			// setTimeout overflows past ~24.8 days; wake early and re-check.
			timer = setTimeout(schedule, Math.min(remaining, 2 ** 31 - 1));
		};

		schedule();
		return () => clearTimeout(timer);
	}, [isLoggedIn]);

	return (
		<div className="min-h-screen bg-gray-100 flex flex-col">
			{showGreenBanner && (
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
			)}
			<ExtensionUpdateNotice />
			<div className="grow flex flex-col justify-center">
				<AttendanceDataContext.Provider
					value={{
						attendanceData,
						setAttendanceData,
					}}
				>
					{!attendanceData ? (
						isTnCVisible ? (
							<TnC setIsPasswordVisible={setIsTnCVisible} />
						) : (
							<LoginForm
								setIsTnCVisible={setIsTnCVisible}
								onModeChange={handleModeChange}
							/>
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
