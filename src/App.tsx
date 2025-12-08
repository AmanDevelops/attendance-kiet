import { useState } from "react";
import Attendance from "./components/Attendance";
import Footer from "./components/Footer";
import LoginForm from "./components/LoginForm";
import TnC from "./components/TnC";
import type { AttendanceResponse } from "./types/response";

function App() {
	const [attendanceData, setAttendanceData] =
		useState<AttendanceResponse | null>(null);

	const [isTnCVisible, setIsTnCVisible] = useState<boolean>(false);

	return (
		<div className="min-h-screen bg-gray-100">
			<div className="overflow-hidden m-auto bg-green-100">
				<div className="py-2 text-center text-sm font-medium text-green-600">
					YOUR CREDENTIALS ARE NEVER SHARED WITH US. THEY ARE SENT DIRECTLY TO
					CYBERVIDYA AND STORED LOCALLY.
					<a
						href="https://github.com/AmanDevelops/attendance-kiet"
						className="text-blue-400"
						target="_blank"
						rel="noopener"
					>
						{" "}
						VIEW SOURCE CODE
					</a>
				</div>
			</div>

			{!attendanceData ? (
				isTnCVisible ? (
					<TnC setIsPasswordVisible={setIsTnCVisible} />
				) : (
					<LoginForm
						setAttendanceData={setAttendanceData}
						setIsTnCVisible={setIsTnCVisible}
					/>
				)
			) : (
				<Attendance
					attendanceData={attendanceData}
					setAttendanceData={setAttendanceData}
				/>
			)}
			<Footer />
		</div>
	);
}

export default App;
