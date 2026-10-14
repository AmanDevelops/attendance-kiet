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

	const { setAttendanceData } = useAppContext();

	const handleModeToggle = (newMode: "proxy" | "live") => {
		setApiModeState(newMode);
		setApiMode(newMode);
		setError("");
		setIsExtensionError(false);
		onModeChange?.(newMode);
	};

	// Shared by the login and OTP forms: reads the server's error response and
	// picks a user-friendly message, flagging the "update extension" banner
	// when a 403 happens in live mode.
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
					// Clear invalid token to allow fresh login
					Cookies.remove(AUTH_COOKIE_NAME);
					Cookies.remove(STUDENT_ID_COOKIE_NAME);
				}
			};
			loadData();
		}
	}, [setAttendanceData]);

	// Saves the login cookies and loads the student's attendance data. Used by
	// both the direct-login path and the OTP path once either one has a token.
	const completeLogin = async (login: {
		token: string;
		username: string;
		password: string;
		rememberMe: boolean;
		studentId?: number | string;
	}) => {
		const { token, username: user, password, rememberMe, studentId } = login;

		// Always drop any studentId left over from a previous session before
		// possibly storing a fresh one below - otherwise a stale id can stick
		// around and get sent for the wrong account.
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

		// Login happens in up to two steps, because some accounts can skip the
		// OTP step entirely and some can't:
		//   1. Try a direct login. If it hands back a token, we're already done.
		//   2. Otherwise, fall back to the encrypted login, which starts the
		//      OTP flow (the user is then asked to enter a code).
		// If step 1 fails because the credentials are wrong, we stop there -
		// retrying with step 2 would just fail for the same reason. Any other
		// kind of failure (network error, server hiccup, etc.) falls through to
		// step 2 as a second attempt.

		// 1. Direct login. If the server returns a token we are done (no OTP
		// needed for this account).
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
			// Credentials explicitly rejected: no point retrying the OTP flow.
			if (
				axios.isAxiosError(directError) &&
				directError.response?.status === 400
			) {
				setError(
					getServerErrorReason(directError) || "Invalid Username or Password",
				);
				setLoading(false);
				return;
			}
		}

		// 2. Fallback: encrypted login, which may trigger an OTP challenge.
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

			submittedUsernameRef.current = enteredUser;
			submittedPasswordRef.current = enteredPass;
			submittedRememberMeRef.current = enteredRemember;
			setTransactionId(loginResponse.data.data.transactionId);
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
		<div className="flex flex-col mb-20 mt-20 items-center justify-center p-4">
			<div className="style-panel style-border w-full max-w-md bg-white p-8 style-fade-in">
				<div className="flex items-center justify-center mb-8">
					<BookOpen className="h-16 w-16 text-black transform -rotate-12" />
					<Sparkles className="h-8 w-8 text-black absolute translate-x-8 -translate-y-8" />
				</div>
				<h2 className="anga-text text-3xl font-black text-center text-black mb-6 transform -rotate-2">
					CyberVidya Attendance
				</h2>

				{/* Minimal connection toggle */}
				<div className="mb-6 flex flex-col items-center gap-1.5">
					<div className="relative grid grid-cols-2 w-64 bg-gray-200 border-2 border-black p-0.5 select-none">
						<button
							type="button"
							onClick={() => handleModeToggle("proxy")}
							className={`relative z-10 py-1.5 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer text-center ${
								apiMode === "proxy"
									? "text-white"
									: "text-black hover:text-gray-700"
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
									? "text-white"
									: "text-black hover:text-gray-700"
							}`}
							aria-pressed={apiMode === "live"}
						>
							Live ERP
						</button>

						{/* Sliding indicator */}
						<div
							className={`absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] bg-black transition-all duration-200 ease-in-out ${
								apiMode === "proxy" ? "left-0.5" : "left-[calc(50%+1px)]"
							}`}
						/>
					</div>

					<p className="text-[11px] text-gray-600 font-bold uppercase tracking-wider text-center">
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
							<PasswordInput ref={passwordRef} defaultValue={savedPassword} />
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
							<div className="relative style-text text-yellow-950 text-sm bg-yellow-100 p-2 style-border">
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
										className="mt-2 font-bold underline cursor-pointer hover:text-red-800"
									>
										View extension installation guide →
									</button>
								)}
							</div>
						)}
						<button
							type="submit"
							disabled={loading}
							className="w-full style-border style-text py-3 px-4 text-sm font-black text-white bg-black hover:bg-gray-800 focus:outline-none disabled:opacity-50 transform hover:-translate-y-1 transition-transform cursor-pointer"
						>
							{loading ? "Loading..." : "View Attendance"}
						</button>
					</form>
				) : (
					<form onSubmit={handleOtpSubmit} className="space-y-6">
						<div className="text-center text-gray-600">
							An OTP has been sent to your registered email address. Enter it
							below to continue.
						</div>
						<div>
							<label
								htmlFor="otp"
								className="style-text block text-sm font-bold text-black"
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
								className="mt-1 block w-full style-border rounded-none px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black"
								required
							/>
						</div>

						{error && (
							<div className="relative style-text text-red-600 text-sm bg-red-100 p-2 style-border">
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
										className="mt-2 font-bold underline cursor-pointer hover:text-red-800"
									>
										View extension installation guide →
									</button>
								)}
							</div>
						)}
						<button
							type="submit"
							disabled={loading}
							className="w-full style-border style-text py-3 px-4 text-sm font-black text-white bg-black hover:bg-gray-800 focus:outline-none disabled:opacity-50 transform hover:-translate-y-1 transition-transform cursor-pointer"
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
							className="w-full text-center text-sm text-gray-500 bg-none border-none p-0 cursor-pointer hover:text-gray-700 underline"
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
