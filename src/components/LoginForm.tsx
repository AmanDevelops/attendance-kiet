import axios from "axios";
import Cookies from "js-cookie";
import { BookOpen, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import {
	AUTH_COOKIE_NAME,
	COOKIE_EXPIRY,
	PASSWORD_COOKIE,
	REMEMBER_ME_COOKIE_NAME,
	USERNAME_COOKIE_NAME,
} from "../types/constants";
import type { LoginResponse } from "../types/response";
import PasswordInput from "../ui/PasswordInput";
import { fetchAttendanceData } from "../utils/LoginUtils";

function LoginForm() {
	const [username] = useState<string>(
		() => Cookies.get(USERNAME_COOKIE_NAME) || "",
	); // Used ONLY ONCE during the initial render
	const [password] = useState<string>(() => Cookies.get(PASSWORD_COOKIE) || "");
	const [rememberMe] = useState<boolean>(
		() => Cookies.get(REMEMBER_ME_COOKIE_NAME) === "true",
	);

	const usernameRef = useRef<HTMLInputElement>(null);
	const passwordRef = useRef<HTMLInputElement>(null);
	const rememberMeRef = useRef<HTMLInputElement>(null);

	const [error, setError] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);

	const { setAttendanceData } = useAppContext();

	useEffect(() => {
		const token = Cookies.get(AUTH_COOKIE_NAME);

		if (token) {
			const loadData = async () => {
				try {
					const data = await fetchAttendanceData(token);
					setAttendanceData(data);
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				}
			};
			loadData();
		}
	}, [setAttendanceData]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError("");
		try {
			const loginResponse = await axios.post<LoginResponse>(
				"https://kiet.cybervidya.net/api/auth/login",
				{
					userName: usernameRef.current?.value,
					password: passwordRef.current?.value,
				},
			);

			const token = loginResponse.data.data.token;

			Cookies.set(USERNAME_COOKIE_NAME, usernameRef.current?.value || "", {
				expires: COOKIE_EXPIRY,
			});
			Cookies.set(
				REMEMBER_ME_COOKIE_NAME,
				rememberMeRef.current?.checked?.toString() || "false",
				{
					expires: COOKIE_EXPIRY,
				},
			);

			Cookies.set(AUTH_COOKIE_NAME, token, {
				expires: 1 / 24, // one hour
			});

			if (rememberMeRef.current?.checked) {
				Cookies.set(PASSWORD_COOKIE, passwordRef.current?.value || "", {
					expires: COOKIE_EXPIRY,
				});
			} else {
				Cookies.remove(PASSWORD_COOKIE);
			}

			if (token) {
				try {
					const data = await fetchAttendanceData(token);
					setAttendanceData(data);
				} catch (error) {
					setError(error instanceof Error ? error.message : String(error));
				}
			}
		} catch (_err: unknown) {
			setError(
				"Failed to fetch attendance data. Please check your credentials.",
			);
		} finally {
			setLoading(false);
		}
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
						<PasswordInput ref={passwordRef} defaultValue={password} />
					</div>
					<div className="flex items-center">
						<input
							id="remember-me"
							type="checkbox"
							defaultChecked={rememberMe}
							ref={rememberMeRef}
							className="h-5 w-5 style-border rounded"
						/>
						<label
							htmlFor="remember-me"
							className="ml-2 block style-text-sm font-bold text-black"
						>
							Remember me
						</label>
					</div>
					<div>
						By clicking <i>'View Attendance'</i>, you agree to Cybervidya’s{" "}
						<a
							href="https://cybervidya.net/privacy-policy"
							className="text-gray-500"
						>
							Privacy Policy.
						</a>
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
