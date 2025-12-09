import Cookies from "js-cookie";
import { X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import {
	AUTH_COOKIE_NAME,
	COOKIE_EXPIRY,
	STUDENT_ID_COOKIE_NAME,
} from "../types/constants";
import type {
	AttendanceComponentInfo,
	CourseAttendanceInfo,
} from "../types/response";
import { fetchStudentId, getWeekRange } from "../types/utils";
import AttendanceCalendar from "./AttendanceCalendar";
import CourseCard from "./Attendance/CourseCard";
import Profile from "./Attendance/Profile";
import Projections from "./Attendance/Projections";

import DaywiseReport from "./Daywise";
import OverallAtt from "./OverallAtt";

export interface SelectedComponentType {
	course: CourseAttendanceInfo;
	component: AttendanceComponentInfo;
}

function Attendance() {
	const { attendanceData } = useAppContext();
	const [studentId, setStudentId] = useState<number | null>(() => {
		const cookieStudentId = Cookies.get(STUDENT_ID_COOKIE_NAME);
		return cookieStudentId ? Number(cookieStudentId) : null;
	});

	const [selectedComponent, setSelectedComponent] =
		useState<SelectedComponentType | null>(null);
	const [isDaywiseModalOpen, setIsDaywiseModalOpen] = useState(false);
	const [showCalendar, setShowCalendar] = useState(false);

	const [showProjection, setShowProjection] = useState<number>(0);

	const handleViewDaywiseAttendance = useCallback(
		(
			course: SelectedComponentType["course"],
			component: SelectedComponentType["component"],
		) => {
			setSelectedComponent({ course, component });
			setIsDaywiseModalOpen(true);
		},
		[],
	);

	useEffect(() => {
		if (isDaywiseModalOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "auto";
		}
	}, [isDaywiseModalOpen]);

	useEffect(() => {
		//  Scroll to the top after login
		window.scrollTo({ top: 0, behavior: "instant" });
	}, []);

	useEffect(() => {
		if (studentId === null) {
			const token = Cookies.get(AUTH_COOKIE_NAME) || "";

			if (token) {
				fetchStudentId(token).then((id) => {
					if (id) {
						setStudentId(id);
						Cookies.set(STUDENT_ID_COOKIE_NAME, String(id), {
							expires: COOKIE_EXPIRY,
						});
					}
				});
			}
		}
	}, [studentId]);

	if (!attendanceData) return null;

	return (
		<div className="container mx-auto px-4 py-8 grow">
			<div className="bg-white rounded-lg shadow-md p-4 mb-8 style-border style-fade-in">
				<div className="flex flex-col  gap-4">

					<div className="flex items-center sm:gap-4 justify-between">
						<div className="flex items-center gap-responsive">
							<User className="h-14 w-14" />{" "}
							<div className="flex flex-col">
								<h1 className="text-xl font-black text-black mb-1 style-text">
									{attendanceData.data.fullName}
								</h1>
								<p className="text-xs text-black font-semibold style-text mb-0.5">
									{attendanceData.data.registrationNumber} |{" "}
									{attendanceData.data.branchShortName} - Section{" "}
									{attendanceData.data.sectionName}
								</p>
								<p className="text-xs text-black font-semibold style-text">
									{attendanceData.data.degreeName} | Semester{" "}
									{attendanceData.data.semesterName}
								</p>
							</div>
						</div>

						<div className="flex flex-col md:flex-row gap-2 self-start md:self-auto">
							<button
								type="button"
								onClick={() => setShowCalendar((prev) => !prev)}
								className="style-border style-text py-2 px-2 text-xs font-bold flex items-center gap-responsive text-purple-600 bg-purple-50 hover:bg-purple-100 focus:outline-none transform hover:-translate-y-1 transition-transform w-auto"
							>
								<CalendarDays className="h-4 w-4 flex-shrink-0" />
								<span className="hide-text-below-352 text-xs">
									{showCalendar ? "Hide Calendar" : "Show Calendar"}
								</span>
							</button>

							<button
								type="button"
								onClick={() => setShowProjection((prev) => !prev)}
								className="style-border style-text py-2 px-2 text-xs font-bold flex items-center gap-responsive text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none transform hover:-translate-y-1 transition-transform w-auto"
							>
								<Wand2 className="h-4 w-4 flex-shrink-0" />
								<span className="hide-text-below-352 text-xs">
									{showProjection ? "Hide Projection" : "Show Projection"}
								</span>
							</button>

							<button
								type="button"
								onClick={handleLogout}
								className="style-border style-text py-2 px-1.5 sm:px-3 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black transform transition-transform duration-300 hover:-translate-y-1 focus:outline-none hover:transition-all hover:duration-300 w-auto"
							>
								<LogOut className="h-4 w-4 flex-shrink-0" />
								<span className="hide-text-below-352">Logout</span>
							</button>
						</div>
					</div>

					<Profile
						setShowProjection={setShowProjection}
						showProjection={showProjection}
					/>

				</div>
			</div>
			<div>
				<div className={`${showProjection % 2 === 1 ? "block" : "hidden"}`}>
					{showProjection > 0 && <Projections />}
				</div>

			)}
			{showCalendar && studentId && (
				<div className="mb-8">
					<AttendanceCalendar
						token={Cookies.get(AUTH_COOKIE_NAME) || ""}
						studentId={studentId}
						courses={attendanceData.data.attendanceCourseComponentInfoList.map(
							(course) => ({
								courseId: course.courseId,
								courseName: course.courseName,
								courseCode: course.courseCode,
								components: course.attendanceCourseComponentNameInfoList.map(
									(comp) => ({
										courseComponentId: comp.courseComponentId,
										componentName: comp.componentName,
									}),
								),
							}),
						)}
					/>
				</div>
			)}

			<div className={`${showProjection || showCalendar ? "hidden" : "block"}`}>

				<OverallAtt />
			</div>

			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{attendanceData.attendanceCourseComponentInfoList.map((course) => (
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
