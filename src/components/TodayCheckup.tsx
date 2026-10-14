import Cookies from "js-cookie";
import {
	AlertTriangle,
	CalendarCheck,
	CheckCircle,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ChevronUp,
	Clock,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import type {
	CheckupEntry,
	CheckupReport,
	CheckupSubject,
	CheckupVerdict,
} from "../types/checkup";
import {
	AUTH_COOKIE_NAME,
	COOKIE_EXPIRY,
	STUDENT_ID_COOKIE_NAME,
} from "../types/constants";
import { fetchStudentId } from "../types/utils";
import { runCheckup, toDateKey } from "../utils/checkup";

function startOfDay(date: Date): Date {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function formatDateLabel(date: Date, isToday: boolean): string {
	if (isToday) return "TODAY";
	const yesterday = startOfDay(new Date());
	yesterday.setDate(yesterday.getDate() - 1);
	if (toDateKey(date) === toDateKey(yesterday)) return "YESTERDAY";
	return date
		.toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
			year: "numeric",
		})
		.toUpperCase();
}

const VERDICT_STYLE: Record<
	CheckupVerdict,
	{ label: string; className: string }
> = {
	present: { label: "Present", className: "text-emerald-600" },
	absent: { label: "Absent", className: "text-red-600" },
	"not-marked": { label: "Not marked", className: "text-amber-600" },
	upcoming: { label: "Upcoming", className: "text-blue-600" },
	unknown: { label: "Unknown", className: "text-gray-500" },
};

function VerdictBadge({ verdict }: { verdict: CheckupVerdict }) {
	const { label, className } = VERDICT_STYLE[verdict];
	const Icon =
		verdict === "present"
			? CheckCircle
			: verdict === "absent"
				? XCircle
				: verdict === "upcoming"
					? Clock
					: AlertTriangle;
	return (
		<span className={`flex items-center gap-1 text-xs font-bold ${className}`}>
			<Icon className="h-4 w-4" />
			{label}
		</span>
	);
}

function SkeletonRow() {
	return (
		<div className="animate-pulse flex items-center gap-3 py-2">
			<div className="h-4 w-20 bg-gray-200" />
			<div className="h-4 w-32 bg-gray-200" />
		</div>
	);
}

function SubjectBlock({ subject }: { subject: CheckupSubject }) {
	const unrecorded =
		subject.completeness !== undefined
			? subject.completeness.expected - subject.completeness.recorded
			: 0;

	return (
		<div className="border-t-2 border-black pt-3 mt-3 first:border-t-0 first:mt-0 first:pt-0">
			<div className="flex flex-wrap justify-between items-center gap-2 mb-1">
				<span className="text-sm font-bold text-gray-800 style-text uppercase">
					{subject.courseName}
				</span>
				<span className="text-xs text-gray-500 uppercase">
					{subject.courseCompName}
				</span>
			</div>

			{subject.error ? (
				<p className="text-xs text-red-600">{subject.error}</p>
			) : (
				<>
					{unrecorded > 0 && (
						<p className="text-xs text-amber-600 font-semibold mb-1">
							{unrecorded} of {subject.completeness?.expected} lectures not yet
							recorded in ERP
						</p>
					)}
					{subject.entries.map((entry: CheckupEntry) => (
						<div
							key={`${subject.courseCode}-${entry.startTime}-${entry.courseCompName}`}
							className="flex flex-wrap justify-between items-center gap-2 py-1.5 border-b border-gray-100 last:border-b-0"
						>
							<span className="text-xs text-gray-700">
								{entry.startTime} – {entry.endTime}
							</span>
							<VerdictBadge verdict={entry.verdict} />
						</div>
					))}
				</>
			)}
		</div>
	);
}

function SummaryLine({ report }: { report: CheckupReport }) {
	const { present, absent, notMarked, upcoming, unknown } = report.summary;
	if (present + absent + notMarked + upcoming + unknown === 0) return null;
	const parts = [
		present > 0 ? `${present} present` : null,
		absent > 0 ? `${absent} absent` : null,
		notMarked > 0 ? `${notMarked} not marked` : null,
		upcoming > 0 ? `${upcoming} upcoming` : null,
		unknown > 0 ? `${unknown} unknown` : null,
	].filter(Boolean);
	return <span className="text-xs text-gray-600">{parts.join(" · ")}</span>;
}

interface TodayCheckupProps {
	studentId?: number | null;
}

export default function TodayCheckup({
	studentId: propStudentId,
}: TodayCheckupProps = {}) {
	const { attendanceData } = useAppContext();
	const [isExpanded, setIsExpanded] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [report, setReport] = useState<CheckupReport | null>(null);
	const [selectedDate, setSelectedDate] = useState(() =>
		startOfDay(new Date()),
	);

	const isToday = toDateKey(selectedDate) === toDateKey(new Date());

	const handleCheck = useCallback(async () => {
		const token = Cookies.get(AUTH_COOKIE_NAME) || "";
		let studentId = propStudentId ?? 0;

		if (!studentId || studentId <= 0) {
			const rawStudentId = (Cookies.get(STUDENT_ID_COOKIE_NAME) || "")
				.replace(/^"|"$/g, "")
				.trim();
			studentId = Number(rawStudentId || "0");
			if (Number.isNaN(studentId)) studentId = 0;
		}

		if (!token || !attendanceData) {
			setError("Please log in again to run the checkup.");
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			if (!studentId || studentId <= 0) {
				const fetchedId = await fetchStudentId(token);
				if (fetchedId) {
					studentId = fetchedId;
					Cookies.set(STUDENT_ID_COOKIE_NAME, String(fetchedId), {
						expires: COOKIE_EXPIRY,
					});
				} else {
					setError("Could not retrieve student ID. Please try again.");
					setIsLoading(false);
					return;
				}
			}

			// Past days have no "upcoming" lectures left, so pin the clock to the
			// end of that day; today keeps the real time for the upcoming/not-marked split.
			const effectiveNow = isToday
				? new Date()
				: new Date(
						selectedDate.getFullYear(),
						selectedDate.getMonth(),
						selectedDate.getDate(),
						23,
						59,
						59,
					);

			setReport(
				await runCheckup({
					token,
					studentId,
					attendanceData,
					now: effectiveNow,
				}),
			);
		} catch (err) {
			console.error(err);
			setError("Could not load the timetable for this day. Please try again.");
		} finally {
			setIsLoading(false);
		}
	}, [attendanceData, selectedDate, isToday, propStudentId]);

	const toggle = () => {
		const next = !isExpanded;
		setIsExpanded(next);
		// Fetches on demand only, so the dashboard load path is untouched.
		if (next && report === null && !isLoading) {
			handleCheck();
		}
	};

	// Refetches whenever the selected day changes, but only while the card is
	// open; the initial expand is handled by `toggle` above.
	// biome-ignore lint/correctness/useExhaustiveDependencies: only the date change should retrigger this, not every identity change of handleCheck/isExpanded (that would double-fetch on open).
	useEffect(() => {
		if (isExpanded) {
			handleCheck();
		}
	}, [selectedDate]);

	const goToPreviousDay = () => {
		setSelectedDate((prev) => {
			const next = new Date(prev);
			next.setDate(next.getDate() - 1);
			return next;
		});
	};

	const goToNextDay = () => {
		if (isToday) return;
		setSelectedDate((prev) => {
			const next = new Date(prev);
			next.setDate(next.getDate() + 1);
			return next;
		});
	};

	return (
		<div className="bg-white rounded-lg shadow-md p-6 mb-8 style-border style-fade-in">
			<div className="flex items-center justify-between gap-2">
				<button
					type="button"
					onClick={toggle}
					className="flex items-center gap-2 text-left cursor-pointer bg-transparent border-none p-0"
					aria-expanded={isExpanded}
				>
					<CalendarCheck className="h-6 w-6 text-blue-600 shrink-0" />
					<span className="flex flex-col items-start">
						<span className="style-text text-md font-semibold text-black uppercase">
							Today&apos;s Attendance
						</span>
						{report ? (
							report.status === "no-classes" ? (
								<span className="text-xs text-gray-500">
									No classes scheduled{isToday ? " today" : ""}
								</span>
							) : (
								<SummaryLine report={report} />
							)
						) : (
							<span className="text-xs text-gray-500">
								Tap to check which classes were marked
							</span>
						)}
					</span>
					{isExpanded ? (
						<ChevronUp className="h-5 w-5 text-gray-500" />
					) : (
						<ChevronDown className="h-5 w-5 text-gray-500" />
					)}
				</button>

				{report && !isLoading && (
					<button
						type="button"
						onClick={handleCheck}
						className="style-border style-text py-1.5 px-2 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black transition-colors uppercase"
					>
						<RefreshCw className="h-3.5 w-3.5" />
						REFRESH
					</button>
				)}
			</div>

			{isExpanded && (
				<div className="mt-4">
					<div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-gray-200">
						<button
							type="button"
							onClick={goToPreviousDay}
							disabled={isLoading}
							aria-label="Previous day"
							className="style-border p-1.5 cursor-pointer hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<span className="style-text text-sm font-bold text-black uppercase">
							{formatDateLabel(selectedDate, isToday)}
						</span>
						<button
							type="button"
							onClick={goToNextDay}
							disabled={isToday || isLoading}
							aria-label="Next day"
							className="style-border p-1.5 cursor-pointer hover:bg-black hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</div>

					{isLoading && (
						<div>
							<SkeletonRow />
							<SkeletonRow />
							<SkeletonRow />
						</div>
					)}

					{!isLoading && error && (
						<div className="flex items-center justify-between gap-2">
							<p className="text-sm text-red-600">{error}</p>
							<button
								type="button"
								onClick={handleCheck}
								className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
							>
								Retry
							</button>
						</div>
					)}

					{!isLoading && !error && report?.status === "no-classes" && (
						<p className="text-sm text-gray-500">
							No classes scheduled{isToday ? " today" : ""}.
						</p>
					)}

					{!isLoading && !error && report?.status === "ok" && (
						<>
							{report.summary.notMarked > 0 && (
								<p className="text-xs text-amber-800 bg-[#fffbeb] border border-[#fef3c7] p-2.5 mb-3">
									&quot;Not marked&quot; means no record exists yet. Faculty may
									simply not have marked it at the time you checked.
								</p>
							)}
							{report.subjects.map((subject) => (
								<SubjectBlock
									key={`${subject.courseCode}-${subject.courseCompName}`}
									subject={subject}
								/>
							))}
						</>
					)}
				</div>
			)}
		</div>
	);
}
