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
				}
			};
			loadData();
		}
	}, [setAttendanceData]);

	const handleCredentialsSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		setIsExtensionError(false);

		try {
			const loginResponse = await axios.post<EncryptLoginResponse>(
				`${getBaseUrl()}/api/auth/encrypt/login`,
				{
					userName: encryptPassword(usernameRef.current?.value || ""),
					password: encryptPassword(passwordRef.current?.value || ""),
					device: "WEB",
					version: null,
					reCaptchaToken: null,
				},
			);

			submittedUsernameRef.current = usernameRef.current?.value || "";
			submittedPasswordRef.current = passwordRef.current?.value || "";
			submittedRememberMeRef.current = rememberMeRef.current?.checked || false;
			setTransactionId(loginResponse.data.data.transactionId);
			setStep("otp");
		} catch (loginError) {
			const serverReason = getServerErrorReason(loginError);
			if (
				axios.isAxiosError(loginError) &&
				loginError.response?.status === 400
			) {
				setError(serverReason || "Invalid Username or Password");
			} else if (
				axios.isAxiosError(loginError) &&
				loginError.response?.status === 403
			) {
				if (apiMode === "live") {
					setError("Please Update the Extension to the latest version 3.6!");
					setIsExtensionError(true);
				} else {
					setError(
						serverReason ||
							"Access forbidden. Please check your credentials or try again.",
					);
					setIsExtensionError(false);
				}
			} else {
				setError(
					"Login failed. The server isn’t responding or your internet connection may be unavailable.",
				);
			}
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

			token = otpResponse.data.data.token;
		} catch (otpError) {
			const serverReason = getServerErrorReason(otpError);
			if (axios.isAxiosError(otpError) && otpError.response?.status === 400) {
				setError(serverReason || "Invalid or expired OTP");
			} else if (
				axios.isAxiosError(otpError) &&
				otpError.response?.status === 403
			) {
				if (apiMode === "live") {
					setError("Please Update the Extension to the latest version 3.6!");
					setIsExtensionError(true);
				} else {
					setError(serverReason || "Invalid or expired OTP");
					setIsExtensionError(false);
				}
			} else {
				setError(
					"OTP verification failed. The server isn’t responding or your internet connection may be unavailable.",
				);
			}
			setLoading(false);
			return;
		}

		if (username !== submittedUsernameRef.current) {
			Cookies.remove(STUDENT_ID_COOKIE_NAME);
		}

		Cookies.set(AUTH_COOKIE_NAME, token, { expires: 1 / 24 });
		Cookies.set(USERNAME_COOKIE_NAME, submittedUsernameRef.current, {
			expires: COOKIE_EXPIRY,
		});
		Cookies.set(
			REMEMBER_ME_COOKIE_NAME,
			submittedRememberMeRef.current.toString(),
			{
				expires: COOKIE_EXPIRY,
			},
		);

		if (submittedRememberMeRef.current) {
			Cookies.set(PASSWORD_COOKIE_NAME, submittedPasswordRef.current, {
				expires: COOKIE_EXPIRY,
			});
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
