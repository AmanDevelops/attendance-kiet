import axios from "axios";
import Cookies from "js-cookie";
import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { AUTH_COOKIE_NAME, getBaseUrl } from "../../types/constants";
import type { ScheduleEntry, ScheduleResponse } from "../../types/response";
import { getWeekRange } from "../../types/utils";

type ClassEntry = ScheduleEntry & {
	formattedStart: string;
	formattedEnd: string;
};

function formatShortTime(timeString: string) {
	if (!timeString) return "";
	const timePart = timeString.split(" ")[1] || "";
	const [h, m] = timePart.split(":");
	if (!h || !m) return "";
	const hour = Number.parseInt(h, 10);
	const ampm = hour >= 12 ? "PM" : "AM";
	const formattedHour = hour % 12 || 12;
	return `${formattedHour}:${m} ${ampm}`;
}

export default function Projections() {
	const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
	const [missedClasses, setMissedClasses] = useState<Set<string>>(new Set());
	const { setAttendanceData } = useAppContext();

	const updateProjectedAttendance = useCallback(
		(courseCode: string, action: "add" | "subtract") => {
			const adjustment = action === "add" ? 1 : -1;

			setAttendanceData((prevData) => {
				if (!prevData) return prevData;

				const courseList = prevData.attendanceCourseComponentInfoList;
				if (!courseList) return prevData;

				const newCourseList = courseList.map((course) => {
					if (course.courseCode === courseCode) {
						const updatedNameInfoList = [
							...course.attendanceCourseComponentNameInfoList,
						];

						updatedNameInfoList[0] = {
							...updatedNameInfoList[0],
							numberOfPeriods:
								updatedNameInfoList[0].numberOfPeriods + adjustment,
							isProjected: action === "add",
						};

						return {
							...course,
							attendanceCourseComponentNameInfoList: updatedNameInfoList,
						};
					}
					return course;
				});

				return {
					...prevData,
					attendanceCourseComponentInfoList: newCourseList,
				};
			});
		},
		[setAttendanceData],
	);

	useEffect(() => {
		const fetchSchedule = async () => {
			const token = Cookies.get(AUTH_COOKIE_NAME);
			if (token) {
				try {
					const { startDate, endDate } = getWeekRange();
					const scheduleResponse = await axios.get<ScheduleResponse>(
						`${getBaseUrl()}/api/student/schedule/class?weekEndDate=${endDate}&weekStartDate=${startDate}`,
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

	const timeSlots = useMemo(() => {
		const slotsMap = new Map<
			string,
			{
				label: string;
				formattedStart: string;
				formattedEnd: string;
				timeVal: number;
			}
		>();

		schedule.forEach((item) => {
			if (item.type !== "CLASS") return;
			const startTimeStr = item.start.split(" ")[1] || "";
			const key = `${startTimeStr}-${item.end.split(" ")[1] || ""}`;

			if (!slotsMap.has(key)) {
				const [h, m] = startTimeStr.split(":").map(Number);
				const formattedStart = formatShortTime(item.start);
				const formattedEnd = formatShortTime(item.end);
				slotsMap.set(key, {
					label: `${formattedStart} - ${formattedEnd}`,
					formattedStart,
					formattedEnd,
					timeVal: (h || 0) * 60 + (m || 0),
				});
			}
		});

		const sorted = Array.from(slotsMap.values()).sort(
			(a, b) => a.timeVal - b.timeVal,
		);
		return {
			morning: sorted.filter((s) => s.timeVal < 13 * 60),
			afternoon: sorted.filter((s) => s.timeVal >= 13 * 60),
		};
	}, [schedule]);

	const { morning: morningSlots, afternoon: afternoonSlots } = timeSlots;
	const hasLunchBreak = morningSlots.length > 0 && afternoonSlots.length > 0;

	const groupedSchedule = useMemo(() => {
		const grouped = new Map<string, ClassEntry[]>();
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

		schedule
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
			.sort((a, b) => a.timestamp - b.timestamp)
			.forEach((c) => {
				const [day, month, year] = c.lectureDate.split("/").map(Number);
				const classDate = new Date(year, month - 1, day);

				const dayKey = classDate.toLocaleDateString("en-US", {
					weekday: "short",
					month: "short",
					day: "numeric",
				});

				if (!grouped.has(dayKey)) {
					grouped.set(dayKey, []);
				}
				grouped.get(dayKey)?.push({
					...c,
					formattedStart: formatShortTime(c.start),
					formattedEnd: formatShortTime(c.end),
				});
			});

		return grouped;
	}, [schedule]);

	const handleClassToggle = useCallback(
		(classStart: string, courseCode: string) => {
			const nextSet = new Set(missedClasses);
			if (nextSet.has(classStart)) {
				nextSet.delete(classStart);
				updateProjectedAttendance(courseCode, "subtract");
			} else {
				nextSet.add(classStart);
				updateProjectedAttendance(courseCode, "add");
			}
			setMissedClasses(nextSet);
		},
		[missedClasses, updateProjectedAttendance],
	);

	const renderSlotCells = useCallback(
		(classes: ClassEntry[], slots: typeof morningSlots) => {
			return slots.map((slot) => {
				const classItem = classes.find(
					(c) =>
						c.formattedStart === slot.formattedStart &&
						c.formattedEnd === slot.formattedEnd,
				);

				if (!classItem) {
					return (
						<td
							key={slot.label}
							className="p-1.5 py-3 border-b border-r border-gray-100 text-center text-gray-300 text-xs align-middle"
						>
							-
						</td>
					);
				}

				const isMissed = missedClasses.has(classItem.start);

				return (
					<td
						key={classItem.start}
						className={`p-0 border-b border-r border-gray-100 align-middle transition-colors ${
							isMissed
								? "bg-red-100 text-red-800 font-semibold"
								: "bg-transparent hover:bg-gray-100 text-gray-800"
						}`}
					>
						<button
							type="button"
							onClick={() =>
								handleClassToggle(classItem.start, classItem.courseCode)
							}
							className="w-full h-full min-h-[56px] py-3 px-1.5 text-center flex flex-col items-center justify-center cursor-pointer bg-transparent text-inherit"
						>
							<span className="block text-xs font-bold leading-tight line-clamp-2 text-center">
								{classItem.courseName}
							</span>
						</button>
					</td>
				);
			});
		},
		[handleClassToggle, missedClasses],
	);

	const dayEntries = Array.from(groupedSchedule.entries());

	return (
		<div className="bg-white rounded-lg shadow-md p-6 mb-4 style-border style-fade-in">
			<div className="flex items-center gap-2 mb-1">
				<CalendarDays className="h-6 w-6 text-blue-600" />
				<h3 className="style-text text-md font-semibold text-black">
					Weekly Projection (Today Onwards)
				</h3>
			</div>
			<div className="flex items-center justify-between gap-2 mb-4">
				<p className="style-text text-xs text-gray-600">
					Click on any class block to mark it as planned to miss:
				</p>
				<span className="md:hidden text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap select-none">
					Scroll &rarr;
				</span>
			</div>

			{dayEntries.length === 0 ? (
				<p className="style-text text-gray-500">
					No upcoming classes found for the rest of the week.
				</p>
			) : (
				<div className="w-full border border-gray-200 rounded-lg overflow-x-auto custom-table-scroll bg-white">
					<table className="w-full min-w-[960px] md:min-w-full table-fixed border-collapse bg-white text-xs">
						<thead>
							<tr className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
								<th className="p-2 text-center w-16 border-r border-gray-200 text-[10px]">
									Day / Date
								</th>
								{morningSlots.map((slot) => (
									<th
										key={slot.label}
										className="p-2 text-center font-medium whitespace-nowrap text-[10px] border-r border-gray-200"
									>
										{slot.label}
									</th>
								))}

								{hasLunchBreak && (
									<th className="p-2 text-center font-bold text-[10px] text-gray-500 tracking-wider uppercase bg-gray-100/80 border-r border-gray-200">
										LUNCH
									</th>
								)}

								{afternoonSlots.map((slot) => (
									<th
										key={slot.label}
										className="p-2 text-center font-medium whitespace-nowrap text-[10px] border-r border-gray-200 last:border-r-0"
									>
										{slot.label}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{dayEntries.map(([dayKey, classes]) => {
								const [weekday, ...restDate] = dayKey.split(", ");
								const dateStr = restDate.join(", ");

								return (
									<tr
										key={dayKey}
										className="hover:bg-gray-50/30 transition-colors"
									>
										<td className="p-2 py-3 border-b border-r border-gray-200 bg-gray-100/80 text-center align-middle">
											<div className="font-bold text-xs text-black">
												{weekday}
											</div>
											<div className="text-[10px] text-gray-600 font-medium mt-0.5">
												{dateStr}
											</div>
										</td>

										{renderSlotCells(classes, morningSlots)}

										{hasLunchBreak && (
											<td className="p-2 py-3 text-center bg-gray-100/50 border-b border-r border-gray-200 font-bold text-[11px] text-gray-400 tracking-wider select-none align-middle">
												LUNCH
											</td>
										)}

										{renderSlotCells(classes, afternoonSlots)}
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
