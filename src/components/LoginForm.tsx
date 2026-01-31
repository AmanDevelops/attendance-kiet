import Cookies from "js-cookie";
import { BookOpen, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { AUTH_COOKIE_NAME } from "../types/constants";
import type { StudentDetails } from "../types/response";
import { fetchAttendanceData } from "../utils/LoginUtils";
import InstallExtensionPage from "./InstallExtensionPage";

function LoginForm({
	setIsTnCVisible,
}: {
	setIsTnCVisible: React.Dispatch<React.SetStateAction<boolean>>;
}) {
	const [error, setError] = useState<string>("");
	const [showInstallPage, setShowInstallPage] = useState<boolean>(false);
	const [isExtensionDetected, setIsExtensionDetected] =
		useState<boolean>(false);

	const { setAttendanceData } = useAppContext();

	useEffect(() => {
		const checkExtension = () => {
			if (document.getElementById("kiet-extension-installed")) {
				setIsExtensionDetected(true);
			}
		};

		checkExtension();
		const interval = setInterval(checkExtension, 1000); // Check periodically
		return () => clearInterval(interval);
	}, []);

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
					setError(error instanceof Error ? error.message : String(error));
				}
			};
			loadData();
		}
	}, [setAttendanceData]);

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
				<h2 className="anga-text text-3xl font-black text-center text-black mb-8 transform -rotate-2">
					CyberVidya Attendance
				</h2>

				<div className="space-y-6">
					<div className="text-center text-gray-600 mb-6">
						Please sign in using the official Kiet ERP portal to securely access
						your attendance.
					</div>

					<button
						type="button"
						onClick={() => {
							if (isExtensionDetected) {
								window.location.href = "https://kiet.cybervidya.net/";
							} else {
								setShowInstallPage(true);
							}
						}}
						className="w-full style-border style-text py-4 px-4 text-base font-black text-white bg-black hover:bg-gray-800 focus:outline-none transform hover:-translate-y-1 transition-transform cursor-pointer flex items-center justify-center gap-2 shadow-lg"
					>
						Sign in with ERP
						{!isExtensionDetected && (
							<span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
								Not Detected
							</span>
						)}
					</button>

					{error && (
						<p className="style-text text-red-600 text-sm bg-red-100 p-2 style-border">
							{error}
						</p>
					)}

					<div className="text-center text-sm">
						By signing in, you agree to our{" "}
						<button
							type="button"
							onClick={() => setIsTnCVisible((prev) => !prev)}
							className="text-gray-500 bg-none border-none p-0 cursor-pointer hover:text-gray-700 underline"
						>
							Terms of Service and Privacy Policy
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default LoginForm;
