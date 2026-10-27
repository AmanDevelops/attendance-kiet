import axios from "axios";
import Cookies from "js-cookie";
import {
	AlertCircle,
	CalendarPlus,
	Check,
	ChevronDown,
	ChevronUp,
	Palmtree,
	Play,
	Plus,
	RefreshCw,
	Sparkles,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import {
	AUTH_COOKIE_NAME,
	getBaseUrl,
	NON_WORKING_DAYS,
} from "../types/constants";
import type { ScheduleEntry, ScheduleResponse } from "../types/response";
import {
	formatAuthHeader,
	formatNonWorkingDay,
	getWeekRange,
	isNonWorkingDayKey,
	parseScheduleDate,
	toDateKey,
} from "../types/utils";

// --------------- Types ---------------

export interface PlannedClass {
	id: string;
	dateKey: string; // YYYY-MM-DD
	courseName: string;
	courseCode: string;
	courseCompName: string;
	startTime: string; // Formatted e.g. "9:00 AM"
	endTime: string; // Formatted e.g. "9:55 AM"
	rawStart: string;
	rawEnd: string;
	dateLabel: string; // e.g. "Mon, Nov 4"
	isAbsent: boolean;
}

export interface SavedHoliday {
	id: string;
	name: string;
	startDate: string; // YYYY-MM-DD
	endDate: string; // YYYY-MM-DD
	applied: boolean;
	appliedCounts: Record<string, number>; // courseCode -> count
	classes: PlannedClass[];
	isGeneratedFromWeeklyTemplate?: boolean;
}

// --------------- Local Storage ---------------

const STORAGE_KEY = "kiet_attendance_saved_holidays";

function loadHolidays(): SavedHoliday[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? JSON.parse(raw) : [];
	} catch {
		return [];
	}
}

function saveHolidays(holidays: SavedHoliday[]) {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(holidays));
	} catch (err) {
		console.error("Failed to save holidays to localStorage", err);
	}
}

// --------------- Helpers ---------------

function parseDateInput(s: string): Date {
	const [y, m, d] = s.split("-").map(Number);
	return new Date(y, m - 1, d);
}

function eachDayBetween(start: string, end: string): Date[] {
	const days: Date[] = [];
	const s = parseDateInput(start);
	const e = parseDateInput(end);
	const cur = new Date(s);
	while (cur <= e) {
		days.push(new Date(cur));
		cur.setDate(cur.getDate() + 1);
	}
	return days;
}

function formatShortDate(d: Date): string {
	return d.toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

function formatReadableRange(start: string, end: string): string {
	const s = parseDateInput(start);
	const e = parseDateInput(end);
	const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
	return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`;
}

function formatDisplayTime(timeString: string): string {
	if (!timeString) return "";
	const timePart = timeString.includes(" ")
		? timeString.split(" ")[1]
		: timeString;
	const parts = timePart.split(":");
	if (parts.length < 2) return timeString;
	const hour = Number.parseInt(parts[0], 10);
	const min = parts[1];
	if (Number.isNaN(hour)) return timeString;
	const ampm = hour >= 12 ? "PM" : "AM";
	const formattedHour = hour % 12 || 12;
	return `${formattedHour}:${min} ${ampm}`;
}

// --------------- Schedule Generation ---------------

async function fetchScheduleForHoliday(
	startDate: string,
	endDate: string,
): Promise<{
	classes: PlannedClass[];
	fromWeeklyTemplate: boolean;
}> {
	const token = Cookies.get(AUTH_COOKIE_NAME) || "";
	if (!token) {
		return { classes: [], fromWeeklyTemplate: false };
	}

	const days = eachDayBetween(startDate, endDate);
	const dateKeySet = new Set(days.map(toDateKey));

	// 1. Try to fetch schedule directly for this date range
	try {
		const res = await axios.get<ScheduleResponse>(
			`${getBaseUrl()}/api/student/schedule/class`,
			{
				params: {
					weekStartDate: startDate,
					weekEndDate: endDate,
				},
				headers: { Authorization: formatAuthHeader(token) },
				timeout: 10000,
			},
		);

		const rawEntries = res.data?.data ?? [];
		const matchedClasses: PlannedClass[] = [];
		const seen = new Set<string>();

		for (const entry of rawEntries) {
			if (entry.type !== "CLASS") continue;
			const parsed = parseScheduleDate(
				entry.lectureDate || entry.start?.split(" ")[0] || "",
			);
			if (!parsed) continue;

			const dateKey = toDateKey(parsed);
			if (!dateKeySet.has(dateKey)) continue;
			if (isNonWorkingDayKey(dateKey)) continue;

			const dedupeKey = `${entry.courseCode}-${dateKey}-${entry.start}`;
			if (seen.has(dedupeKey)) continue;
			seen.add(dedupeKey);

			matchedClasses.push({
				id: dedupeKey,
				dateKey,
				courseName: entry.courseName,
				courseCode: entry.courseCode,
				courseCompName: entry.courseCompName,
				startTime: formatDisplayTime(entry.start),
				endTime: formatDisplayTime(entry.end),
				rawStart: entry.start,
				rawEnd: entry.end,
				dateLabel: formatShortDate(parsed),
				isAbsent: true,
			});
		}

		if (matchedClasses.length > 0) {
			matchedClasses.sort((a, b) => {
				if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
				return a.rawStart.localeCompare(b.rawStart);
			});
			return { classes: matchedClasses, fromWeeklyTemplate: false };
		}
	} catch (err) {
		console.warn("Direct holiday schedule query returned no classes", err);
	}

	// 2. Fallback: query standard weekly timetable & map to dates between startDate and endDate
	try {
		const { startDate: wStart, endDate: wEnd } = getWeekRange();
		const weekRes = await axios.get<ScheduleResponse>(
			`${getBaseUrl()}/api/student/schedule/class`,
			{
				params: {
					weekStartDate: wStart,
					weekEndDate: wEnd,
				},
				headers: { Authorization: formatAuthHeader(token) },
				timeout: 10000,
			},
		);

		const weekEntries = weekRes.data?.data ?? [];
		// Group week template classes by day of week (0=Sun, 1=Mon, ..., 6=Sat)
		const classesByDayOfWeek = new Map<number, ScheduleEntry[]>();
		const seenWeekly = new Set<string>();

		for (const entry of weekEntries) {
			if (entry.type !== "CLASS") continue;
			const parsed = parseScheduleDate(
				entry.lectureDate || entry.start?.split(" ")[0] || "",
			);
			if (!parsed) continue;

			const dow = parsed.getDay();
			const dedupeKey = `${entry.courseCode}-${dow}-${entry.start?.split(" ")[1] || entry.start}`;
			if (seenWeekly.has(dedupeKey)) continue;
			seenWeekly.add(dedupeKey);

			const list = classesByDayOfWeek.get(dow) || [];
			list.push(entry);
			classesByDayOfWeek.set(dow, list);
		}

		// Now project for every day in the holiday range
		const projectedClasses: PlannedClass[] = [];
		for (const day of days) {
			const dow = day.getDay();
			if (dow === 0) continue; // Skip Sundays

			const dateKey = toDateKey(day);
			if (isNonWorkingDayKey(dateKey)) continue;

			const templateClasses = classesByDayOfWeek.get(dow) || [];
			const label = formatShortDate(day);

			for (const t of templateClasses) {
				const startPart = t.start?.split(" ")[1] || t.start;
				const endPart = t.end?.split(" ")[1] || t.end;
				projectedClasses.push({
					id: `${dateKey}-${t.courseCode}-${startPart}`,
					dateKey,
					courseName: t.courseName,
					courseCode: t.courseCode,
					courseCompName: t.courseCompName,
					startTime: formatDisplayTime(t.start),
					endTime: formatDisplayTime(t.end),
					rawStart: `${dateKey} ${startPart}`,
					rawEnd: `${dateKey} ${endPart}`,
					dateLabel: label,
					isAbsent: true,
				});
			}
		}

		projectedClasses.sort((a, b) => {
			if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
			return a.rawStart.localeCompare(b.rawStart);
		});

		return { classes: projectedClasses, fromWeeklyTemplate: true };
	} catch (err) {
		console.error("Failed to generate holiday schedule template", err);
		return { classes: [], fromWeeklyTemplate: false };
	}
}

// --------------- Component ---------------

interface HolidayPlannerProps {
	showPlanner: number;
	setShowPlanner?: React.Dispatch<React.SetStateAction<number>>;
}

export default function HolidayPlanner({
	showPlanner,
	setShowPlanner,
}: HolidayPlannerProps) {
	const { attendanceData, setAttendanceData } = useAppContext();
	const [holidays, setHolidays] = useState<SavedHoliday[]>(loadHolidays);
	const [isCreating, setIsCreating] = useState(false);
	const [expandedId, setExpandedId] = useState<string | null>(null);

	// Form state
	const [formName, setFormName] = useState("");
	const [formStart, setFormStart] = useState("");
	const [formEnd, setFormEnd] = useState("");
	const [isFetchingSchedule, setIsFetchingSchedule] = useState(false);
	const [previewClasses, setPreviewClasses] = useState<PlannedClass[] | null>(
		null,
	);
	const [fromWeeklyTemplate, setFromWeeklyTemplate] = useState(false);
	const [formError, setFormError] = useState("");

	// Persist holidays whenever modified
	useEffect(() => {
		saveHolidays(holidays);
	}, [holidays]);

	// Auto-restore applied holiday projections if user refreshes page
	const hasRestoredRef = useRef(false);
	useEffect(() => {
		if (!attendanceData || hasRestoredRef.current) return;

		const appliedHoliday = holidays.find((h) => h.applied);
		if (!appliedHoliday) return;

		const alreadyProjected =
			attendanceData.attendanceCourseComponentInfoList.some(
				(c) => c.attendanceCourseComponentNameInfoList[0]?.isProjected,
			);

		if (!alreadyProjected) {
			hasRestoredRef.current = true;
			const counts = appliedHoliday.appliedCounts;
			setAttendanceData((prev) => {
				if (!prev) return prev;
				const updated = prev.attendanceCourseComponentInfoList.map((course) => {
					const absentCount = counts[course.courseCode] || 0;
					if (absentCount === 0) return course;
					const updatedList = [...course.attendanceCourseComponentNameInfoList];
					updatedList[0] = {
						...updatedList[0],
						numberOfPeriods: updatedList[0].numberOfPeriods + absentCount,
						isProjected: true,
					};
					return {
						...course,
						attendanceCourseComponentNameInfoList: updatedList,
					};
				});
				return { ...prev, attendanceCourseComponentInfoList: updated };
			});
		}
	}, [attendanceData, holidays, setAttendanceData]);

	// Preset button for Diwali
	const handlePresetDiwali = () => {
		const currentYear = new Date().getFullYear();
		setFormName("Diwali Break");
		// Formats "YYYY-11-04" and "YYYY-11-17"
		setFormStart(`${currentYear}-11-04`);
		setFormEnd(`${currentYear}-11-17`);
		setPreviewClasses(null);
		setFormError("");
	};

	// Fetch schedule preview for the form
	const handleFetchPreview = async () => {
		if (!formName.trim()) {
			setFormError("Please enter a holiday name.");
			return;
		}
		if (!formStart || !formEnd) {
			setFormError("Please select both start and end dates.");
			return;
		}
		if (formStart > formEnd) {
			setFormError("End date cannot be earlier than start date.");
			return;
		}

		setFormError("");
		setIsFetchingSchedule(true);
		try {
			const { classes, fromWeeklyTemplate } = await fetchScheduleForHoliday(
				formStart,
				formEnd,
			);
			setPreviewClasses(classes);
			setFromWeeklyTemplate(fromWeeklyTemplate);
		} catch {
			setFormError("Failed to fetch schedule for the given dates.");
		} finally {
			setIsFetchingSchedule(false);
		}
	};

	// Toggle individual class in preview
	const togglePreviewClass = (classId: string) => {
		setPreviewClasses((prev) =>
			prev
				? prev.map((c) =>
						c.id === classId ? { ...c, isAbsent: !c.isAbsent } : c,
					)
				: null,
		);
	};

	// Toggle all classes for a specific date in preview
	const togglePreviewDate = (dateKey: string, forceAbsent?: boolean) => {
		setPreviewClasses((prev) => {
			if (!prev) return null;
			const targetClasses = prev.filter((c) => c.dateKey === dateKey);
			const allAbsent = targetClasses.every((c) => c.isAbsent);
			const nextState = forceAbsent !== undefined ? forceAbsent : !allAbsent;
			return prev.map((c) =>
				c.dateKey === dateKey ? { ...c, isAbsent: nextState } : c,
			);
		});
	};

	// Save the new holiday
	const handleSaveNewHoliday = () => {
		if (!previewClasses || previewClasses.length === 0) return;

		const holiday: SavedHoliday = {
			id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			name: formName.trim(),
			startDate: formStart,
			endDate: formEnd,
			applied: false,
			appliedCounts: {},
			classes: previewClasses,
			isGeneratedFromWeeklyTemplate: fromWeeklyTemplate,
		};

		setHolidays((prev) => [...prev, holiday]);
		setExpandedId(holiday.id);
		setIsCreating(false);
		setFormName("");
		setFormStart("");
		setFormEnd("");
		setPreviewClasses(null);
		setFormError("");
	};

	// Toggle a class in an already saved holiday
	const toggleSavedClass = (holidayId: string, classId: string) => {
		setHolidays((prev) =>
			prev.map((h) => {
				if (h.id !== holidayId) return h;
				if (h.applied) return h; // Can't toggle when applied; must undo first
				return {
					...h,
					classes: h.classes.map((c) =>
						c.id === classId ? { ...c, isAbsent: !c.isAbsent } : c,
					),
				};
			}),
		);
	};

	// Apply holiday in one click
	const handleApplyHoliday = useCallback(
		(holidayId: string) => {
			const holiday = holidays.find((h) => h.id === holidayId);
			if (!holiday) return;

			// Calculate absent count by courseCode
			const counts: Record<string, number> = {};
			for (const c of holiday.classes) {
				if (c.isAbsent) {
					counts[c.courseCode] = (counts[c.courseCode] || 0) + 1;
				}
			}

			// Update attendance data
			setAttendanceData((prevData) => {
				if (!prevData) return prevData;
				const updatedList = prevData.attendanceCourseComponentInfoList.map(
					(course) => {
						const absentCount = counts[course.courseCode] || 0;
						if (absentCount === 0) return course;

						const updatedComp = [
							...course.attendanceCourseComponentNameInfoList,
						];
						updatedComp[0] = {
							...updatedComp[0],
							numberOfPeriods: updatedComp[0].numberOfPeriods + absentCount,
							isProjected: true,
						};
						return {
							...course,
							attendanceCourseComponentNameInfoList: updatedComp,
						};
					},
				);
				return {
					...prevData,
					attendanceCourseComponentInfoList: updatedList,
				};
			});

			setHolidays((prev) =>
				prev.map((h) =>
					h.id === holidayId
						? { ...h, applied: true, appliedCounts: counts }
						: h,
				),
			);
		},
		[holidays, setAttendanceData],
	);

	// Undo / unapply holiday
	const handleUnapplyHoliday = useCallback(
		(holidayId: string) => {
			const holiday = holidays.find((h) => h.id === holidayId);
			if (!holiday || !holiday.applied) return;

			const counts = holiday.appliedCounts;

			setAttendanceData((prevData) => {
				if (!prevData) return prevData;
				const updatedList = prevData.attendanceCourseComponentInfoList.map(
					(course) => {
						const absentCount = counts[course.courseCode] || 0;
						if (absentCount === 0) return course;

						const updatedComp = [
							...course.attendanceCourseComponentNameInfoList,
						];
						const newPeriods = Math.max(
							0,
							updatedComp[0].numberOfPeriods - absentCount,
						);
						updatedComp[0] = {
							...updatedComp[0],
							numberOfPeriods: newPeriods,
							isProjected: false,
						};
						return {
							...course,
							attendanceCourseComponentNameInfoList: updatedComp,
						};
					},
				);
				return {
					...prevData,
					attendanceCourseComponentInfoList: updatedList,
				};
			});

			setHolidays((prev) =>
				prev.map((h) =>
					h.id === holidayId ? { ...h, applied: false, appliedCounts: {} } : h,
				),
			);
		},
		[holidays, setAttendanceData],
	);

	// Delete a holiday
	const handleDeleteHoliday = (holidayId: string) => {
		const holiday = holidays.find((h) => h.id === holidayId);
		if (holiday?.applied) {
			handleUnapplyHoliday(holidayId);
		}
		setHolidays((prev) => prev.filter((h) => h.id !== holidayId));
		if (expandedId === holidayId) {
			setExpandedId(null);
		}
	};

	// Refresh/re-sync holiday schedule from ERP
	const handleRefreshHolidaySchedule = async (holidayId: string) => {
		const holiday = holidays.find((h) => h.id === holidayId);
		if (!holiday || holiday.applied) return;

		setIsFetchingSchedule(true);
		try {
			const { classes, fromWeeklyTemplate } = await fetchScheduleForHoliday(
				holiday.startDate,
				holiday.endDate,
			);
			if (classes.length > 0) {
				setHolidays((prev) =>
					prev.map((h) =>
						h.id === holidayId
							? {
									...h,
									classes,
									isGeneratedFromWeeklyTemplate: fromWeeklyTemplate,
								}
							: h,
					),
				);
			}
		} finally {
			setIsFetchingSchedule(false);
		}
	};

	// Active holiday applied banner
	const appliedHoliday = useMemo(
		() => holidays.find((h) => h.applied),
		[holidays],
	);

	const isVisible = showPlanner % 2 === 1;

	return (
		<div>
			{/* Persistent Active Holiday Notification Banner */}
			{appliedHoliday && (
				<div className="bg-amber-100 border-2 border-amber-600 rounded-lg p-3 mb-4 style-fade-in flex flex-wrap items-center justify-between gap-3 shadow-sm">
					<div className="flex items-center gap-2">
						<Palmtree className="h-5 w-5 text-amber-700 shrink-0" />
						<div>
							<span className="font-bold text-xs text-amber-950 uppercase tracking-wide">
								Holiday Plan Active: {appliedHoliday.name}
							</span>
							<p className="text-xs text-amber-800">
								{Object.values(appliedHoliday.appliedCounts).reduce(
									(a, b) => a + b,
									0,
								)}{" "}
								classes marked absent (
								{formatReadableRange(
									appliedHoliday.startDate,
									appliedHoliday.endDate,
								)}
								). Projections are active below.
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{setShowPlanner && !isVisible && (
							<button
								type="button"
								onClick={() => setShowPlanner((prev) => prev + 1)}
								className="text-xs font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-300 px-2.5 py-1 rounded cursor-pointer transition-colors"
							>
								View Plan
							</button>
						)}
						<button
							type="button"
							onClick={() => handleUnapplyHoliday(appliedHoliday.id)}
							className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded cursor-pointer transition-colors flex items-center gap-1"
						>
							<Undo2 className="h-3 w-3" />
							Undo Holiday
						</button>
					</div>
				</div>
			)}

			{/* Main Holiday Planner Card */}
			<div className={`${isVisible ? "block" : "hidden"}`}>
				<div className="bg-white rounded-lg shadow-md p-6 mb-8 style-border style-fade-in">
					{/* Header */}
					<div className="flex flex-wrap items-center justify-between gap-3 mb-4">
						<div className="flex items-center gap-2">
							<Palmtree className="h-6 w-6 text-amber-600" />
							<div>
								<h3 className="style-text text-md font-semibold text-black">
									Pre-Plan Holidays
								</h3>
								<p className="text-xs text-gray-500">
									Plan holidays like Diwali in advance, see all classes, and
									apply absences in one click.
								</p>
								{NON_WORKING_DAYS.length > 0 && (
									<div className="flex flex-wrap items-center gap-1.5 mt-1.5">
										<span className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
											Non-working day
											{NON_WORKING_DAYS.length > 1 ? "s" : ""}:
										</span>
										{NON_WORKING_DAYS.map((dateKey) => (
											<span
												key={dateKey}
												className="text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-300 rounded px-1.5 py-0.5"
											>
												{formatNonWorkingDay(dateKey)}
											</span>
										))}
									</div>
								)}
							</div>
						</div>
						<button
							type="button"
							onClick={() => {
								setIsCreating(!isCreating);
								setPreviewClasses(null);
								setFormError("");
							}}
							className="style-border style-text py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors"
						>
							{isCreating ? (
								<X className="h-3.5 w-3.5" />
							) : (
								<Plus className="h-3.5 w-3.5" />
							)}
							{isCreating ? "Cancel" : "New Holiday"}
						</button>
					</div>

					{/* Create Holiday Menu */}
					{isCreating && (
						<div className="border-2 border-black rounded-lg p-4 mb-6 bg-amber-50/40 style-fade-in">
							<div className="flex items-center justify-between mb-3">
								<span className="style-text text-xs font-bold text-black flex items-center gap-1.5">
									<Sparkles className="h-4 w-4 text-amber-600" />
									Configure Holiday Schedule
								</span>
								<button
									type="button"
									onClick={handlePresetDiwali}
									className="text-xs font-bold text-amber-800 bg-amber-200/70 hover:bg-amber-200 px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1"
								>
									✨ Use Diwali Preset (4 Nov – 17 Nov)
								</button>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
								<div>
									<label
										htmlFor="holiday-name"
										className="style-text text-[11px] font-bold text-gray-700 block mb-1"
									>
										Holiday Name
									</label>
									<input
										id="holiday-name"
										type="text"
										value={formName}
										onChange={(e) => setFormName(e.target.value)}
										placeholder="e.g. Diwali Break"
										className="w-full px-3 py-2 text-sm border-2 border-black rounded bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
									/>
								</div>
								<div>
									<label
										htmlFor="holiday-start"
										className="style-text text-[11px] font-bold text-gray-700 block mb-1"
									>
										Start Date
									</label>
									<input
										id="holiday-start"
										type="date"
										value={formStart}
										onChange={(e) => setFormStart(e.target.value)}
										className="w-full px-3 py-2 text-sm border-2 border-black rounded bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
									/>
								</div>
								<div>
									<label
										htmlFor="holiday-end"
										className="style-text text-[11px] font-bold text-gray-700 block mb-1"
									>
										End Date
									</label>
									<input
										id="holiday-end"
										type="date"
										value={formEnd}
										min={formStart || undefined}
										onChange={(e) => setFormEnd(e.target.value)}
										className="w-full px-3 py-2 text-sm border-2 border-black rounded bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
									/>
								</div>
							</div>

							{formError && (
								<p className="text-xs text-red-600 font-semibold mb-3 flex items-center gap-1">
									<AlertCircle className="h-3.5 w-3.5" />
									{formError}
								</p>
							)}

							{/* Fetch schedule button */}
							{!previewClasses && (
								<button
									type="button"
									onClick={handleFetchPreview}
									disabled={
										isFetchingSchedule ||
										!formName.trim() ||
										!formStart ||
										!formEnd
									}
									className="style-border style-text w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isFetchingSchedule ? (
										<RefreshCw className="h-4 w-4 animate-spin" />
									) : (
										<CalendarPlus className="h-4 w-4" />
									)}
									{isFetchingSchedule
										? "Building Holiday Schedule..."
										: "Load Schedule For These Dates"}
								</button>
							)}

							{/* Preview of schedule for given dates and all in between */}
							{previewClasses && (
								<div className="mt-4 pt-4 border-t-2 border-black/10">
									<div className="flex flex-wrap items-center justify-between gap-2 mb-3">
										<div>
											<span className="font-bold text-xs text-black uppercase">
												Schedule for {formName} (
												{formatReadableRange(formStart, formEnd)})
											</span>
											<p className="text-[11px] text-gray-500">
												{previewClasses.length} total classes found.{" "}
												{previewClasses.filter((c) => c.isAbsent).length} marked
												absent. Click any class to toggle.
											</p>
										</div>
										{fromWeeklyTemplate && (
											<span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded border border-blue-200">
												Based on regular timetable template
											</span>
										)}
									</div>

									{previewClasses.length === 0 ? (
										<p className="text-xs text-gray-500 py-3 text-center">
											No classes scheduled on these dates (e.g. weekend or
											holidays).
										</p>
									) : (
										<ScheduleTableView
											classes={previewClasses}
											onToggleClass={togglePreviewClass}
											onToggleDate={togglePreviewDate}
										/>
									)}

									<div className="mt-3 flex gap-2">
										<button
											type="button"
											onClick={handleSaveNewHoliday}
											disabled={previewClasses.length === 0}
											className="style-border style-text flex-1 py-2 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
										>
											<Check className="h-4 w-4" />
											Save Holiday Locally
										</button>
										<button
											type="button"
											onClick={() => setPreviewClasses(null)}
											className="style-border style-text py-2 px-3 text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
										>
											Back
										</button>
									</div>
								</div>
							)}
						</div>
					)}

					{/* Saved Holidays List */}
					{holidays.length === 0 && !isCreating && (
						<div className="text-center py-8 text-gray-400">
							<Palmtree className="h-10 w-10 mx-auto mb-2 opacity-30 text-amber-600" />
							<p className="style-text text-sm">No holidays planned yet</p>
							<p className="text-xs mt-1 text-gray-500">
								Click &quot;New Holiday&quot; or use the Diwali preset to
								pre-plan your holidays.
							</p>
						</div>
					)}

					{holidays.length > 0 && (
						<div className="space-y-4">
							{holidays.map((holiday) => {
								const isExpanded = expandedId === holiday.id;
								const absentClassesCount = holiday.classes.filter(
									(c) => c.isAbsent,
								).length;

								return (
									<div
										key={holiday.id}
										className={`border-2 rounded-lg overflow-hidden transition-colors ${
											holiday.applied
												? "border-amber-600 bg-amber-50/30"
												: "border-black bg-white"
										}`}
									>
										{/* Row Header */}
										<div className="flex items-center justify-between gap-3 p-4">
											<button
												type="button"
												onClick={() =>
													setExpandedId(isExpanded ? null : holiday.id)
												}
												className="flex items-center gap-3 text-left cursor-pointer bg-transparent border-none p-0 flex-1 min-w-0"
											>
												<Palmtree
													className={`h-6 w-6 shrink-0 ${
														holiday.applied ? "text-amber-600" : "text-gray-400"
													}`}
												/>
												<div className="min-w-0">
													<div className="flex items-center gap-2">
														<span className="style-text text-sm font-bold text-black truncate">
															{holiday.name}
														</span>
														{holiday.applied ? (
															<span className="style-text text-[10px] font-bold text-white bg-green-600 px-2 py-0.5 rounded-full">
																Applied ✓
															</span>
														) : (
															<span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
																Saved locally
															</span>
														)}
													</div>
													<div className="text-xs text-gray-500 mt-0.5">
														{formatReadableRange(
															holiday.startDate,
															holiday.endDate,
														)}
														{" · "}
														<span className="font-semibold text-gray-700">
															{absentClassesCount} of {holiday.classes.length}{" "}
															classes absent
														</span>
													</div>
												</div>
												{isExpanded ? (
													<ChevronUp className="h-5 w-5 text-gray-400 shrink-0" />
												) : (
													<ChevronDown className="h-5 w-5 text-gray-400 shrink-0" />
												)}
											</button>

											{/* Action Buttons */}
											<div className="flex items-center gap-2 shrink-0">
												{holiday.applied ? (
													<button
														type="button"
														onClick={() => handleUnapplyHoliday(holiday.id)}
														className="style-border style-text py-1.5 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer bg-gray-600 text-white hover:bg-gray-700 transition-colors"
													>
														<Undo2 className="h-3.5 w-3.5" />
														<span className="hide-text-below-352">Undo</span>
													</button>
												) : (
													<button
														type="button"
														onClick={() => handleApplyHoliday(holiday.id)}
														disabled={absentClassesCount === 0}
														className="style-border style-text py-1.5 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-40"
													>
														<Play className="h-3.5 w-3.5" />
														<span>Apply</span>
													</button>
												)}

												<button
													type="button"
													onClick={() => handleDeleteHoliday(holiday.id)}
													className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors cursor-pointer"
													title="Delete holiday"
												>
													<Trash2 className="h-4 w-4" />
												</button>
											</div>
										</div>

										{/* Expanded Schedule for this holiday */}
										{isExpanded && (
											<div className="border-t-2 border-black/10 bg-gray-50/70 p-4 style-fade-in">
												<div className="flex flex-wrap items-center justify-between gap-2 mb-3">
													<p className="text-xs text-gray-700 font-semibold">
														Schedule for all dates in {holiday.name}:
													</p>
													<div className="flex items-center gap-2">
														{holiday.isGeneratedFromWeeklyTemplate && (
															<span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
																From weekly timetable
															</span>
														)}
														{!holiday.applied && (
															<button
																type="button"
																onClick={() =>
																	handleRefreshHolidaySchedule(holiday.id)
																}
																disabled={isFetchingSchedule}
																className="text-[11px] font-semibold text-gray-600 hover:text-black flex items-center gap-1 cursor-pointer"
															>
																<RefreshCw
																	className={`h-3 w-3 ${isFetchingSchedule ? "animate-spin" : ""}`}
																/>
																Refresh
															</button>
														)}
													</div>
												</div>

												{holiday.classes.length === 0 ? (
													<p className="text-xs text-gray-500 py-2">
														No classes found for these dates.
													</p>
												) : (
													<ScheduleTableView
														classes={holiday.classes}
														disabled={holiday.applied}
														onToggleClass={(classId) =>
															toggleSavedClass(holiday.id, classId)
														}
													/>
												)}

												{/* One-click Action button inside card */}
												<div className="mt-4">
													{holiday.applied ? (
														<button
															type="button"
															onClick={() => handleUnapplyHoliday(holiday.id)}
															className="style-border style-text w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer bg-gray-700 text-white hover:bg-gray-800 transition-colors"
														>
															<Undo2 className="h-4 w-4" />
															Remove from Projections (Undo Absences)
														</button>
													) : (
														<button
															type="button"
															onClick={() => handleApplyHoliday(holiday.id)}
															disabled={absentClassesCount === 0}
															className="style-border style-text w-full py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-40"
														>
															<Play className="h-4 w-4" />
															Apply Holiday — Mark {absentClassesCount} Classes
															Absent in 1-Click
														</button>
													)}
												</div>
											</div>
										)}
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// --------------- Schedule Table View Sub-component ---------------

interface ScheduleTableViewProps {
	classes: PlannedClass[];
	onToggleClass: (classId: string) => void;
	onToggleDate?: (dateKey: string) => void;
	disabled?: boolean;
}

function ScheduleTableView({
	classes,
	onToggleClass,
	onToggleDate,
	disabled = false,
}: ScheduleTableViewProps) {
	// Group classes by date
	const grouped = useMemo(() => {
		const map = new Map<string, PlannedClass[]>();
		for (const c of classes) {
			const list = map.get(c.dateKey) || [];
			list.push(c);
			map.set(c.dateKey, list);
		}
		return map;
	}, [classes]);

	return (
		<div className="w-full border border-gray-200 rounded-lg overflow-x-auto custom-table-scroll bg-white">
			<table className="w-full min-w-[500px] table-fixed border-collapse bg-white text-xs">
				<thead>
					<tr className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
						<th className="p-2 text-left w-32 border-r border-gray-200 text-[10px]">
							Date
						</th>
						<th className="p-2 text-left border-r border-gray-200 text-[10px]">
							Class / Component
						</th>
						<th className="p-2 text-center w-28 border-r border-gray-200 text-[10px]">
							Time
						</th>
						<th className="p-2 text-center w-24 text-[10px]">Attendance</th>
					</tr>
				</thead>
				<tbody>
					{Array.from(grouped.entries()).map(([dateKey, dayClasses]) =>
						dayClasses.map((cls, idx) => {
							const isAbsent = cls.isAbsent;

							return (
								<tr
									key={cls.id}
									onClick={() => !disabled && onToggleClass(cls.id)}
									className={`transition-colors ${
										disabled
											? "cursor-default"
											: "cursor-pointer hover:bg-amber-50/40"
									} ${isAbsent ? "bg-red-50/20" : "bg-gray-50/30"}`}
								>
									{idx === 0 && (
										<td
											className="p-2 py-3 border-b border-r border-gray-200 bg-gray-100/70 text-left align-middle"
											rowSpan={dayClasses.length}
										>
											<div className="font-bold text-xs text-black">
												{cls.dateLabel}
											</div>
											{onToggleDate && !disabled && (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														onToggleDate(dateKey);
													}}
													className="text-[10px] text-amber-700 underline font-semibold mt-1 block"
												>
													Toggle all
												</button>
											)}
										</td>
									)}
									<td className="p-2 py-2.5 border-b border-r border-gray-100 align-middle">
										<div className="font-bold text-xs text-gray-900 leading-snug line-clamp-2">
											{cls.courseName}
										</div>
										<div className="text-[10px] text-gray-500 font-medium">
											{cls.courseCode} · {cls.courseCompName}
										</div>
									</td>
									<td className="p-2 py-2.5 border-b border-r border-gray-100 text-center align-middle text-[11px] text-gray-600 font-medium">
										{cls.startTime} – {cls.endTime}
									</td>
									<td className="p-2 py-2.5 border-b border-gray-100 text-center align-middle">
										<span
											className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
												isAbsent
													? "text-red-700 bg-red-100 border border-red-200"
													: "text-gray-500 bg-gray-100 border border-gray-200"
											}`}
										>
											{isAbsent ? "ABSENT" : "ATTEND"}
										</span>
									</td>
								</tr>
							);
						}),
					)}
				</tbody>
			</table>
		</div>
	);
}
