import { useEffect, useRef, useState } from "react";
import Attendance from "./components/Attendance";
import ExtensionUpdateNotice from "./components/ExtensionUpdateNotice";
import Footer from "./components/Footer";
import LoginForm from "./components/LoginForm";
import TnC from "./components/TnC";
import { AttendanceDataContext, type Theme } from "./contexts/AppContext";
import { TARGET_PERCENTAGE } from "./types/constants";
import type { StudentDetails } from "./types/response";
import {
	clearAuthCookies,
	msUntilAuthExpiry,
	setAuthCookie,
} from "./utils/jwt";
import { fetchAttendanceData } from "./utils/LoginUtils";

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

	// --- Theme State Management ---
	const [theme, setTheme] = useState<Theme>(() => {
		try {
			const savedTheme = localStorage.getItem("theme");
			if (savedTheme === "dark" || savedTheme === "light") {
				return savedTheme;
			}
			if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
				return "dark";
			}
		} catch {
			// Ignore storage errors
		}
		return "light";
	});

	useEffect(() => {
		try {
			localStorage.setItem("theme", theme);
			if (theme === "dark") {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
		} catch {
			// Ignore errors
		}
	}, [theme]);

	const toggleTheme = () => {
		setTheme((prev) => (prev === "light" ? "dark" : "light"));
	};
	// ------------------------------

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
			window.history.replaceState({}, document.title, window.location.pathname);

			const loginWithToken = async () => {
				try {
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
			timer = setTimeout(
				schedule,
				Math.min(remaining, MAX_SETTIMEOUT_DELAY_MS),
			);
		};

		schedule();
		return () => clearTimeout(timer);
	}, [isLoggedIn]);

	return (
		<AttendanceDataContext.Provider
			value={{
				attendanceData,
				setAttendanceData,
				targetPercentage,
				setTargetPercentage,
				theme,
				toggleTheme,
			}}
		>
			<div
				className="min-h-screen flex flex-col transition-colors duration-200"
				style={{
					backgroundColor: theme === "dark" ? "#0b0f19" : "#ffffff",
					color: theme === "dark" ? "#ffffff" : "#000000",
				}}
			>
				{showGreenBanner && (
					<div className="overflow-hidden m-auto bg-green-100 dark:bg-green-900 w-full">
						<div className="py-2 text-center text-sm font-medium text-green-600 dark:text-green-300">
							YOUR CREDENTIALS ARE NEVER SHARED WITH US. THEY ARE SENT DIRECTLY
							TO CYBERVIDYA AND STORED LOCALLY.
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
				</div>

				<Footer />
			</div>
		</AttendanceDataContext.Provider>
	);
}

export default App;
