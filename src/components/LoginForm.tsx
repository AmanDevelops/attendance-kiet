import axios from "axios";
import Cookies from "js-cookie";
import { BookOpen, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import {
	AUTH_COOKIE_NAME,
	COOKIE_EXPIRY,
	getApiMode,
	getBaseUrl,
	PASSWORD_COOKIE_NAME,
	REMEMBER_ME_COOKIE_NAME,
	STUDENT_ID_COOKIE_NAME,
	setApiMode,
	USERNAME_COOKIE_NAME,
} from "../types/constants";
import type {
	EncryptLoginResponse,
	LoginResponse,
	StudentDetails,
} from "../types/response";
import PasswordInput from "../ui/PasswordInput";
import { setAuthCookie } from "../utils/jwt";
import { encryptPassword, fetchAttendanceData } from "../utils/LoginUtils";
import InstallExtensionPage from "./InstallExtensionPage";

interface ApiErrorResponse {
	error?: {
		reason?: string;
	};
}

function getServerErrorReason(err: unknown): string | null {
	if (axios.isAxiosError(err)) {
		const data = err.response?.data as ApiErrorResponse | undefined;
		return data?.error?.reason ?? null;
	}
	return null;
}

function isUnsupportedClientVersionError(err: unknown): boolean {
	const reason = getServerErrorReason(err)?.toLowerCase() ?? "";
	return (
		reason.includes("update your mobile application") ||
		reason.includes("version is no longer supported")
	);
}

async function loadAttendance(
	token: string,
	setAttendanceData: React.Dispatch<
		React.SetStateAction<StudentDetails | null>
	>,
) {
	const data = await fetchAttendanceData(token);
	const updatedStudentDetails: StudentDetails = {
		...data,
		attendanceCourseComponentInfoList:
			data.attendanceCourseComponentInfoList.map((course) => ({
				...course,
				attendanceCourseComponentNameInfoList:
					course.attendanceCourseComponentNameInfoList.map((component) => ({
						...component,
						isProjected: false,
					})),
			})),
	};

	setAttendanceData(updatedStudentDetails);
}

interface LoginFormProps {
	setIsTnCVisible: React.Dispatch<React.SetStateAction<boolean>>;
	onModeChange?: (mode: "proxy" | "live") => void;
}

function LoginForm({ setIsTnCVisible, onModeChange }: LoginFormProps) {
	const username: string = Cookies.get(USERNAME_COOKIE_NAME) || "";
	const rememberMe: boolean = Cookies.get(REMEMBER_ME_COOKIE_NAME) === "true";
	const savedPassword: string = rememberMe
		? Cookies.get(PASSWORD_COOKIE_NAME) || ""
		: "";

	const usernameRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const rememberMeRef = useRef<HTMLInputElement>(null);
	const otpRef = useRef<HTMLInputElement>(null);

	const [step, setStep] = useState<"credentials" | "otp">("credentials");
	const [transactionId, setTransactionId] = useState<string>("");
	const [apiMode, setApiModeState] = useState<"proxy" | "live">(() =>
		getApiMode(),
	);
	const submittedUsernameRef = useRef<string>("");
	const submittedPasswordRef = useRef<string>("");
	const submittedRememberMeRef = useRef<boolean>(false);
	const [error, setError] = useState<string>("");
	const [isExtensionError, setIsExtensionError] = useState<boolean>(false);
	const [showInstallPage, setShowInstallPage] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(false);

	const { setAttendanceData, theme } = useAppContext();

	const handleModeToggle = (newMode: "proxy" | "live") => {
		setApiModeState(newMode);
		setApiMode(newMode);
		setError("");
		setIsExtensionError(false);
		onModeChange?.(newMode);
	};

	const handleAuthError = (
		err: unknown,
		badRequestMessage: string,
		forbiddenMessage: string,
		networkErrorMessage: string,
	) => {
		if (!axios.isAxiosError(err)) {
			setError(networkErrorMessage);
			return;
		}

		const serverReason = getServerErrorReason(err);
		const status = err.response?.status;

		if (status === 400) {
			setError(serverReason || badRequestMessage);
		} else if (status === 403) {
			if (apiMode === "live") {
				setError("Please Update the Extension to the latest version 3.6!");
				setIsExtensionError(true);
			} else {
				setError(serverReason || forbiddenMessage);
			}
		} else {
			setError(networkErrorMessage);
		}
	};

	useEffect(() => {
		const token = Cookies.get(AUTH_COOKIE_NAME);

		if (token) {
			const loadData = async () => {
				try {
					await loadAttendance(token, setAttendanceData);
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
					Cookies.remove(AUTH_COOKIE_NAME);
					Cookies.remove(STUDENT_ID_COOKIE_NAME);
				}
			};
			loadData();
		}
	}, [setAttendanceData]);

	const completeLogin = async (login: {
		token: string;
		username: string;
		password: string;
		rememberMe: boolean;
		studentId?: number | string;
	}) => {
		const { token, username: user, password, rememberMe, studentId } = login;

		Cookies.remove(STUDENT_ID_COOKIE_NAME);
		if (studentId) {
			Cookies.set(STUDENT_ID_COOKIE_NAME, String(studentId), {
				expires: COOKIE_EXPIRY,
			});
		}

		setAuthCookie(token);
		Cookies.set(USERNAME_COOKIE_NAME, user, { expires: COOKIE_EXPIRY });
		Cookies.set(REMEMBER_ME_COOKIE_NAME, rememberMe.toString(), {
			expires: COOKIE_EXPIRY,
		});

		if (rememberMe) {
			Cookies.set(PASSWORD_COOKIE_NAME, password, { expires: COOKIE_EXPIRY });
		} else {
			Cookies.remove(PASSWORD_COOKIE_NAME);
		}

		try {
			await loadAttendance(token, setAttendanceData);
		} catch (fetchError) {
			console.error(fetchError);
			setError("Login successful, but failed to load attendance data.");
		} finally {
			setLoading(false);
		}
	};

	const handleCredentialsSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		setIsExtensionError(false);

		const enteredUser = usernameRef.current?.value || "";
		const enteredPass = passwordRef.current?.value || "";
		const enteredRemember = rememberMeRef.current?.checked || false;

		// Login happens in up to two steps:
		//   1. Try the legacy direct login. Some accounts may still get a token
		//      without OTP.
		//   2. Otherwise use the encrypted login, which starts the OTP flow.
		// The legacy endpoint currently rejects every request with a
		// client-version error, so that specific 400 must fall through instead
		// of being reported as a bad password.
		try {
			const directResponse = await axios.post<LoginResponse>(
				`${getBaseUrl()}/api/auth/login`,
				{ userName: enteredUser, password: enteredPass },
			);
			const directToken =
				directResponse.data.token || directResponse.data.data?.token;
			if (directToken) {
				await completeLogin({
					token: directToken,
					username: enteredUser,
					password: enteredPass,
					rememberMe: enteredRemember,
					studentId: directResponse.data.data?.id,
				});
				return;
			}
		} catch (directError) {
			if (
				axios.isAxiosError(directError) &&
				directError.response?.status === 400 &&
				!isUnsupportedClientVersionError(directError)
			) {
				setError(
					getServerErrorReason(directError) || "Invalid Username or Password",
				);
				setLoading(false);
				return;
			}
		}

		// 2. Encrypted login fallback, which triggers the OTP flow.
		try {
			const loginResponse = await axios.post<EncryptLoginResponse>(
				`${getBaseUrl()}/api/auth/encrypt/login`,
				{
					userName: encryptPassword(enteredUser),
					password: encryptPassword(enteredPass),
					device: "WEB",
					version: null,
					reCaptchaToken: null,
				},
			);

			const loginData = loginResponse.data;
			const directToken = loginData.token || loginData.data?.token;
			if (directToken) {
				await completeLogin({
					token: directToken,
					username: enteredUser,
					password: enteredPass,
					rememberMe: enteredRemember,
					studentId: loginData.data?.id,
				});
				return;
			}

			const nextTransactionId = loginData.data?.transactionId;
			if (!nextTransactionId) {
				setError("Login failed. The server did not return an OTP transaction.");
				return;
			}

			submittedUsernameRef.current = enteredUser;
			submittedPasswordRef.current = enteredPass;
			submittedRememberMeRef.current = enteredRemember;
			setTransactionId(nextTransactionId);
			setStep("otp");
		} catch (loginError) {
			handleAuthError(
				loginError,
				"Invalid Username or Password",
				"Access forbidden. Please check your credentials or try again.",
				"Login failed. The server isn’t responding or your internet connection may be unavailable.",
			);
		} finally {
			setLoading(false);
		}
	};

	const handleOtpSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		setIsExtensionError(false);

		let token = "";

		try {
			const otpResponse = await axios.post<LoginResponse>(
				`${getBaseUrl()}/api/auth/verify/otp`,
				{
					otp: otpRef.current?.value || "",
					transactionId: transactionId,
					device: "WEB",
					version: null,
				},
			);

			token = otpResponse.data.token || otpResponse.data.data?.token || "";
		} catch (otpError) {
			handleAuthError(
				otpError,
				"Invalid or expired OTP",
				"Invalid or expired OTP",
				"OTP verification failed. The server isn’t responding or your internet connection may be unavailable.",
			);
			setLoading(false);
			return;
		}

		await completeLogin({
			token,
			username: submittedUsernameRef.current,
			password: submittedPasswordRef.current,
			rememberMe: submittedRememberMeRef.current,
		});
	};

	if (showInstallPage) {
		return <InstallExtensionPage onBack={() => setShowInstallPage(false)} />;
	}

	return (
		<div className="flex flex-col mb-10 mt-10 items-center justify-center p-4">
			<div
				className="style-panel style-border w-full max-w-md p-8 style-fade-in transition-colors duration-200"
				style={{
					backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
					color: theme === "dark" ? "#ffffff" : "#000000",
					borderColor: theme === "dark" ? "#ffffff" : "#000000",
				}}
			>
				<div className="flex items-center justify-center mb-8 relative">
					<BookOpen
						className={`h-16 w-16 transform -rotate-12 ${theme === "dark" ? "text-white" : "text-black"}`}
					/>
					<Sparkles
						className={`h-8 w-8 absolute translate-x-8 -translate-y-8 ${theme === "dark" ? "text-white" : "text-black"}`}
					/>
				</div>
				<h2
					className={`anga-text text-3xl font-black text-center mb-6 transform -rotate-2 ${theme === "dark" ? "text-white" : "text-black"}`}
				>
					CyberVidya Attendance
				</h2>

				{/* Minimal connection toggle */}
				<div className="mb-6 flex flex-col items-center gap-1.5">
					<div className="relative grid grid-cols-2 w-64 bg-gray-200 dark:bg-gray-700 border-2 border-black dark:border-white p-0.5 select-none">
						<button
							type="button"
							onClick={() => handleModeToggle("proxy")}
							className={`relative z-10 py-1.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer text-center ${
								apiMode === "proxy"
									? "text-white dark:text-black bg-black dark:bg-white"
									: "text-black dark:text-white hover:text-gray-700 dark:hover:text-gray-300"
							}`}
							aria-pressed={apiMode === "proxy"}
						>
							Proxy
						</button>
						<button
							type="button"
							onClick={() => handleModeToggle("live")}
							className={`relative z-10 py-1.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer text-center ${
								apiMode === "live"
									? "text-white dark:text-black bg-black dark:bg-white"
									: "text-black dark:text-white hover:text-gray-700 dark:hover:text-gray-300"
							}`}
							aria-pressed={apiMode === "live"}
						>
							Live ERP
						</button>
					</div>

					<p className="text-[11px] text-gray-600 dark:text-gray-400 font-bold uppercase tracking-wider text-center">
						{apiMode === "proxy"
							? "No extension required"
							: "Extension required"}
					</p>
				</div>

				{step === "credentials" ? (
					<form onSubmit={handleCredentialsSubmit} className="space-y-6">
						<div>
							<label
								htmlFor="username"
								className={`style-text block text-sm font-bold ${theme === "dark" ? "text-white" : "text-black"}`}
							>
								University Roll Number
							</label>
							<input
								id="username"
								type="text"
								ref={usernameRef}
								defaultValue={username}
								placeholder="20240XXXXXXXXXX"
								className="mt-1 block w-full style-border rounded-none px-3 py-2 bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
								required
							/>
						</div>
						<div>
							<label
								htmlFor="password"
								className={`style-text block text-sm font-bold ${theme === "dark" ? "text-white" : "text-black"}`}
							>
								CyberVidya Password
							</label>
							<PasswordInput ref={passwordRef} defaultValue={savedPassword} />
						</div>
						<div className="flex items-center">
							<input
								id="remember-me"
								type="checkbox"
								defaultChecked={rememberMe}
								ref={rememberMeRef}
								className="h-5 w-5 style-border rounded-none bg-white dark:bg-gray-900"
							/>
							<label
								htmlFor="remember-me"
								className={`ml-2 block style-text-sm font-bold ${theme === "dark" ? "text-white" : "text-black"}`}
							>
								Remember me
							</label>
						</div>
						<div className="text-gray-600 dark:text-gray-400 text-sm">
							By clicking <i>'View Attendance'</i>, you agree to our{" "}
							<button
								type="button"
								onClick={() => setIsTnCVisible((prev) => !prev)}
								className="text-gray-500 dark:text-gray-400 bg-none border-none p-0 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 underline"
							>
								Terms of Service and Privacy Policy
							</button>
						</div>

						{error && (
							<div className="relative style-text text-yellow-950 dark:text-yellow-200 text-sm bg-yellow-100 dark:bg-yellow-900 p-2 style-border">
								{isExtensionError && (
									<span className="absolute -top-3 -right-3 bg-red-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full border-2 border-black shadow-[2px_2px_0_#000] uppercase tracking-wider">
										New
									</span>
								)}
								<p>{error}</p>
								{isExtensionError && (
									<button
										type="button"
										onClick={() => setShowInstallPage(true)}
										className="mt-2 font-bold underline cursor-pointer hover:text-red-800 dark:hover:text-red-300"
									>
										View extension installation guide →
									</button>
								)}
							</div>
						)}
						<button
							type="submit"
							disabled={loading}
							className="w-full style-border style-text py-3 px-4 text-sm font-black text-white dark:text-black bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 focus:outline-none disabled:opacity-50 transform hover:-translate-y-1 transition-transform cursor-pointer"
						>
							{loading ? "Loading..." : "View Attendance"}
						</button>
					</form>
				) : (
					<form onSubmit={handleOtpSubmit} className="space-y-6">
						<div className="text-center text-gray-600 dark:text-gray-300 text-sm">
							An OTP has been sent to your registered email address. Enter it
							below to continue.
						</div>
						<div>
							<label
								htmlFor="otp"
								className={`style-text block text-sm font-bold ${theme === "dark" ? "text-white" : "text-black"}`}
							>
								One-Time Password (OTP)
							</label>
							<input
								id="otp"
								type="text"
								inputMode="numeric"
								autoComplete="one-time-code"
								maxLength={6}
								ref={otpRef}
								placeholder="XXXXXX"
								className="mt-1 block w-full style-border rounded-none px-3 py-2 bg-white dark:bg-gray-900 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white"
								required
							/>
						</div>

						{error && (
							<div className="relative style-text text-red-600 dark:text-red-300 text-sm bg-red-100 dark:bg-red-950 p-2 style-border">
								{isExtensionError && (
									<span className="absolute -top-3 -right-3 bg-red-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full border-2 border-black shadow-[2px_2px_0_#000] uppercase tracking-wider">
										New
									</span>
								)}
								<p>{error}</p>
								{isExtensionError && (
									<button
										type="button"
										onClick={() => setShowInstallPage(true)}
										className="mt-2 font-bold underline cursor-pointer hover:text-red-800 dark:hover:text-red-300"
									>
										View extension installation guide →
									</button>
								)}
							</div>
						)}
						<button
							type="submit"
							disabled={loading}
							className="w-full style-border style-text py-3 px-4 text-sm font-black text-white dark:text-black bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 focus:outline-none disabled:opacity-50 transform hover:-translate-y-1 transition-transform cursor-pointer"
						>
							{loading ? "Verifying..." : "Verify OTP"}
						</button>
						<button
							type="button"
							onClick={() => {
								setStep("credentials");
								setError("");
								setIsExtensionError(false);
							}}
							className="w-full text-center text-sm text-gray-500 dark:text-gray-400 bg-none border-none p-0 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 underline"
						>
							Back to login
						</button>
					</form>
				)}
			</div>
		</div>
	);
}

export default LoginForm;
