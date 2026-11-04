import axios from "axios";
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
	Loader2,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import type {
	CheckupEntry,
	CheckupProgress,
	CheckupReport,
	CheckupSubject,
	CheckupVerdict,
} from "../types/checkup";
import {
	AUTH_COOKIE_NAME,
	COOKIE_EXPIRY,
	STUDENT_ID_COOKIE_NAME,
} from "../types/constants";
import { fetchStudentId, isNonWorkingDayKey, toDateKey } from "../types/utils";
import { runCheckup } from "../utils/checkup";

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

type WaitStage = "idle" | "loading" | "slow" | "stalled";

interface CheckupFailure {
	title: string;
	message: string;
	note?: string;
}

function WaitStatus({
	stage,
	progress,
}: {
	stage: WaitStage;
	progress: CheckupProgress | null;
}) {
	const completed = progress?.completed ?? 0;
	const total = progress?.total ?? 0;
	const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

	if (stage === "slow" || stage === "stalled") {
		const stalled = stage === "stalled";
		return (
			<output
				aria-live="polite"
				className={`block border p-3 mb-3 ${stalled ? "border-amber-300 bg-amber-50" : "border-amber-200 bg-[#fffbeb]"}`}
			>
				<div className="flex items-start gap-2.5">
					<span
						className={`mt-0.5 shrink-0 ${stalled ? "text-amber-700" : "text-amber-600"}`}
					>
						{stalled ? (
							<AlertTriangle className="h-4 w-4" />
						) : (
							<Clock className="h-4 w-4 animate-pulse" />
						)}
					</span>
					<div className="min-w-0 flex-1">
						<p className="text-sm font-bold text-amber-900">
							{stalled
								? "CyberVidya is still not responding"
								: "CyberVidya is taking longer than usual"}
						</p>
						<p className="text-xs text-amber-800 mt-1">
							{stalled
								? "Its attendance service is under heavy load right now. The checkup is still waiting and will show whatever CyberVidya returns."
								: "Its attendance service is responding slowly right now. Results will appear here automatically as each subject is checked."}
						</p>
						<p className="text-[11px] font-semibold text-amber-700 mt-1.5">
							This delay is on CyberVidya&apos;s side — nothing is wrong with
							your account.
						</p>
						{total > 0 && (
							<div className="mt-2">
								<div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-amber-700">
									<span>
										{completed} of {total} subjects checked
									</span>
									<span>{percent}%</span>
								</div>
								<div className="mt-1 h-1 w-full bg-amber-200">
									<div
										className="h-1 bg-amber-500 transition-all duration-500"
										style={{ width: `${percent}%` }}
									/>
								</div>
							</div>
						)}
					</div>
				</div>
			</output>
		);
	}

	return (
		<output aria-live="polite" className="block mb-3">
			<div className="flex items-center justify-between gap-2">
				<span className="flex items-center gap-2 text-xs text-gray-500">
					<Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
					{completed > 0
						? `${completed} of ${total} subjects checked · waiting on CyberVidya…`
						: "Checking today's classes with CyberVidya…"}
				</span>
				{total > 0 && (
					<span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
						{percent}%
					</span>
				)}
			</div>
			{total > 0 && (
				<div className="mt-2 h-1 w-full bg-gray-100">
					<div
						className="h-1 bg-blue-600 transition-all duration-500"
						style={{ width: `${percent}%` }}
					/>
				</div>
			)}
		</output>
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
				<div className="flex items-start gap-2 border border-amber-200 bg-[#fffbeb] p-2 mt-1">
					<AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
					<p className="text-xs text-amber-800">{subject.error}</p>
				</div>
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
	const unavailable = report.subjects.filter((subject) => subject.error).length;
	if (present + absent + notMarked + upcoming + unknown + unavailable === 0)
		return null;
	const parts = [
		present > 0 ? `${present} present` : null,
		absent > 0 ? `${absent} absent` : null,
		notMarked > 0 ? `${notMarked} not marked` : null,
		upcoming > 0 ? `${upcoming} upcoming` : null,
		unknown > 0 ? `${unknown} unknown` : null,
		unavailable > 0 ? `${unavailable} unavailable` : null,
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
	const [waitStage, setWaitStage] = useState<WaitStage>("idle");
	const [progress, setProgress] = useState<CheckupProgress | null>(null);
	const [error, setError] = useState<CheckupFailure | null>(null);
	const [report, setReport] = useState<CheckupReport | null>(null);
	const [selectedDate, setSelectedDate] = useState(() =>
		startOfDay(new Date()),
	);

	const isToday = toDateKey(selectedDate) === toDateKey(new Date());
	const isSelectedDateNonWorking = isNonWorkingDayKey(toDateKey(selectedDate));

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
			setError({
				title: "Please log in again",
				message: "Your session has ended, so the checkup can't run.",
			});
			return;
		}

		setIsLoading(true);
		setWaitStage("loading");
		setProgress(null);
		setError(null);

		try {
			if (!studentId || studentId <= 0) {
				const fetchedId = await fetchStudentId(token);
				if (fetchedId) {
					studentId = fetchedId;
					Cookies.set(STUDENT_ID_COOKIE_NAME, String(fetchedId), {
						expires: COOKIE_EXPIRY,
					});
				} else {
					setError({
						title: "CyberVidya didn't return your student details",
						message:
							"Its attendance service didn't respond in time. Please try again in a moment.",
						note: "This is on CyberVidya's side — your account is fine.",
					});
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
					onProgress: setProgress,
				}),
			);
		} catch (err) {
			console.error(err);
			if (
				axios.isAxiosError(err) &&
				(err.response?.status === 401 || err.response?.status === 403)
			) {
				setError({
					title: "Session expired",
					message: "Please log in again to run the checkup.",
				});
			} else {
				setError({
					title: "CyberVidya didn't load the timetable",
					message:
						"Its attendance service didn't respond for this day. Please try again in a moment.",
					note: "This is a CyberVidya service issue — your account is fine.",
				});
			}
		} finally {
			setIsLoading(false);
		}
	}, [attendanceData, selectedDate, isToday, propStudentId]);

	// Stage the wait copy so a long request has visible feedback before it
	// resolves.
	useEffect(() => {
		if (!isLoading) {
			setWaitStage("idle");
			return;
		}

		setWaitStage("loading");
		const slowTimer = window.setTimeout(() => setWaitStage("slow"), 5000);
		const stalledTimer = window.setTimeout(
			() => setWaitStage("stalled"),
			18000,
		);

		return () => {
			window.clearTimeout(slowTimer);
			window.clearTimeout(stalledTimer);
		};
	}, [isLoading]);

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
						{isLoading ? (
							<span
								className={`text-xs ${waitStage === "slow" || waitStage === "stalled" ? "text-amber-600" : "text-gray-500"}`}
							>
								{waitStage === "stalled"
									? "CyberVidya is not responding"
									: waitStage === "slow"
										? "CyberVidya is responding slowly"
										: "Checking with CyberVidya…"}
							</span>
						) : error ? (
							<span className="text-xs text-red-600">{error.title}</span>
						) : report ? (
							report.status === "no-classes" ? (
								<span className="text-xs text-gray-500">
									{isSelectedDateNonWorking
										? "Non-working day"
										: `No classes scheduled${isToday ? " today" : ""}`}
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
							<WaitStatus stage={waitStage} progress={progress} />
							{progress && progress.subjects.length > 0 ? (
								<>
									{progress.subjects.map((subject) => (
										<SubjectBlock
											key={`${subject.courseCode}-${subject.courseCompName}`}
											subject={subject}
										/>
									))}
									{progress.completed < progress.total && (
										<div className="flex items-center gap-2 pt-3 mt-3 border-t border-gray-200 text-xs text-gray-500">
											<Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
											Still checking{" "}
											{progress.total - progress.completed === 1
												? "1 more subject"
												: `${progress.total - progress.completed} more subjects`}{" "}
											with CyberVidya…
										</div>
									)}
								</>
							) : (
								<div>
									<SkeletonRow />
									<SkeletonRow />
									<SkeletonRow />
								</div>
							)}
						</div>
					)}

					{!isLoading && error && (
						<div role="alert" className="border border-red-200 bg-red-50 p-3">
							<div className="flex flex-wrap items-start gap-2.5">
								<AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
								<div className="min-w-[200px] flex-1">
									<p className="text-sm font-bold text-red-800">
										{error.title}
									</p>
									<p className="text-xs text-red-700 mt-1">{error.message}</p>
									{error.note && (
										<p className="text-[11px] text-red-700/80 mt-1.5">
											{error.note}
										</p>
									)}
								</div>
								<button
									type="button"
									onClick={handleCheck}
									className="style-border style-text shrink-0 py-1.5 px-2 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black transition-colors uppercase"
								>
									<RefreshCw className="h-3.5 w-3.5" />
									Try again
								</button>
							</div>
						</div>
					)}

					{!isLoading && !error && report?.status === "no-classes" && (
						<p className="text-sm text-gray-500">
							{isSelectedDateNonWorking
								? "This date is marked as a non-working day."
								: `No classes scheduled${isToday ? " today" : ""}.`}
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
