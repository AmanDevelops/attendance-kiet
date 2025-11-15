import Cookies from "js-cookie";
import { X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import {
	AUTH_COOKIE_NAME,
	COOKIE_EXPIRY,
	STUDENT_ID_COOKIE,
} from "../types/CookieVars";
import type { AttendanceResponse } from "../types/response";
import { fetchStudentId } from "../types/utils";
import CourseCard from "./Attendance/CourseCard";
import Profile from "./Attendance/Profile";
import Projections from "./Attendance/Projections";
import DaywiseReport from "./Daywise";
import OverallAtt from "./OverallAtt";

export interface SelectedComponentType {
	course: AttendanceResponse["data"]["attendanceCourseComponentInfoList"][0];
	component: AttendanceResponse["data"]["attendanceCourseComponentInfoList"][0]["attendanceCourseComponentNameInfoList"][0];
}

type AttendanceHook = {
	attendanceData: AttendanceResponse;
	setAttendanceData: React.Dispatch<
		React.SetStateAction<AttendanceResponse | null>
	>;
};

export const TARGET_PERCENTAGE = 75;

function Attendance({ attendanceData, setAttendanceData }: AttendanceHook) {
	const [studentId, setStudentId] = useState<number | null>(null);

	const [selectedComponent, setSelectedComponent] =
		useState<SelectedComponentType | null>(null);
	const [isDaywiseModalOpen, setIsDaywiseModalOpen] = useState(false);

	const [showProjection, setShowProjection] = useState<number>(0);

	function handleViewDaywiseAttendance(
		course: SelectedComponentType["course"],
		component: SelectedComponentType["component"],
	) {
		setSelectedComponent({ course, component });
		setIsDaywiseModalOpen(true);
	}

	useEffect(() => {
		if (isDaywiseModalOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "auto";
		}
	}, [isDaywiseModalOpen]);

	useEffect(() => {
		const token = Cookies.get(AUTH_COOKIE_NAME) || "";
		const cookieId = Cookies.get(STUDENT_ID_COOKIE) || "";

		if (cookieId) {
			setStudentId(Number(cookieId));
		} else if (token) {
			fetchStudentId(token).then((id) => {
				if (id) {
					Cookies.set(STUDENT_ID_COOKIE, String(id), {
						expires: COOKIE_EXPIRY,
					});
					setStudentId(id);
				}
			});
		}

		//  Scroll to the top after login
		window.scrollTo({ top: 0, behavior: "instant" });
	}, []);

	return (
		<div className="container mx-auto px-4 py-8 grow">
			<div className="bg-white rounded-lg shadow-md p-4 mb-8 style-border style-fade-in">
				<div className="flex flex-col  gap-4">
					<Profile
						attendanceData={attendanceData}
						setAttendanceData={setAttendanceData}
						setShowProjection={setShowProjection}
						showProjection={showProjection}
					/>
				</div>
			</div>
			<div className={`${showProjection % 2 === 1 ? "block" : "hidden"}`}>
				{showProjection > 0 && <Projections />}
			</div>
			<div className={`${showProjection % 2 === 1 ? "hidden" : "block"}`}>
				<OverallAtt />
			</div>

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{attendanceData.data.attendanceCourseComponentInfoList.map((course) => (
					<CourseCard
						key={course.courseCode}
						onViewDaywiseAttendance={handleViewDaywiseAttendance}
						course={course}
					/>
				))}
			</div>

			{/*  Modal to Show Daywise Attendance */}
			{isDaywiseModalOpen && selectedComponent && (
				<div className="fixed inset-0 bg-transparent backdrop-blur-[3px]  flex items-center justify-center z-50 px-4">
					<div className="relative bg-white bg-opacity-90 backdrop-blur-md p-4 rounded-lg shadow-lg max-w-3xl w-full style-border">
						<div className="flex justify-between items-center mb-4 ">
							<h2 className="text-lg">
								Daywise Attendance for{" "}
								<span className="font-bold">
									{selectedComponent.course.courseName} -{" "}
									{selectedComponent.component.componentName}
								</span>
							</h2>

							<button
								type="button"
								className="text-red-500 text-xl font-bold cursor-pointer"
								onClick={() => setIsDaywiseModalOpen(false)}
							>
								<X />
							</button>
						</div>

						<DaywiseReport
							token={Cookies.get(AUTH_COOKIE_NAME) || ""}
							payload={{
								courseCompId: selectedComponent.component.courseComponentId,
								courseId: selectedComponent.course.courseId,
								sessionId: null,
								studentId: studentId || 0,
							}}
						/>
					</div>
				</div>
			)}
		</div>
	);
}

export default Attendance;
