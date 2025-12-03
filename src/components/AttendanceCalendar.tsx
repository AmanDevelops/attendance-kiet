import axios from "axios";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { LectureListProps } from "../types/response";

interface AttendanceCalendarProps {
	token: string;
	studentId: number;
	courses: {
		courseId: number;
		courseName: string;
		courseCode: string;
		components: {
			courseComponentId: number;
			componentName: string;
		}[];
	}[];
}

interface DayAttendance {
	date: string;
	status: "PRESENT" | "ABSENT" | "ADJUSTED" | "MIXED";
	classes: {
		courseName: string;
		componentName: string;
		timeSlot: string;
		attendance: "PRESENT" | "ABSENT" | "ADJUSTED";
	}[];
}

function AttendanceCalendar({
	token,
	studentId,
	courses,
}: AttendanceCalendarProps) {
	const [currentMonth, setCurrentMonth] = useState(new Date());
	const [attendanceMap, setAttendanceMap] = useState<
		Map<string, DayAttendance>
	>(new Map());
	const [loading, setLoading] = useState(true);
	const [selectedDay, setSelectedDay] = useState<DayAttendance | null>(null);

	useEffect(() => {
		const fetchAllAttendance = async () => {
			setLoading(true);
			const allLectures: {
				lecture: LectureListProps;
				courseName: string;
				componentName: string;
			}[] = [];

			for (const course of courses) {
				for (const component of course.components) {
					try {
						const response = await axios.post(
							"https://kiet.cybervidya.net/api/attendance/schedule/student/course/attendance/percentage",
							{
								courseCompId: component.courseComponentId,
								courseId: course.courseId,
								sessionId: null,
								studentId: studentId,
							},
							{
								headers: {
									"Content-Type": "application/json",
									Authorization: `GlobalEducation ${token}`,
								},
							},
						);

						if (response.data.data?.[0]?.lectureList) {
							for (const lecture of response.data.data[0].lectureList) {
								allLectures.push({
									lecture,
									courseName: course.courseName,
									componentName: component.componentName,
								});
							}
						}
					} catch (err) {
						console.error(
							`Failed to fetch attendance for ${course.courseName}`,
							err,
						);
					}
				}
			}

			const dayMap = new Map<string, DayAttendance>();

			for (const { lecture, courseName, componentName } of allLectures) {
				const dateKey = lecture.planLecDate.split("T")[0];

				if (!dayMap.has(dateKey)) {
					dayMap.set(dateKey, {
						date: dateKey,
						status: lecture.attendance,
						classes: [],
					});
				}

				const day = dayMap.get(dateKey)!;
				day.classes.push({
					courseName,
					componentName,
					timeSlot: lecture.timeSlot,
					attendance: lecture.attendance,
				});

				const statuses = day.classes.map((c) => c.attendance);
				const hasPresent = statuses.includes("PRESENT");
				const hasAbsent = statuses.includes("ABSENT");

				if (hasPresent && hasAbsent) {
					day.status = "MIXED";
				} else if (hasPresent) {
					day.status = "PRESENT";
				} else if (hasAbsent) {
					day.status = "ABSENT";
				}
			}

			setAttendanceMap(dayMap);
			setLoading(false);
		};

		fetchAllAttendance();
	}, [token, studentId, courses]);

	const getDaysInMonth = (date: Date) => {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const daysInMonth = lastDay.getDate();
		const startingDayOfWeek = firstDay.getDay();

		return { daysInMonth, startingDayOfWeek, year, month };
	};

	const { daysInMonth, startingDayOfWeek, year, month } =
		getDaysInMonth(currentMonth);

	const previousMonth = () => {
		setCurrentMonth(
			new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
		);
	};

	const nextMonth = () => {
		setCurrentMonth(
			new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
		);
	};

	const getDayColor = (day: number) => {
		const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		const dayData = attendanceMap.get(dateKey);

		if (!dayData) return "bg-gray-50 text-gray-400 border-2 border-gray-200";

		switch (dayData.status) {
			case "PRESENT":
			case "ADJUSTED":
				return "bg-gradient-to-br from-green-400 to-green-600 text-white font-bold shadow-md";
			case "ABSENT":
				return "bg-gradient-to-br from-red-400 to-red-600 text-white font-bold shadow-md";
			case "MIXED":
				return "bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold shadow-md";
			default:
				return "bg-gray-50 text-gray-400 border-2 border-gray-200";
		}
	};

	const handleDayClick = (day: number) => {
		const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		const dayData = attendanceMap.get(dateKey);
		if (dayData) {
			setSelectedDay(dayData);
		}
	};

	const monthName = currentMonth.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});

	const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

	return (
		<div className="bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-xl p-2.5 style-border style-fade-in max-w-xl mx-auto">
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center gap-1.5">
					<div className="p-0.5 bg-purple-100 rounded">
						<Calendar className="h-3.5 w-3.5 text-purple-600" />
					</div>
					<h3 className="style-text text-xs font-bold text-black">
						Attendance Calendar
					</h3>
				</div>
				<div className="flex items-center gap-0.5 bg-white rounded shadow-sm p-0.5 style-border">
					<button
						type="button"
						onClick={previousMonth}
						className="p-0.5 hover:bg-purple-50 rounded transition-all hover:scale-110 active:scale-95"
						aria-label="Previous month"
					>
						<ChevronLeft className="h-3 w-3 text-purple-600" />
					</button>
					<span className="text-[0.65rem] font-bold min-w-[90px] text-center px-1 text-gray-800">
						{monthName}
					</span>
					<button
						type="button"
						onClick={nextMonth}
						className="p-0.5 hover:bg-purple-50 rounded transition-all hover:scale-110 active:scale-95"
						aria-label="Next month"
					>
						<ChevronRight className="h-3 w-3 text-purple-600" />
					</button>
				</div>
			</div>

			{loading ? (
				<div className="text-center py-4">
					<div className="inline-block animate-spin rounded-full h-6 w-6 border-4 border-purple-200 border-t-purple-600" />
					<p className="text-gray-500 mt-2 font-medium text-[0.65rem]">Loading...</p>
				</div>
			) : (
				<>
					<div className="grid grid-cols-7 gap-0.5 mb-1">
						{weekDays.map((day) => (
							<div
								key={day}
								className="text-center text-[0.55rem] font-bold text-gray-700 py-0.5 uppercase"
							>
								{day}
							</div>
						))}
					</div>

					<div className="grid grid-cols-7 gap-1 mb-2">
						{Array.from({ length: startingDayOfWeek }).map((_, i) => (
							<div key={`empty-${i}`} />
						))}

						{Array.from({ length: daysInMonth }).map((_, i) => {
							const day = i + 1;
							const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
							const hasData = attendanceMap.has(dateKey);
							const dayData = attendanceMap.get(dateKey);
							const classCount = dayData?.classes.length || 0;

							return (
								<button
									key={day}
									type="button"
									onClick={() => hasData && handleDayClick(day)}
									disabled={!hasData}
									className={`aspect-square flex flex-col items-center justify-center rounded transition-all duration-200 ${getDayColor(day)} ${
										hasData
											? "cursor-pointer hover:scale-105 hover:shadow-lg hover:z-10 active:scale-95"
											: "cursor-default opacity-50"
									}`}
									title={hasData ? `${classCount} class${classCount !== 1 ? "es" : ""}` : "No classes"}
								>
									<span className="text-[0.65rem] font-bold">{day}</span>
									{hasData && (
										<span className="text-[0.45rem] opacity-80">
											{classCount}
										</span>
									)}
								</button>
							);
						})}
					</div>

					<div className="flex flex-wrap gap-1.5 text-[0.55rem] bg-white rounded p-1.5 style-border">
						<div className="flex items-center gap-0.5">
							<div className="w-2.5 h-2.5 bg-green-500 rounded shadow-sm" />
							<span className="font-semibold text-gray-700">Present</span>
						</div>
						<div className="flex items-center gap-0.5">
							<div className="w-2.5 h-2.5 bg-red-500 rounded shadow-sm" />
							<span className="font-semibold text-gray-700">Absent</span>
						</div>
						<div className="flex items-center gap-0.5">
							<div className="w-2.5 h-2.5 bg-yellow-500 rounded shadow-sm" />
							<span className="font-semibold text-gray-700">Mixed</span>
						</div>
						<div className="flex items-center gap-0.5">
							<div className="w-2.5 h-2.5 bg-gray-100 rounded shadow-sm border border-gray-300" />
							<span className="font-semibold text-gray-700">No Classes</span>
						</div>
					</div>
				</>
			)}

			{selectedDay && (
				<div className="fixed inset-0 bg-transparent backdrop-blur-[3px] flex items-center justify-center z-50 px-4">
					<div className="relative bg-white bg-opacity-90 backdrop-blur-md p-6 rounded-lg shadow-lg max-w-md w-full style-border">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-lg font-bold">
								{new Date(selectedDay.date).toLocaleDateString("en-US", {
									weekday: "long",
									month: "long",
									day: "numeric",
									year: "numeric",
								})}
							</h3>
							<button
								type="button"
								onClick={() => setSelectedDay(null)}
								className="text-red-500 hover:text-red-700"
							>
								<X className="h-6 w-6" />
							</button>
						</div>

						<div className="space-y-3 max-h-[400px] overflow-y-auto">
							{selectedDay.classes.map((cls, idx) => (
								<div
									key={idx}
									className="border-2 border-gray-200 rounded-lg p-3"
								>
									<div className="font-semibold text-sm text-gray-800">
										{cls.courseName}
									</div>
									<div className="text-xs text-gray-600 mt-1">
										{cls.componentName}
									</div>
									<div className="text-xs text-gray-500 mt-1">
										{cls.timeSlot}
									</div>
									<div
										className={`text-xs font-bold mt-2 ${
											cls.attendance === "PRESENT"
												? "text-green-600"
												: cls.attendance === "ADJUSTED"
													? "text-green-800"
													: "text-red-600"
										}`}
									>
										{cls.attendance}
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

export default AttendanceCalendar;
