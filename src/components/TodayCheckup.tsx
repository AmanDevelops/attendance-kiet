import Cookies from "js-cookie";
import {
	AlertTriangle,
	CalendarCheck,
	CheckCircle,
	ChevronDown,
	ChevronUp,
	Clock,
	RefreshCw,
	XCircle,
} from "lucide-react";
import { useCallback, useState } from "react";
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
import { runCheckup } from "../utils/checkup";

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
				<span className="text-sm font-bold text-gray-800 style-text">
					{subject.courseName}
				</span>
				<span className="text-xs text-gray-500">{subject.courseCompName}</span>
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

export default function TodayCheckup() {
	const { attendanceData } = useAppContext();
	const [isExpanded, setIsExpanded] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [report, setReport] = useState<CheckupReport | null>(null);

	const handleCheck = useCallback(async () => {
		const token = Cookies.get(AUTH_COOKIE_NAME) || "";
		let studentId = Number(Cookies.get(STUDENT_ID_COOKIE_NAME) || "0");
		if (!token || !attendanceData) {
			setError("Please log in again to run the checkup.");
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			if (!studentId) {
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

			setReport(await runCheckup({ token, studentId, attendanceData }));
		} catch (err) {
			console.error(err);
			setError("Could not load today's timetable. Please try again.");
		} finally {
			setIsLoading(false);
		}
	}, [attendanceData]);

	const toggle = () => {
		const next = !isExpanded;
		setIsExpanded(next);
		// Fetches on demand only, so the dashboard load path is untouched.
		if (next && report === null && !isLoading) {
			handleCheck();
		}
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
						<span className="style-text text-md font-semibold text-black">
							Today&apos;s Attendance
						</span>
						{report ? (
							report.status === "no-classes" ? (
								<span className="text-xs text-gray-500">
									No classes scheduled today
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
						className="style-border style-text py-1.5 px-2 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black transition-colors"
					>
						<RefreshCw className="h-3.5 w-3.5" />
						Refresh
					</button>
				)}
			</div>

			{isExpanded && (
				<div className="mt-4">
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
						<p className="text-sm text-gray-500">No classes scheduled today.</p>
					)}

					{!isLoading && !error && report?.status === "ok" && (
						<>
							{report.summary.notMarked > 0 && (
								<p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2 mb-3">
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
