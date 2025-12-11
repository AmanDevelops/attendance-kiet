import axios from "axios";
import Cookies from "js-cookie";
import { BookOpen, Eye, EyeOff, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReCAPTCHA from "react-google-recaptcha";
import { useAppContext } from "../contexts/AppContext";
import {
	AUTH_COOKIE_NAME,
	COOKIE_EXPIRY,
	REMEMBER_ME_COOKIE_NAME,
	STUDENT_ID_COOKIE_NAME,
	USERNAME_COOKIE_NAME,
} from "../types/constants";
import type { LoginResponse, StudentDetails } from "../types/response";
import PasswordInput from "../ui/PasswordInput";
import { fetchAttendanceData } from "../utils/LoginUtils";
import { fetchMoodleAssignments, loginToMoodle } from "../utils/moodleService";

// Found from user input
const RECAPTCHA_SITE_KEY = "6LdhPigsAAAAAJxhQ2nqig0Zjgm_dXg8z0X5mo25";

function LoginForm({
	setIsTnCVisible,
}: {
	setIsTnCVisible: React.Dispatch<React.SetStateAction<boolean>>;
}) {
	const username: string = Cookies.get(USERNAME_COOKIE_NAME) || "";
	const rememberMe: boolean = Cookies.get(REMEMBER_ME_COOKIE_NAME) === "true";

	const usernameRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const rememberMeRef = useRef<HTMLInputElement>(null);

	const [error, setError] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);
	const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

	// Moodle State
	const [moodleEnabled, setMoodleEnabled] = useState(false);
	const [moodlePasswordVisible, setMoodlePasswordVisible] = useState(false);
	const moodleUsernameRef = useRef<HTMLInputElement>(null);
	const moodlePasswordRef = useRef<HTMLInputElement>(null);
	const { setAttendanceData, setMoodleAssignments } = useAppContext();

	useEffect(() => {
		const token = Cookies.get(AUTH_COOKIE_NAME);

		if (token) {
			const loadData = async () => {
				try {
					const data = await fetchAttendanceData(token);
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
					console.error("Auto-login error:", error);
					// Don't show error on auto-login failure, just let user see login form
					// setError(error instanceof Error ? error.message : String(error));
				}
			};
			loadData();
		}
	}, [setAttendanceData]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");

		if (!recaptchaToken) {
			setError("Please complete the ReCaptcha verification.");
			setLoading(false);
			return;
		}

		let cyberVidyaToken = "";
		let isCyberVidyaSuccess = false;

		// 1. Attempt CyberVidya Login
		try {
			const loginResponse = await axios.post<LoginResponse>(
				"https://kiet.cybervidya.net/api/auth/login",
				{
					userName: usernameRef.current?.value,
					password: passwordRef.current?.value,
					reCaptchaToken: recaptchaToken, // Found via network inspection
				},
			);
			cyberVidyaToken = loginResponse.data.data.token;
			isCyberVidyaSuccess = true;
		} catch (loginError) {
			const is400 =
				axios.isAxiosError(loginError) && loginError.response?.status === 400;
			const msg = is400
				? "CyberVidya Login Failed: ReCaptcha Required or Invalid Credentials."
				: "CyberVidya Login Failed: Server error.";
			console.error(msg, loginError);

			if (!moodleEnabled) {
				setError(msg);
				setLoading(false);
				return;
			}
			// If Moodle enabled, we continue...
		}

		// 2. Attempt Moodle Login
		let isMoodleSuccess = false;
		if (
			moodleEnabled &&
			moodleUsernameRef.current?.value &&
			moodlePasswordRef.current?.value
		) {
			try {
				const sesskey = await loginToMoodle(
					moodleUsernameRef.current.value,
					moodlePasswordRef.current.value,
				);
				const assignments = await fetchMoodleAssignments(sesskey);
				setMoodleAssignments(assignments);
				console.log("Moodle assignments fetched:", assignments.length);
				isMoodleSuccess = true;
			} catch (moodleErr) {
				console.error("Moodle login failed:", moodleErr);
				if (!isCyberVidyaSuccess) {
					setError("Both logins failed. Please check credentials.");
					setLoading(false);
					return;
				}
				alert("Moodle login failed, but CyberVidya login succeeded.");
			}
		} else if (!isCyberVidyaSuccess) {
			// Moodle not enabled/filled and CV failed
			setLoading(false);
			return;
		}

		// 3. Finalize Login State
		const isRemembered = rememberMeRef.current?.checked;
		if (username !== usernameRef.current?.value) {
			Cookies.remove(STUDENT_ID_COOKIE_NAME);
		}

		if (isCyberVidyaSuccess && cyberVidyaToken) {
			Cookies.set(AUTH_COOKIE_NAME, cyberVidyaToken, { expires: 1 / 24 });
			Cookies.set(USERNAME_COOKIE_NAME, usernameRef.current?.value || "", {
				expires: COOKIE_EXPIRY,
			});
			Cookies.set(
				REMEMBER_ME_COOKIE_NAME,
				isRemembered?.toString() || "false",
				{ expires: COOKIE_EXPIRY },
			);

			try {
				const data = await fetchAttendanceData(cyberVidyaToken);
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
			} catch (fetchError) {
				console.error(fetchError);
				setError("Login successful, but failed to load attendance data.");
			}
		} else if (isMoodleSuccess) {
			// Fallback: Moodle Only Mode
			// Mock Data so the App renders
			const mockData: StudentDetails = {
				fullName: "Moodle User",
				registrationNumber: usernameRef.current?.value || "N/A",
				sectionName: "N/A",
				branchShortName: "N/A",
				degreeName: "N/A",
				semesterName: "N/A",
				attendanceCourseComponentInfoList: [], // Empty attendance
			};
			setAttendanceData(mockData);
			alert(
				"Logged in to Moodle only. CyberVidya attendance is unavailable due to ReCaptcha.",
			);
		}

		setLoading(false);
	};

	return (
		<div className="flex flex-col mb-20 mt-20 items-center justify-center p-4">
			<div className="style-panel style-border w-full max-w-md bg-white p-8 style-fade-in">
				<div className="flex items-center justify-center mb-8">
					<BookOpen className="h-16 w-16 text-black transform -rotate-12" />
					<Sparkles className="h-8 w-8 text-black absolute translate-x-8 -translate-y-8" />
				</div>
				<h2 className="anga-text text-3xl font-black text-center text-black mb-8 transform -rotate-2">
					CyberVidya Attendance
				</h2>
				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label
							htmlFor="username"
							className="style-text block text-sm font-bold text-black"
						>
							University Roll Number
						</label>
						<input
							id="username"
							type="text"
							ref={usernameRef}
							defaultValue={username}
							placeholder="20240XXXXXXXXXX"
							className="mt-1 block w-full style-border rounded-none px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black"
							required
						/>
					</div>
					<div>
						<label
							htmlFor="password"
							className="style-text block text-sm font-bold text-black"
						>
							CyberVidya Password
						</label>
						<PasswordInput ref={passwordRef} />
					</div>

					{/* ReCaptcha Widget */}
					<div className="flex justify-center my-4">
						<ReCAPTCHA
							sitekey={RECAPTCHA_SITE_KEY}
							onChange={(token) => setRecaptchaToken(token)}
						/>
					</div>

					{/* Moodle Toggle */}
					<div className="p-4 bg-gray-50 border border-gray-200">
						<div className="flex items-center mb-2">
							<input
								type="checkbox"
								id="moodle-toggle"
								checked={moodleEnabled}
								onChange={(e) => setMoodleEnabled(e.target.checked)}
								className="h-4 w-4 text-black border-gray-300 rounded focus:ring-black"
							/>
							<label
								htmlFor="moodle-toggle"
								className="ml-2 block text-sm font-bold text-black"
							>
								Connect Moodle Account?
							</label>
						</div>

						{moodleEnabled && (
							<div className="space-y-4 mt-2 pl-2 border-l-2 border-gray-300">
								<div>
									<label
										htmlFor="moodle-email"
										className="block text-xs font-bold text-gray-700"
									>
										Moodle Email
									</label>
									<input
										id="moodle-email"
										type="text"
										ref={moodleUsernameRef}
										placeholder="user@kiet.edu"
										className="mt-1 block w-full border border-gray-300 px-2 py-1 text-sm rounded-none"
									/>
								</div>
								<div>
									<label
										htmlFor="moodle-pass"
										className="block text-xs font-bold text-gray-700"
									>
										Moodle Password
									</label>
									<div className="relative">
										<input
											id="moodle-pass"
											type={moodlePasswordVisible ? "text" : "password"}
											ref={moodlePasswordRef}
											className="mt-1 block w-full border border-gray-300 px-2 py-1 text-sm rounded-none pr-8"
										/>
										<button
											type="button"
											onClick={() =>
												setMoodlePasswordVisible(!moodlePasswordVisible)
											}
											className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-black focus:outline-none"
										>
											{moodlePasswordVisible ? (
												<Eye className="h-4 w-4" />
											) : (
												<EyeOff className="h-4 w-4" />
											)}
										</button>
									</div>
								</div>
							</div>
						)}
					</div>

					<div className="flex items-center">
						<input
							id="remember-me"
							type="checkbox"
							defaultChecked={rememberMe}
							ref={rememberMeRef}
							className="h-5 w-5 style-border rounded-none"
						/>
						<label
							htmlFor="remember-me"
							className="ml-2 block style-text-sm font-bold text-black"
						>
							Remember me
						</label>
					</div>
					<div>
						By clicking <i>'View Attendance'</i>, you agree to our{" "}
						<button
							type="button"
							onClick={() => setIsTnCVisible((prev) => !prev)}
							className="text-gray-500 bg-none border-none p-0 cursor-pointer  hover:text-gray-700"
						>
							Terms of Service and Privacy Policy
						</button>
					</div>

					{error && (
						<p className="style-text text-red-600 text-sm bg-red-100 p-2 style-border">
							{error}
						</p>
					)}
					<button
						type="submit"
						disabled={loading}
						className="w-full style-border style-text py-3 px-4 text-sm font-black text-white bg-black hover:bg-gray-800 focus:outline-none disabled:opacity-50 transform hover:-translate-y-1 transition-transform cursor-pointer"
					>
						{loading ? "Loading..." : "View Attendance"}
					</button>
				</form>
			</div>
		</div>
	);
}

export default LoginForm;
