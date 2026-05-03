import axios from "axios";
import Cookies from "js-cookie";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { AUTH_COOKIE_NAME } from "../../types/constants";
import type {
	ScheduleEntry,
	ScheduleResponse,
	StudentDetails,
} from "../../types/response";
import { getWeekRange } from "../../types/utils";

function getClassKey(classEntry: ScheduleEntry) {
	return `${classEntry.courseCode}-${classEntry.courseCompName}-${classEntry.lectureDate}-${classEntry.start}`;
}

export default function Projections() {
	const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
	const [missedClasses, setMissedClasses] = useState<Set<string>>(new Set());
	const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
	const { attendanceData, setAttendanceData } = useAppContext();
	const originalAttendanceRef = useRef<StudentDetails | null>(attendanceData);

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

		fetchSchedule();
	}, []);

	const upcomingClasses = useMemo(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const parseDate = (lectureDate: string, startTime: string): Date => {
			const [day, month, year] = lectureDate.split("/").map(Number);
			const [hours, minutes, seconds] = startTime.split(":");
			return new Date(
				year,
				month - 1,
				day,
				Number(hours),
				Number(minutes),
				Number(seconds),
			);
		};

		return schedule
			.filter((c) => {
				if (c.type !== "CLASS") return false;
				const [day, month, year] = c.lectureDate.split("/").map(Number);
				const classDate = new Date(year, month - 1, day);
				return classDate >= today;
			})
			.map((c) => ({
				...c,
				timestamp: parseDate(c.lectureDate, c.start.split(" ")[1]).getTime(),
			}))
			.sort((a, b) => a.timestamp - b.timestamp);
	}, [schedule]);

	useEffect(() => {
		const originalAttendance = originalAttendanceRef.current;
		if (!originalAttendance) return;

		const projectedCourseList =
			originalAttendance.attendanceCourseComponentInfoList.map((course) => {
				const courseClasses = upcomingClasses.filter(
					(classEntry) => classEntry.courseCode === course.courseCode,
				);
				const componentNames = new Set(
					course.attendanceCourseComponentNameInfoList.map(
						(component) => component.componentName,
					),
				);

				return {
					...course,
					attendanceCourseComponentNameInfoList:
						course.attendanceCourseComponentNameInfoList.map(
							(component, componentIndex) => {
								const componentClasses = courseClasses.filter(
									(classEntry) =>
										classEntry.courseCompName === component.componentName ||
										(componentIndex === 0 &&
											!componentNames.has(classEntry.courseCompName)),
								);

								const projectedPresent = componentClasses.filter(
									(classEntry) => !missedClasses.has(getClassKey(classEntry)),
								).length;

								return {
									...component,
									numberOfPeriods:
										component.numberOfPeriods + componentClasses.length,
									numberOfPresent: component.numberOfPresent + projectedPresent,
									isProjected: componentClasses.length > 0,
								};
							},
						),
				};
			});

		setAttendanceData({
			...originalAttendance,
			attendanceCourseComponentInfoList: projectedCourseList,
		});
	}, [missedClasses, setAttendanceData, upcomingClasses]);

	useEffect(() => {
		return () => {
			if (originalAttendanceRef.current) {
				setAttendanceData(originalAttendanceRef.current);
			}
		};
	}, [setAttendanceData]);

	const groupedSchedule = useMemo(() => {
		const grouped = new Map<string, ScheduleEntry[]>();

		upcomingClasses.forEach((c) => {
			const [day, month, year] = c.lectureDate.split("/").map(Number);
			const classDate = new Date(year, month - 1, day);

			const dayName = classDate.toLocaleDateString("en-US", {
				weekday: "long",
				month: "short",
				day: "numeric",
			});

			if (!grouped.has(dayName)) {
				grouped.set(dayName, []);
			}
			grouped.get(dayName)?.push(c);
		});

		return grouped;
	}, [upcomingClasses]);

	const handleMissClassToggle = (classKey: string) => {
		const newSet = new Set(missedClasses);
		if (newSet.has(classKey)) {
			newSet.delete(classKey);
			setMissedClasses(newSet);
		} else {
			newSet.add(classKey);
			setMissedClasses(newSet);
		}
	};

	const handleDayToggle = (classKeys: string[], dayIsSelected: boolean) => {
		setMissedClasses((prev) => {
			const newSet = new Set(prev);
			if (dayIsSelected) {
				for (const classKey of classKeys) {
					newSet.delete(classKey);
				}
			} else {
				for (const classKey of classKeys) {
					newSet.add(classKey);
				}
			}
			return newSet;
		});
	};

	return (
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
					const allDayClassKeys = classes.map(getClassKey);
					const allDaySelected = allDayClassKeys.every((classKey) =>
						missedClasses.has(classKey),
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
											: "group-not-[&:hover]:text-black"
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
												handleDayToggle(allDayClassKeys, allDaySelected)
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
										{classes.map((c) => {
											const classKey = getClassKey(c);

											return (
												<li key={classKey} className="flex items-center gap-2">
													<input
														type="checkbox"
														id={classKey}
														className="h-4 w-4 border-gray-400"
														checked={missedClasses.has(classKey)}
														onChange={() => handleMissClassToggle(classKey)}
													/>
													<label
														htmlFor={classKey}
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
											);
										})}
									</ul>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
