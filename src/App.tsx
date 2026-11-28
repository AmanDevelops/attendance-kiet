import { useCallback, useEffect, useRef, useState } from "react";
import Attendance from "./components/Attendance";
import ExtensionUpdateNotice from "./components/ExtensionUpdateNotice";
import Footer from "./components/Footer";
import LoginForm from "./components/LoginForm";
import TnC from "./components/TnC";
import { AttendanceDataContext } from "./contexts/AppContext";
import { TARGET_PERCENTAGE } from "./types/constants";
import type { StudentDetails } from "./types/response";
import {
	applyCachedAttendanceCorrections,
	scheduleAttendanceReconciliation,
} from "./utils/attendance";
import {
	clearAuthCookies,
	msUntilAuthExpiry,
	setAuthCookie,
} from "./utils/jwt";
import { fetchAttendanceData } from "./utils/LoginUtils";
import {
	applyTheme,
	getInitialTheme,
	saveTheme,
	type Theme,
} from "./utils/theme";

// setTimeout stores its delay in a signed 32-bit int, so anything past this
// fires immediately instead of waiting. We cap each wait to this and re-check.
const MAX_SETTIMEOUT_DELAY_MS = 2 ** 31 - 1;

function App() {
	const [attendanceData, setAttendanceData] = useState<StudentDetails | null>(
		null,
	);
	// Pure in-memory criteria state. Always defaults to 75 and {} on refresh/login.
	const [targetPercentage, setTargetPercentageState] =
		useState<number>(TARGET_PERCENTAGE);

	const setTargetPercentage = (val: number) => {
		setTargetPercentageState(Math.max(0, Math.min(100, Math.round(val))));
	};

	const [subjectOverrides, setSubjectOverrides] = useState<
		Record<string, number>
	>({});

	const setSubjectOverride = (courseCode: string, target: number) => {
		const clamped = Math.max(0, Math.min(100, Math.round(target)));
		setSubjectOverrides((prev) => ({ ...prev, [courseCode]: clamped }));
	};

	const removeSubjectOverride = (courseCode: string) => {
		setSubjectOverrides((prev) => {
			if (!(courseCode in prev)) return prev;
			const next = { ...prev };
			delete next[courseCode];
			return next;
		});
	};

	const resetAllSubjectOverrides = () => {
		setSubjectOverrides({});
	};

	const clearAttendanceCriteria = useCallback(() => {
		setTargetPercentageState(TARGET_PERCENTAGE);
		setSubjectOverrides({});
	}, []);

	// Clean up any legacy saved criteria keys from previous versions on mount
	useEffect(() => {
		try {
			localStorage.removeItem("attendance_target_percentage");
			localStorage.removeItem("attendance_subject_overrides");
		} catch {
			// Ignore storage errors
		}
	}, []);

	const [theme, setTheme] = useState<Theme>(getInitialTheme);

	// Keep the <html> class in sync with state. This does not write to storage.
	useEffect(() => {
		applyTheme(theme);
	}, [theme]);

	const toggleTheme = () => {
		const next: Theme = theme === "dark" ? "light" : "dark";
		setTheme(next);
		saveTheme(next); // only an explicit click is saved
	};

	const [isTnCVisible, setIsTnCVisible] = useState<boolean>(false);
	const [showGreenBanner, setShowGreenBanner] = useState<boolean>(true);
	const hasSelectedLiveRef = useRef<boolean>(false);
	// Captured during render, before any effect can clean the URL. LoginForm
	// uses this to avoid restoring the previous cookie session in parallel.
	const [initialUrlToken] = useState<string | null>(() =>
		new URLSearchParams(window.location.search).get("token"),
	);
	const tokenLoginStartedRef = useRef<boolean>(false);

	const handleModeChange = (mode: "proxy" | "live") => {
		if (mode === "live") {
			hasSelectedLiveRef.current = true;
		} else if (mode === "proxy" && hasSelectedLiveRef.current) {
			setShowGreenBanner(false);
		}
	};

	useEffect(() => {
		if (!initialUrlToken || tokenLoginStartedRef.current) return;
		tokenLoginStartedRef.current = true;

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
				clearAttendanceCriteria();
				setAuthCookie(initialUrlToken);
				const data = await fetchAttendanceData(initialUrlToken);

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

				setAttendanceData(
					applyCachedAttendanceCorrections(updatedStudentDetails),
				);
				scheduleAttendanceReconciliation({
					token: initialUrlToken,
					data: updatedStudentDetails,
					setAttendanceData,
				});
			} catch (error) {
				console.error("Failed to login with URL token", error);
			}
		};
		loginWithToken();
	}, [initialUrlToken, clearAttendanceCriteria]);

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
				clearAttendanceCriteria();
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
	}, [isLoggedIn, clearAttendanceCriteria]);

	return (
		<div className="min-h-screen bg-gray-100 text-black dark:bg-gray-950 dark:text-gray-100 flex flex-col overflow-x-hidden">
			{showGreenBanner && (
				<div className="overflow-hidden m-auto bg-green-100 dark:bg-green-900 w-full">
					<div className="py-2 text-center text-sm font-medium text-green-600 dark:text-green-300">
						YOUR CREDENTIALS ARE NEVER SHARED WITH US. THEY ARE SENT DIRECTLY TO
						CYBERVIDYA AND STORED LOCALLY.
						<a
							href="https://github.com/AmanDevelops/attendance-kiet"
							className="text-blue-400 dark:text-blue-300"
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
						subjectOverrides,
						setSubjectOverride,
						removeSubjectOverride,
						resetAllSubjectOverrides,
						clearAttendanceCriteria,
					}}
				>
					{!attendanceData ? (
						isTnCVisible ? (
							<TnC setIsPasswordVisible={setIsTnCVisible} />
						) : (
							<LoginForm
								setIsTnCVisible={setIsTnCVisible}
								onModeChange={handleModeChange}
								hasUrlToken={Boolean(initialUrlToken)}
							/>
						)
					) : (
						<Attendance />
					)}
				</AttendanceDataContext.Provider>
			</div>

			<Footer theme={theme} onToggleTheme={toggleTheme} />
		</div>
	);
}

export default App;
