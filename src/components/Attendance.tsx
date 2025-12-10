import axios from "axios";
import Cookies from "js-cookie";
import {
	AlertTriangle,
	CalendarDays,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	LogOut,
	Target,
	User,
	Wand2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
	AUTH_COOKIE_NAME,
	PASSWORD_COOKIE,
	REMEMBER_ME_COOKIE,
	USERNAME_COOKIE,
} from "../types/CookieVars";
import type {
	AttendanceResponse,
	ScheduleEntry,
	ScheduleResponse,
} from "../types/response";
import { fetchStudentId, getWeekRange } from "../types/utils";
import AttendanceCalendar from "./AttendanceCalendar";
import DaywiseReport from "./Daywise";
import OverallAtt from "./OverallAtt";

// Define the type for the specific objects passed to the daywise modal
interface SelectedComponentType {
	course: AttendanceResponse["data"]["attendanceCourseComponentInfoList"][0];
	component: AttendanceResponse["data"]["attendanceCourseComponentInfoList"][0]["attendanceCourseComponentNameInfoList"][0];
}

type CourseComponentList =
	AttendanceResponse["data"]["attendanceCourseComponentInfoList"][0]["attendanceCourseComponentNameInfoList"];

type AttendanceHook = {
	attendanceData: AttendanceResponse;
	setAttendanceData: React.Dispatch<
		React.SetStateAction<AttendanceResponse | null>
	>;
};

const TARGET_PERCENTAGE = 75;
const COMBINED_COMPONENT_ID = -1;
const GOALS_STORAGE_KEY = "attendance_goals";

function calculateAttendanceProjection(
	present: number,
	total: number,
	percent: number,
) {
	if (total === 0) {
		return { status: "safe", message: "No classes held yet." };
	}
	const currentPercentage = (present / total) * 100;

	if (currentPercentage >= percent) {
		const canMiss = Math.floor(
			(present - (percent / 100) * total) / (percent / 100),
		);
		return {
			status: "safe",
			message:
				canMiss > 0
					? `You can miss ${canMiss} class${canMiss === 1 ? "" : "es"} only`
					: "Try not to miss any more classes",
		};
	} else {
		if (percent === 100) {
			return {
				status: "warning",
				message: "Need to attend all future classes.",
			};
		}
		const needToAttend = Math.ceil(
			((percent / 100) * total - present) / (1 - percent / 100),
		);
		return {
			status: "warning",
			message: `Need to attend next ${needToAttend} class${
				needToAttend === 1 ? "" : "es"
			}`,
		};
	}
}

function processCourseData(
	courses: AttendanceResponse["data"]["attendanceCourseComponentInfoList"],
) {
	return courses.map((course) => {
		const components = course.attendanceCourseComponentNameInfoList;

		if (components.length > 1) {
			const totalPresent = components.reduce(
				(sum, c) => sum + c.numberOfPresent + c.numberOfExtraAttendance,
				0,
			);
			const totalPeriods = components.reduce(
				(sum, c) => sum + c.numberOfPeriods,
				0,
			);
			const percentage =
				totalPeriods > 0 ? (totalPresent / totalPeriods) * 100 : 0;

			const combined = {
				componentName: "AVERAGE (ALL COMPONENTS)",
				numberOfPresent: totalPresent,
				numberOfPeriods: totalPeriods,
				numberOfExtraAttendance: 0,
				presentPercentage: percentage,
				presentPercentageWith: `${percentage.toFixed(2)}%`,
				courseComponentId: COMBINED_COMPONENT_ID,
			};

			return {
				...course,
				attendanceCourseComponentNameInfoList: [
					combined,
				] as CourseComponentList,
			};
		} else if (components.length > 0) {
			const c = components[0];
			const present = c.numberOfPresent + c.numberOfExtraAttendance;
			const percentage =
				c.numberOfPeriods > 0 ? (present / c.numberOfPeriods) * 100 : 0;
			return {
				...course,
				attendanceCourseComponentNameInfoList: [
					{
						...c,
						presentPercentage: percentage,
						presentPercentageWith: `${percentage.toFixed(2)}%`,
					},
				],
			};
		}
		return course;
	});
}

function Attendance({ attendanceData, setAttendanceData }: AttendanceHook) {
	const [studentId, setStudentId] = useState<number | null>(null);
	function handleLogout(): void {
		Cookies.remove(AUTH_COOKIE_NAME);
		if (!Cookies.get(REMEMBER_ME_COOKIE)) {
			Cookies.remove(USERNAME_COOKIE);
			Cookies.remove(PASSWORD_COOKIE);
		}
		setAttendanceData(null);
	}

	const [selectedComponent, setSelectedComponent] =
		useState<SelectedComponentType | null>(null);
	const [isDaywiseModalOpen, setIsDaywiseModalOpen] = useState(false);
	const [showCalendar, setShowCalendar] = useState(false);

	const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
	const [missedClasses, setMissedClasses] = useState<Set<string>>(new Set());
	const [showProjection, setShowProjection] = useState(false);
	const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

	// Goals state
	const [goals, setGoals] = useState<Record<string, number>>({});
	const [editingGoal, setEditingGoal] = useState<string | null>(null);
	const [tempGoalValue, setTempGoalValue] = useState<string>("");

	const overallAttendance = useMemo(() => {
		if (!attendanceData) {
			return { present: 0, total: 0, percentage: 0 };
		}
		let totalPresent = 0;
		let totalPeriods = 0;
		attendanceData.data.attendanceCourseComponentInfoList.forEach((course) => {
			course.attendanceCourseComponentNameInfoList.forEach((component) => {
				totalPresent +=
					component.numberOfPresent + component.numberOfExtraAttendance;
				totalPeriods += component.numberOfPeriods;
			});
		});
		const percentage =
			totalPeriods > 0 ? (totalPresent / totalPeriods) * 100 : 0;
		return { present: totalPresent, total: totalPeriods, percentage };
	}, [attendanceData]);

	const projectionAdjustments = useMemo(() => {
		const adjustments = {
			overall: 0,
			byCourseCode: new Map<string, number>(),
		};

		const todayStr = new Date().toLocaleDateString("en-GB", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
		});

		missedClasses.forEach((classStartString) => {
			const missedClass = schedule.find((c) => c.start === classStartString);

			if (missedClass && missedClass.lectureDate >= todayStr) {
				adjustments.overall += 1;
				const count = adjustments.byCourseCode.get(missedClass.courseCode) || 0;
				adjustments.byCourseCode.set(missedClass.courseCode, count + 1);
			}
		});
		return adjustments;
	}, [schedule, missedClasses]);

	const groupedSchedule = useMemo(() => {
		const grouped = new Map<string, ScheduleEntry[]>();
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		schedule
			.filter((c) => c.type === "CLASS")
			.sort(
				(a, b) =>
					new Date(
						a.start.split(" ")[0].split("/").reverse().join("-") +
							"T" +
							a.start.split(" ")[1],
					).getTime() -
					new Date(
						b.start.split(" ")[0].split("/").reverse().join("-") +
							"T" +
							b.start.split(" ")[1],
					).getTime(),
			)
			.forEach((c) => {
				const [day, month, year] = c.lectureDate.split("/").map(Number);
				const classDate = new Date(year, month - 1, day);

				if (classDate >= today) {
					const dayName = classDate.toLocaleDateString("en-US", {
						weekday: "long",
						month: "short",
						day: "numeric",
					});
					if (!grouped.has(dayName)) {
						grouped.set(dayName, []);
					}
					grouped.get(dayName)?.push(c);
				}
			});
		return grouped;
	}, [schedule]);

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
		fetchStudentId(token).then((id) => {
			if (id) setStudentId(id);
		});

		// Load saved goals from localStorage
		const savedGoals = localStorage.getItem(GOALS_STORAGE_KEY);
		if (savedGoals) {
			setGoals(JSON.parse(savedGoals));
		}

		//  Scroll to the top after login
		window.scrollTo({ top: 0, behavior: "instant" });
	}, []);

	useEffect(() => {
		const fetchSchedule = async () => {
			const token = Cookies.get(AUTH_COOKIE_NAME);
			if (token) {
				try {
					const { startDate, endDate } = getWeekRange();
					const scheduleResponse = await axios.get<ScheduleResponse>(
						`https://kiet.cybervidya.net/api/student/schedule/class?weekEndDate=${endDate}&weekStartDate=${startDate}`,
						{ headers: { Authorization: `GlobalEducation ${token}` } },
					);
					setSchedule(scheduleResponse.data.data);
				} catch (err) {
					console.error("Failed to fetch schedule", err);
				}
			}
		};

		if (showProjection && schedule.length === 0) {
			fetchSchedule();
		}
		console.log(schedule);
	}, [showProjection, schedule]);

	const handleMissClassToggle = (classStartString: string) => {
		setMissedClasses((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(classStartString)) {
				newSet.delete(classStartString);
			} else {
				newSet.add(classStartString);
			}
			return newSet;
		});
	};

	const handleDayToggle = (classStarts: string[], dayIsSelected: boolean) => {
		setMissedClasses((prev) => {
			const newSet = new Set(prev);
			if (dayIsSelected) {
				for (const start of classStarts) newSet.delete(start);
			} else {
				for (const start of classStarts) newSet.add(start);
			}
			return newSet;
		});
	};

	// Goal management functions
	const handleSetGoal = (courseCode: string, target: number) => {
		const newGoals = { ...goals, [courseCode]: target };
		setGoals(newGoals);
		localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(newGoals));
		setEditingGoal(null);
		setTempGoalValue("");
	};

	const handleRemoveGoal = (courseCode: string) => {
		const newGoals = { ...goals };
		delete newGoals[courseCode];
		setGoals(newGoals);
		localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(newGoals));
	};

	const overallMissed = projectionAdjustments.overall;

	const projectedOverallTotal = overallAttendance.total + overallMissed;
	const projectedOverallPercent =
		projectedOverallTotal > 0
			? (overallAttendance.present / projectedOverallTotal) * 100
			: 0;

	// The 'currentOverallProjection' variable is intentionally removed as it was unused.

	return (
		<div className="container mx-auto px-4 py-8 flex-grow">
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
				</div>
			</div>
			{showProjection && (
				<div className="bg-white rounded-lg shadow-md p-6 mb-4 style-border style-fade-in">
					<div className="flex items-center gap-2 mb-4">
						<CalendarDays className="h-6 w-6 text-blue-600" />
						<h3 className="style-text text-md font-semibold text-black">
							Weekly Projection (Today Onwards)
						</h3>
					</div>
					<p className="style-text text-xs text-gray-600 mb-4">
						Select classes you plan to miss:
					</p>

					<div className="max-h-64 overflow-y-auto space-y-4 pr-2">
						{groupedSchedule.size === 0 && (
							<p className="style-text text-gray-500">
								No upcoming classes found for the rest of the week.
							</p>
						)}

						{Array.from(groupedSchedule.entries()).map(([day, classes]) => {
							const isExpanded = expandedDays.has(day);
							const allDayClasses = classes.map((c) => c.start);
							const allDaySelected = allDayClasses.every((start) =>
								missedClasses.has(start),
							);

							return (
								<div key={day} className=" mb-3 gap-2 transition-all ">
									{/* Header that toggles the day */}

									<button
										type="button"
										onClick={() => {
											setExpandedDays((prev) => {
												const newSet = new Set(prev);
												if (newSet.has(day)) {
													newSet.delete(day);
												} else {
													newSet.add(day);
												}
												return newSet;
											});
										}}
										aria-expanded={isExpanded}
										className="group w-full flex justify-between items-center cursor-pointer style-border style-text hover:text-white hover:bg-black transform transition-transform duration-300 hover:-translate-y-1 focus:outline-none hover:transition-all hover:duration-300 px-4 py-2"
									>
										<span className="font-semibold text-sm ">{day}</span>
										<span
											className={`text-xl font-bold transform transition-transform ${
												isExpanded
													? "text-red-600"
													: "group-[&:not(:hover)]:text-black"
											}`}
										>
											{isExpanded ? (
												<ChevronUp className="h-5 w-5" aria-hidden="true" />
											) : (
												<ChevronDown className="h-5 w-5" aria-hidden="true" />
											)}
										</span>
									</button>

									{/* Expandable class list */}
									{isExpanded && (
										<div className="bg-white px-4 py-3 space-y-3  border-2">
											{/* Select all for day */}
											<div className="flex items-center gap-2 pb-2 border-b border-gray-200">
												<input
													type="checkbox"
													id={`day-${day}`}
													className="h-4 w-4 border-gray-400"
													checked={allDaySelected}
													onChange={() =>
														handleDayToggle(allDayClasses, allDaySelected)
													}
												/>
												<label
													htmlFor={`day-${day}`}
													className="text-xs font-semibold text-gray-700"
												>
													Select all for {day}
												</label>
											</div>

											{/* Class list */}
											<ul className="space-y-2">
												{classes.map((c) => (
													<li key={c.start} className="flex items-center gap-2">
														<input
															type="checkbox"
															id={c.start}
															className="h-4 w-4 border-gray-400"
															checked={missedClasses.has(c.start)}
															onChange={() => handleMissClassToggle(c.start)}
														/>
														<label
															htmlFor={c.start}
															className="text-xs font-medium text-gray-800"
														>
															<span className="block text-[0.85rem] font-semibold">
																{c.courseName}
															</span>
															<span className="text-[0.75rem] text-gray-500">
																{c.start.split(" ")[1]} – {c.end.split(" ")[1]}
															</span>
														</label>
													</li>
												))}
											</ul>
										</div>
									)}
								</div>
							);
						})}
					</div>
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

			{showProjection && (
				<div className="bg-white rounded-lg shadow-md p-6 mb-8 style-border style-fade-in">
					<div className="mt-0">
						<h4 className="style-text text-lg font-bold text-black mb-2">
							Overall Attendance
						</h4>
						<div className="flex justify-between items-center mb-2">
							<span className="text-sm font-medium text-gray-700 style-text">
								Projected Overall
							</span>
							<span
								className={`text-2xl font-semibold ${
									projectedOverallPercent >= TARGET_PERCENTAGE
										? "text-emerald-600"
										: "text-red-600"
								}`}
							>
								{`${projectedOverallPercent.toFixed(2)}%`}
							</span>
						</div>

						<div className="text-sm text-gray-600">
							{overallMissed > 0
								? `Projected after missing ${overallMissed} class${
										overallMissed === 1 ? "" : "es"
									}.`
								: "No classes selected to miss."}
						</div>
					</div>
				</div>
			)}
			<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
				{processCourseData(
					attendanceData.data.attendanceCourseComponentInfoList,
				).map((course) => {
					const component = course.attendanceCourseComponentNameInfoList[0];
					const present =
						component.numberOfPresent + component.numberOfExtraAttendance;
					const total = component.numberOfPeriods;
					const currentPercentage = total > 0 ? (present / total) * 100 : 0;
					const customGoal = goals[course.courseCode];
					const targetToUse = customGoal ?? TARGET_PERCENTAGE;
					const isEditingThisGoal = editingGoal === course.courseCode;

					return (
						<div
							key={course.courseCode}
							className="bg-white rounded-lg shadow-md p-6 style-border style-fade-in"
						>
							<div className="flex justify-between items-start mb-2">
								<div className="flex-1">
									<h3 className="text-sm font-bold text-gray-800 mb-2 style-text">
										{course.courseName}
									</h3>
									<p className="text-sm text-gray-600 mb-4 style-text">
										Code: {course.courseCode}
									</p>
								</div>
								<div className="flex items-center gap-1">
									{isEditingThisGoal ? (
										<>
											<input
												type="number"
												min="0"
												max="100"
												value={tempGoalValue}
												onChange={(e) => setTempGoalValue(e.target.value)}
												placeholder="%"
												className="w-14 px-1 py-1 border-2 border-purple-600 text-xs text-center"
											/>
											<button
												type="button"
												onClick={() => {
													const target = Number.parseFloat(tempGoalValue);
													if (target >= 0 && target <= 100) {
														handleSetGoal(course.courseCode, target);
													}
												}}
												className="px-2 py-1 bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
												title="Save Goal"
											>
												✓
											</button>
											<button
												type="button"
												onClick={() => {
													setEditingGoal(null);
													setTempGoalValue("");
												}}
												className="px-2 py-1 bg-gray-600 text-white text-xs font-bold hover:bg-gray-700"
												title="Cancel"
											>
												✕
											</button>
										</>
									) : (
										<>
											<button
												type="button"
												onClick={() => {
													setEditingGoal(course.courseCode);
													setTempGoalValue(
														customGoal?.toString() ||
															TARGET_PERCENTAGE.toString(),
													);
												}}
												className="px-2 py-1 bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 flex items-center gap-1"
												title={
													customGoal
														? `Edit Goal (${customGoal}%)`
														: "Set Goal"
												}
											>
												<Target className="h-3 w-3" />
												{customGoal ? `${customGoal}%` : "Set Goal"}
											</button>
											{customGoal !== undefined && (
												<button
													type="button"
													onClick={() => handleRemoveGoal(course.courseCode)}
													className="px-2 py-1 bg-red-600 text-white text-xs font-bold hover:bg-red-700"
													title="Remove Goal"
												>
													✕
												</button>
											)}
										</>
									)}
								</div>
							</div>

							{customGoal !== undefined && (
								<div className="mb-4 p-3 bg-purple-50 border-2 border-purple-600">
									<div className="flex justify-between items-center mb-2">
										<span className="text-xs font-bold text-purple-700 style-text">
											Your Goal: {customGoal}%
										</span>
										<span
											className={`text-sm font-bold ${
												currentPercentage >= customGoal
													? "text-emerald-600"
													: "text-amber-600"
											}`}
										>
											{currentPercentage.toFixed(1)}%
										</span>
									</div>
									<div className="w-full bg-gray-200 h-2 border border-black mb-2">
										<div
											className={`h-full transition-all duration-500 ${
												currentPercentage >= customGoal
													? "bg-emerald-500"
													: "bg-amber-500"
											}`}
											style={{
												width: `${Math.min((currentPercentage / customGoal) * 100, 100)}%`,
											}}
										/>
									</div>
									<div className="text-xs text-gray-700 style-text">
										{currentPercentage >= customGoal ? (
											<span className="text-emerald-600 font-semibold">
												✓ Goal achieved!
											</span>
										) : (
											<span className="text-amber-600 font-semibold">
												{calculateAttendanceProjection(
													present,
													total,
													customGoal,
												).message}
											</span>
										)}
									</div>
								</div>
							)}

							<div className="space-y-4">
								{course.attendanceCourseComponentNameInfoList.map(
									(component, _index) => {
										const subjectMissed =
											projectionAdjustments.byCourseCode.get(
												course.courseCode,
											) || 0;
										const projectedPresent =
											component.numberOfPresent +
											component.numberOfExtraAttendance;
										const projectedTotal =
											component.numberOfPeriods + subjectMissed;
										const projectedSubjectPercent =
											projectedTotal > 0
												? (projectedPresent / projectedTotal) * 100
												: 0;

										const currentSubjectProjection =
											calculateAttendanceProjection(
												component.numberOfPresent +
													component.numberOfExtraAttendance,
												component.numberOfPeriods + subjectMissed,
												targetToUse,
											);

										return (
											<div
												key={component.componentName}
												className="border-t-2 pt-4 border-black"
											>
												<div className="flex justify-between items-center mb-2">
													<span className="text-sm font-medium text-gray-700 style-text">
														{component.componentName}
													</span>

													{showProjection && subjectMissed > 0 ? (
														<span
															className={`text-sm font-semibold ${
																projectedSubjectPercent >= targetToUse
																	? "text-emerald-600"
																	: "text-red-600"
															}`}
														>
															{`${projectedSubjectPercent.toFixed(2)}% (Projected)`}
														</span>
													) : (
														<span
															className={`text-sm font-semibold ${
																(component.presentPercentage ?? 0) >= targetToUse
																	? "text-emerald-600"
																	: "text-red-600"
															}`}
														>
															{component.presentPercentageWith}
														</span>
													)}
												</div>

												{
													<>
														<div className="text-sm text-gray-600 mb-2">
															Present:{" "}
															{component.numberOfPresent +
																component.numberOfExtraAttendance}
															/{component.numberOfPeriods + subjectMissed}
														</div>
														{currentSubjectProjection && (
															<div
																className={`flex items-center gap-2 text-sm ${
																	currentSubjectProjection.status === "safe"
																		? "text-emerald-600"
																		: "text-amber-600"
																}`}
															>
																{currentSubjectProjection.status === "safe" ? (
																	<CheckCircle className="h-4 w-4" />
																) : (
																	<AlertTriangle className="h-4 w-4" />
																)}
																{currentSubjectProjection.message}
															</div>
														)}
														<div className="pt-2 ">
															<button
																type="button"
																onClick={() =>
																	handleViewDaywiseAttendance(course, component)
																}
																className="style-border style-text py-2 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black transform transition-transform duration-300 hover:-translate-y-1 focus:outline-none hover:transition-all hover:duration-300"
															>
																See Daywise Attendance
															</button>
														</div>
													</>
												}
											</div>
										);
									},
								)}
							</div>
						</div>
					);
				})}
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
