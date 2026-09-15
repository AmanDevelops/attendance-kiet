import axios from "axios";
import { ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { getBaseUrl } from "../../types/constants";
import type {
	AttendanceApiResponse,
	LectureListProps,
} from "../../types/response";

interface CalendarViewProps {
	token: string;
	studentId: number;
}

interface CourseDay {
	courseCode: string;
	courseName: string;
	componentName: string;
	timeSlot: string;
	attendance: LectureListProps["attendance"];
}

type DayMap = Record<string, CourseDay[]>;

// Module-level cache — survives component unmount/remount (e.g. switching views)
let _calendarCache: DayMap | null = null;

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(dateStr: string): string {
	const d = new Date(dateStr);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateKey: string): string {
	const [y, m, d] = dateKey.split("-");
	const dayName = new Date(`${y}-${m}-${d}`).toLocaleDateString("en-US", {
		weekday: "long",
	});
	return `${dayName}, ${d} ${MONTH_NAMES[Number(m) - 1]} ${y}`;
}

// Extracts the start time of a slot like "09:00 AM - 10:00 AM" or "09:00-10:00" into minutes-since-midnight
function timeSlotStartMinutes(timeSlot: string): number {
	const match = timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
	if (!match) return 0;
	let hours = Number(match[1]);
	const minutes = Number(match[2]);
	const period = match[3]?.toUpperCase();
	if (period === "PM" && hours !== 12) hours += 12;
	if (period === "AM" && hours === 12) hours = 0;
	return hours * 60 + minutes;
}

// ── Day Detail Modal ────────────────────────────────────────────────────────
interface DayModalProps {
	dateKey: string;
	entries: CourseDay[];
	onClose: () => void;
}

function DayModal({ dateKey, entries, onClose }: DayModalProps) {
	// Sort chronologically by start time (9 AM first, latest last)
	const sorted = useMemo(
		() =>
			[...entries].sort(
				(a, b) =>
					timeSlotStartMinutes(a.timeSlot) - timeSlotStartMinutes(b.timeSlot),
			),
		[entries],
	);

	// Close on Escape
	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	const presentCount = sorted.filter(
		(e) => e.attendance === "PRESENT" || e.attendance === "ADJUSTED",
	).length;
	const absentCount = sorted.filter((e) => e.attendance === "ABSENT").length;

	return (
		<div className="fixed inset-0 flex items-center justify-center z-50 px-4">
			<button
				type="button"
				className="absolute inset-0 w-full h-full bg-transparent backdrop-blur-[3px] cursor-default focus:outline-none"
				onClick={onClose}
				aria-label="Close modal"
				tabIndex={-1}
			/>
			<div className="relative bg-white p-4 sm:p-6 rounded-none border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-3xl w-full max-h-[85vh] flex flex-col style-fade-in">
				{/* Header */}
				<div className="flex justify-between items-start gap-2 mb-6 border-b-4 border-black pb-4 shrink-0">
					<div className="min-w-0">
						<h2 className="text-lg sm:text-xl font-black style-text uppercase tracking-tighter break-words">
							{formatDateLabel(dateKey)}
						</h2>
						<div className="flex flex-wrap gap-2 sm:gap-4 mt-2">
							<span className="text-sm font-black style-text text-black bg-emerald-300 border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								{presentCount} PRESENT
							</span>
							<span className="text-sm font-black style-text text-white bg-[#DA291C] border-2 border-black px-2 py-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								{absentCount} ABSENT
							</span>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="text-black hover:bg-yellow-300 border-2 border-transparent hover:border-black p-1 transition-all ml-4 shrink-0 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5"
					>
						<X className="h-6 w-6 font-black" />
					</button>
				</div>

				{/* Timetable list */}
				<div className="space-y-4 flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
					{sorted.map((entry, i) => {
						return (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: list by position
								key={i}
								className="flex items-stretch bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
							>
								{/* Content */}
								<div className="flex-1 p-3">
									<div className="flex items-start justify-between gap-2">
										<div className="min-w-0">
											<p className="text-base font-black style-text text-black leading-tight break-words uppercase">
												{entry.courseName}
											</p>
											<p className="text-xs text-black font-bold style-text mt-1 uppercase tracking-wider">
												{entry.componentName} • {entry.courseCode}
											</p>
										</div>
										<span
											className={`shrink-0 text-[10px] font-black style-text px-2 py-1 border-2 border-black uppercase tracking-widest ${
												entry.attendance === "PRESENT"
													? "bg-emerald-300 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
													: entry.attendance === "ADJUSTED"
														? "bg-amber-300 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
														: "bg-[#DA291C] text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
											}`}
										>
											{entry.attendance}
										</span>
									</div>
									<div className="flex items-center gap-1 mt-3 text-black font-bold border-t-2 border-black pt-2">
										<Clock className="h-4 w-4 shrink-0" />
										<span className="text-xs style-text tracking-widest">
											{entry.timeSlot}
										</span>
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

// ── Loading Skeleton ────────────────────────────────────────────────────────
function SkeletonCalendar() {
	return (
		<div className="animate-pulse">
			<div className="flex items-center justify-between mb-4">
				<div className="h-8 w-8 bg-gray-200 rounded" />
				<div className="h-6 w-44 bg-gray-200 rounded" />
				<div className="h-8 w-8 bg-gray-200 rounded" />
			</div>
			<div className="grid grid-cols-7 border-l border-t border-gray-200">
				{DAY_NAMES.map((d) => (
					<div
						key={d}
						className="h-8 bg-gray-100 border-r border-b border-gray-200"
					/>
				))}
				{Array.from({ length: 35 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
					<div
						key={i}
						className="h-20 bg-white border-r border-b border-gray-200"
					/>
				))}
			</div>
		</div>
	);
}

// ── Progress bar while fetching ─────────────────────────────────────────────

// ── Main CalendarView ───────────────────────────────────────────────────────
export default function CalendarView({ token, studentId }: CalendarViewProps) {
	const { attendanceData } = useAppContext();

	// Persist fetched data across re-mounts (won't re-fetch on view toggle)
	const [dayMap, setDayMap] = useState<DayMap>(() => _calendarCache ?? {});
	const [loading, setLoading] = useState(_calendarCache === null);
	const [error, setError] = useState("");

	const today = new Date();
	const [viewYear, setViewYear] = useState(today.getFullYear());
	const [viewMonth, setViewMonth] = useState(today.getMonth());

	const [selectedDate, setSelectedDate] = useState<string | null>(null);

	// ── Fetch all courses (only once per session) ───────────────────────────
	const fetchAll = useCallback(async () => {
		if (!attendanceData || !token || !studentId) return;
		if (_calendarCache !== null) {
			setDayMap(_calendarCache);
			setLoading(false);
			return;
		}

		const requests = attendanceData.attendanceCourseComponentInfoList.flatMap(
			(course) =>
				course.attendanceCourseComponentNameInfoList.map((component) => ({
					courseCode: course.courseCode,
					courseName: course.courseName,
					componentName: component.componentName,
					payload: {
						courseCompId: component.courseComponentId,
						courseId: course.courseId,
						sessionId: null,
						studentId,
					},
				})),
		);

		setLoading(true);
		setError("");

		const newDayMap: DayMap = {};

		// fetch one at a time to avoid hammering the server
		for (const req of requests) {
			try {
				const res = await axios.post<AttendanceApiResponse>(
					`${getBaseUrl()}/api/attendance/schedule/student/course/attendance/percentage`,
					req.payload,
					{
						headers: {
							"Content-Type": "application/json",
							Authorization: `GlobalEducation ${token}`,
						},
					},
				);

				const data = res.data;
				if (data.data && data.data.length > 0) {
					for (const lecture of data.data[0].lectureList) {
						const key = toDateKey(lecture.planLecDate);
						if (!newDayMap[key]) newDayMap[key] = [];
						newDayMap[key].push({
							courseCode: req.courseCode,
							courseName: req.courseName,
							componentName: req.componentName,
							timeSlot: lecture.timeSlot,
							attendance: lecture.attendance,
						});
					}
				}
			} catch {
				// skip failed courses silently
			}
		}

		_calendarCache = newDayMap;
		setDayMap(newDayMap);
		setLoading(false);
	}, [attendanceData, token, studentId]);

	useEffect(() => {
		fetchAll();
	}, [fetchAll]);

	// ── Block body scroll when modal is open ────────────────────────────────
	useEffect(() => {
		document.body.style.overflow = selectedDate ? "hidden" : "auto";
		return () => {
			document.body.style.overflow = "auto";
		};
	}, [selectedDate]);

	// ── Calendar grid ───────────────────────────────────────────────────────
	const { cells } = useMemo(() => {
		const firstDay = new Date(viewYear, viewMonth, 1).getDay();
		const dim = new Date(viewYear, viewMonth + 1, 0).getDate();
		const arr: (number | null)[] = [];
		for (let i = 0; i < firstDay; i++) arr.push(null);
		for (let d = 1; d <= dim; d++) arr.push(d);
		while (arr.length % 7 !== 0) arr.push(null);
		return { cells: arr };
	}, [viewYear, viewMonth]);

	// ── Month stats ─────────────────────────────────────────────────────────
	const monthStats = useMemo(() => {
		let present = 0;
		let absent = 0;
		let adjusted = 0;
		for (const [key, entries] of Object.entries(dayMap)) {
			const [y, m] = key.split("-");
			if (Number(y) === viewYear && Number(m) - 1 === viewMonth) {
				for (const e of entries) {
					if (e.attendance === "PRESENT") present++;
					else if (e.attendance === "ABSENT") absent++;
					else adjusted++;
				}
			}
		}
		return { present, absent, adjusted, total: present + absent + adjusted };
	}, [dayMap, viewYear, viewMonth]);

	const prevMonth = () => {
		if (viewMonth === 0) {
			setViewMonth(11);
			setViewYear((y) => y - 1);
		} else setViewMonth((m) => m - 1);
	};
	const nextMonth = () => {
		if (viewMonth === 11) {
			setViewMonth(0);
			setViewYear((y) => y + 1);
		} else setViewMonth((m) => m + 1);
	};

	// ── Render ──────────────────────────────────────────────────────────────
	return (
		<>
			<div className="bg-white rounded-lg style-border style-fade-in mb-8 overflow-hidden">
				{/* ── Calendar Header ── */}
				<div className="flex items-center justify-between px-4 py-4 border-b-2 border-black bg-white">
					<button
						type="button"
						onClick={prevMonth}
						className="p-2 rounded-none border-2 border-black transition-all"
						aria-label="Previous month"
					>
						<ChevronLeft className="h-5 w-5" />
					</button>

					<div className="text-center">
						<h2 className="text-xl sm:text-2xl font-bold style-text tracking-tighter uppercase">
							{MONTH_NAMES[viewMonth]} {viewYear}
						</h2>
					</div>

					<button
						type="button"
						onClick={nextMonth}
						className="p-2 rounded-none border-2 border-black transition-all"
						aria-label="Next month"
					>
						<ChevronRight className="h-5 w-5" />
					</button>
				</div>

				{!loading && !error && monthStats.total > 0 && (
					<div className="flex flex-wrap gap-4 px-4 py-3 border-b-2 border-black bg-gray-50 text-sm font-bold style-text uppercase items-center justify-between">
						<div className="flex gap-4">
							<span className="text-black bg-emerald-300 px-2 py-1 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								✓ {monthStats.present + monthStats.adjusted} Present
							</span>
							<span className="text-white bg-[#DA291C] px-2 py-1 border-2 border-black rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
								✗ {monthStats.absent} Absent
							</span>
						</div>
						<span className="text-black text-base tracking-tighter bg-yellow-300 px-2 py-1 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
							{Math.round(
								((monthStats.present + monthStats.adjusted) /
									monthStats.total) *
									100,
							)}
							% ATTENDANCE
						</span>
					</div>
				)}

				<div className="p-0">
					{/* ── Progress / Error / Skeleton ── */}
					{loading && (
						<div className="p-4">
							<SkeletonCalendar />
						</div>
					)}

					{error && !loading && (
						<p className="text-[#DA291C] text-sm font-bold text-center py-8 uppercase tracking-widest">
							{error}
						</p>
					)}

					{/* ── Calendar grid ── */}
					{!loading && !error && (
						<div className="border-b-2 border-black">
							{/* Day-name header row */}
							<div className="grid grid-cols-7 border-b-2 border-black bg-white text-black">
								{DAY_NAMES.map((d, i) => (
									<div
										key={d}
										className={`text-center text-xs sm:text-sm font-bold style-text py-3 uppercase tracking-widest ${i !== 6 ? "border-r-2 border-black/20" : ""}`}
									>
										{d}
									</div>
								))}
							</div>

							{/* Date cells */}
							<div className="grid grid-cols-7 bg-black gap-[2px]">
								{cells.map((day, idx) => {
									const dateKey =
										day !== null
											? `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
											: "";
									const entries = dateKey ? (dayMap[dateKey] ?? []) : [];
									const isToday =
										day !== null &&
										today.getFullYear() === viewYear &&
										today.getMonth() === viewMonth &&
										today.getDate() === day;
									const hasClasses = entries.length > 0;
									const presentCount = entries.filter(
										(e) =>
											e.attendance === "PRESENT" || e.attendance === "ADJUSTED",
									).length;
									const absentCount = entries.filter(
										(e) => e.attendance === "ABSENT",
									).length;

									return (
										// biome-ignore lint/a11y/noStaticElementInteractions: interactivity is conditional on hasClasses, role is set accordingly
										<div
											// biome-ignore lint/suspicious/noArrayIndexKey: calendar grid by index
											key={idx}
											role={hasClasses ? "button" : undefined}
											tabIndex={hasClasses ? 0 : undefined}
											className={`relative min-h-[5rem] sm:min-h-[8rem] p-1.5 sm:p-2 transition-all duration-200
												${day === null ? "bg-gray-100" : "bg-white"}
												${hasClasses ? "cursor-pointer hover:bg-yellow-100 hover:scale-[1.02] hover:z-10 hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:border-2 hover:border-black" : ""}
											`}
											onClick={() =>
												hasClasses && day !== null && setSelectedDate(dateKey)
											}
											onKeyDown={(e) =>
												e.key === "Enter" &&
												hasClasses &&
												day !== null &&
												setSelectedDate(dateKey)
											}
										>
											{day !== null && (
												<div className="h-full flex flex-col">
													{/* Date number */}
													<div className="flex justify-between items-start">
														<span
															className={`inline-flex items-center justify-center text-lg sm:text-xl font-bold style-text tracking-tighter leading-none
																${
																	isToday
																		? "w-9 h-9 border-2 border-black bg-black text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rotate-[-5deg]"
																		: "text-black"
																}
															`}
														>
															{day}
														</span>
													</div>

													{/* Attendance dots */}
													{hasClasses && (
														<div className="mt-auto pt-2 flex flex-col gap-1.5">
															{presentCount > 0 && (
																<span className="flex items-center justify-center sm:justify-start gap-1 text-[10px] sm:text-sm font-bold style-text text-black bg-emerald-300 border-2 border-black rounded-none px-1 sm:px-2 py-0.5 sm:py-1 leading-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">
																	<span className="sm:hidden">
																		{presentCount}P
																	</span>
																	<span className="hidden sm:inline">
																		{presentCount} PRESENT
																	</span>
																</span>
															)}
															{absentCount > 0 && (
																<span className="flex items-center justify-center sm:justify-start gap-1 text-[10px] sm:text-sm font-bold style-text text-white bg-[#DA291C] border-2 border-black rounded-none px-1 sm:px-2 py-0.5 sm:py-1 leading-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase">
																	<span className="sm:hidden">
																		{absentCount}A
																	</span>
																	<span className="hidden sm:inline">
																		{absentCount} ABSENT
																	</span>
																</span>
															)}
														</div>
													)}

													{/* "tap to view" hint for days with classes */}
													{hasClasses && (
														<div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
															<span className="bg-black text-white text-[10px] font-bold style-text px-2 py-1 uppercase tracking-widest border-2 border-black">
																View
															</span>
														</div>
													)}
												</div>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* ── Day Detail Modal ── */}
			{selectedDate && (
				<DayModal
					dateKey={selectedDate}
					entries={dayMap[selectedDate] ?? []}
					onClose={() => setSelectedDate(null)}
				/>
			)}
		</>
	);
}
