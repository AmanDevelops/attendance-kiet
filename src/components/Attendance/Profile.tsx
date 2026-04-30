import Cookies from "js-cookie";
import { Calendar, LogOut, User, Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import {
	AUTH_COOKIE_NAME,
	STUDENT_ID_COOKIE_NAME,
} from "../../types/constants";
import {
	getSavedWhatsappNumber,
	saveWhatsappNumber,
} from "../../utils/notifications";
import { exportSemesterICS } from "../CalendarExport";

interface ProfileProps {
	setShowProjection: React.Dispatch<React.SetStateAction<number>>;
	showProjection: number;
}

export default function Profile({
	setShowProjection,
	showProjection,
}: ProfileProps) {
	const { attendanceData, setAttendanceData } = useAppContext();

	const [calendarLoading, setCalendarLoading] = useState(false);
	const [calendarError, setCalendarError] = useState("");
	const [whatsappNumber, setWhatsappNumber] = useState("");
	const [whatsappSavedMsg, setWhatsappSavedMsg] = useState("");

	function handleLogout(): void {
		Cookies.remove(AUTH_COOKIE_NAME);
		Cookies.remove(STUDENT_ID_COOKIE_NAME);
		setAttendanceData(null);
	}

	useEffect(() => {
		if (!attendanceData) return;
		const savedNumber = getSavedWhatsappNumber(
			attendanceData.registrationNumber,
		);
		if (savedNumber) {
			setWhatsappNumber(savedNumber);
		}
	}, [attendanceData]);

	if (!attendanceData) return null;

	async function handleCalendarExport() {
		const token = Cookies.get(AUTH_COOKIE_NAME);
		const studentId = Cookies.get(STUDENT_ID_COOKIE_NAME);

		if (!token || !studentId) {
			console.error("Missing token or studentId");
			setCalendarError("Authentication failed. Please login again.");
			return;
		}

		setCalendarLoading(true);
		setCalendarError("");

		try {
			await exportSemesterICS();
		} catch (err: unknown) {
			console.error(err);
			setCalendarError("Failed to export calendar. Please try again later.");
		} finally {
			setCalendarLoading(false);
		}
	}

	function handleSaveWhatsappNumber() {
		if (!attendanceData) return;
		const digitsOnly = whatsappNumber.replace(/\D/g, "");
		if (digitsOnly.length !== 10) {
			setWhatsappSavedMsg("Enter a valid 10-digit WhatsApp number.");
			return;
		}

		saveWhatsappNumber(attendanceData.registrationNumber, digitsOnly);
		setWhatsappNumber(digitsOnly);
		setWhatsappSavedMsg("WhatsApp number saved for absence alerts.");
	}

	return (
		<div className="flex items-center sm:gap-4 justify-between">
			<div className="flex items-center gap-responsive">
				<User className="h-14 w-14" />{" "}
				<div className="flex flex-col">
					<h1 className="text-xl font-black text-black mb-1 style-text">
						{attendanceData.fullName}
					</h1>
					<p className="text-xs text-black font-semibold style-text mb-0.5">
						{attendanceData.registrationNumber} |{" "}
						{attendanceData.branchShortName} - Section{" "}
						{attendanceData.sectionName}
					</p>
					<p className="text-xs text-black font-semibold style-text">
						{attendanceData.degreeName} | Semester {attendanceData.semesterName}
					</p>
					<div className="mt-2 flex flex-col gap-1">
						<div className="flex gap-2">
							<input
								type="tel"
								value={whatsappNumber}
								onChange={(event) => {
									setWhatsappSavedMsg("");
									setWhatsappNumber(event.target.value);
								}}
								placeholder="WhatsApp number (10 digits)"
								maxLength={10}
								className="style-border px-2 py-1 text-xs"
							/>
							<button
								type="button"
								onClick={handleSaveWhatsappNumber}
								className="style-border px-2 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100"
							>
								Save
							</button>
						</div>
						{whatsappSavedMsg && (
							<p className="text-[11px] text-gray-700">{whatsappSavedMsg}</p>
						)}
					</div>
				</div>
			</div>
			{calendarError && (
				<p className="text-red-600 text-l mt-2">{calendarError}</p>
			)}
			<div className="flex flex-col md:flex-row gap-2 self-start md:self-auto">
				<button
					type="button"
					onClick={() => setShowProjection((prev) => prev + 1)}
					className="style-border style-text py-2 px-2 text-xs font-bold flex items-center gap-responsive text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none transform hover:-translate-y-1 transition-transform w-auto"
				>
					<Wand2 className="h-4 w-4 shrink-0" />
					<span className="hide-text-below-352 text-xs">
						{showProjection ? "Hide Projection" : "Show Projection"}
					</span>
				</button>

				<button
					type="button"
					onClick={handleCalendarExport}
					disabled={calendarLoading}
					className="style-border style-text py-2 px-2 text-xs font-bold flex items-center gap-responsive text-blue-600 bg-blue-50 hover:bg-blue-100 transition-transform hover:-translate-y-1 disabled:opacity-50"
				>
					<Calendar className="h-4 w-4 shrink-0" />
					<span className="hide-text-below-352 text-xs">
						{calendarLoading ? "Exporting..." : "Add to Calendar"}
					</span>
				</button>

				<button
					type="button"
					onClick={handleLogout}
					className="style-border style-text py-2 px-1.5 sm:px-3 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black transform transition-transform duration-300 hover:-translate-y-1 focus:outline-none hover:transition-all hover:duration-300 w-auto"
				>
					<LogOut className="h-4 w-4 shrink-0" />
					<span className="hide-text-below-352">Logout</span>
				</button>
			</div>
		</div>
	);
}
