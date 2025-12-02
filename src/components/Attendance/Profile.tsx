import Cookies from "js-cookie";
import { LogOut, User, Wand2 } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import {
	AUTH_COOKIE_NAME,
	PASSWORD_COOKIE,
	REMEMBER_ME_COOKIE_NAME,
	USERNAME_COOKIE_NAME,
} from "../../types/constants";

interface ProfileProps {
	setShowProjection: React.Dispatch<React.SetStateAction<number>>;
	showProjection: number;
}

export default function Profile({
	setShowProjection,
	showProjection,
}: ProfileProps) {
	const { attendanceData, setAttendanceData } = useAppContext();

	function handleLogout(): void {
		Cookies.remove(AUTH_COOKIE_NAME);
		if (!Cookies.get(REMEMBER_ME_COOKIE_NAME)) {
			Cookies.remove(USERNAME_COOKIE_NAME);
			Cookies.remove(PASSWORD_COOKIE);
		}
		setAttendanceData(null);
	}

	if (!attendanceData) return null;

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
				</div>
			</div>

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
