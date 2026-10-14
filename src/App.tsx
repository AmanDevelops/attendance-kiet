import { useEffect, useRef, useState } from "react";
import Attendance from "./components/Attendance";
import ExtensionUpdateNotice from "./components/ExtensionUpdateNotice";
import Footer from "./components/Footer";
import LoginForm from "./components/LoginForm";
import TnC from "./components/TnC";
import { AttendanceDataContext } from "./contexts/AppContext";
import { TARGET_PERCENTAGE } from "./types/constants";
import type { StudentDetails } from "./types/response";
import {
	clearAuthCookies,
	msUntilAuthExpiry,
	setAuthCookie,
} from "./utils/jwt";
import { fetchAttendanceData } from "./utils/LoginUtils";

// setTimeout stores its delay in a signed 32-bit int, so anything past this
// fires immediately instead of waiting. We cap each wait to this and re-check.
const MAX_SETTIMEOUT_DELAY_MS = 2 ** 31 - 1;

function App() {
	const [attendanceData, setAttendanceData] = useState<StudentDetails | null>(
		null,
	);
	const [targetPercentage, setTargetPercentageState] = useState<number>(() => {
		try {
			const saved = localStorage.getItem("attendance_target_percentage");
			if (saved === "60" || saved === "75") {
				return Number(saved);
			}
		} catch {
			// Ignore storage errors
		}
		return TARGET_PERCENTAGE;
	});

	const setTargetPercentage = (val: number) => {
		setTargetPercentageState(val);
		try {
			localStorage.setItem("attendance_target_percentage", String(val));
		} catch {
			// Ignore storage errors
		}
	};

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
					// A fresh token mode login means a (possibly different) student is
					// signing in, so drop any studentId left over from a previous
					// session before storing the new auth cookie.
					clearAuthCookies();
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

		// `timer` is declared here (outside `schedule`) so the cleanup function
		// below can always see the *latest* timer and cancel it.
		let timer: ReturnType<typeof setTimeout>;

		// This function calls setTimeout with itself as the callback, so it
		// keeps re-running every time it fires - like an alarm that resets
		// itself. We can't just set one big timer for "time left until expiry"
		// because a JWT can last longer than setTimeout's ~24.8 day limit
		// (MAX_SETTIMEOUT_DELAY_MS), so instead we wait in smaller chunks and
		// recheck the remaining time after each chunk.
		const schedule = () => {
			const remaining = msUntilAuthExpiry();
			if (remaining === null) return;
			if (remaining <= 0) {
				clearAuthCookies();
				setAttendanceData(null);
				return;
			}
			timer = setTimeout(
				schedule,
				Math.min(remaining, MAX_SETTIMEOUT_DELAY_MS),
			);
		};

		schedule();
		// Runs if the component unmounts or the user logs out before the timer
		// fires, so we don't try to update state that no longer exists.
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
						targetPercentage,
						setTargetPercentage,
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
