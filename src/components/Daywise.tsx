import axios from "axios";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getBaseUrl } from "../types/constants";
import type {
	AttendanceApiResponse,
	DaywiseReportProps,
	LectureListProps,
} from "../types/response";
import { formatAuthHeader } from "../types/utils";

interface DaywiseError {
	title: string;
	message: string;
	cybervidya?: boolean;
}

function formatDate(dateString: string) {
	const date = new Date(dateString);
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = String(date.getFullYear()).slice(-2);
	return `${day}-${month}-${year}`;
}

function SkeletonRow() {
	return (
		<tr className="animate-pulse">
			<td className="p-3 border">
				<div className="h-4 bg-gray-200 rounded w-16 mx-auto" />
			</td>
			<td className="p-3 border">
				<div className="h-4 bg-gray-200 rounded w-10 mx-auto" />
			</td>
			<td className="p-3 border">
				<div className="h-4 bg-gray-200 rounded w-28 mx-auto" />
			</td>
			<td className="p-3 border">
				<div className="h-4 bg-gray-200 rounded w-16 mx-auto" />
			</td>
		</tr>
	);
}

function DaywiseReport({ token, payload }: DaywiseReportProps) {
	const [daywiseData, setDaywiseData] = useState<LectureListProps[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [slow, setSlow] = useState<boolean>(false);
	const [error, setError] = useState<DaywiseError | null>(null);
	const [reloadKey, setReloadKey] = useState(0);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reloadKey is the explicit retry trigger.
	useEffect(() => {
		let cancelled = false;

		const fetchDaywiseAttendance = async () => {
			setLoading(true);
			setError(null);

			if (
				!payload.studentId ||
				Number(payload.studentId) <= 0 ||
				Number.isNaN(Number(payload.studentId)) ||
				!payload.courseCompId ||
				!payload.courseId
			) {
				setError({
					title: "Couldn't load daywise attendance",
					message: "Missing course or student identification.",
				});
				setLoading(false);
				return;
			}

			try {
				const response = await axios.post<AttendanceApiResponse>(
					`${getBaseUrl()}/api/attendance/schedule/student/course/attendance/percentage`,
					payload,
					{
						headers: {
							"Content-Type": "application/json",
							Authorization: formatAuthHeader(token),
						},
						timeout: 15000,
					},
				);

				if (cancelled) return;

				if (response.data.data && response.data.data.length > 0) {
					const lectures = response.data.data[0].lectureList;

					// Sort descending by date
					lectures.sort(
						(a, b) =>
							new Date(b.planLecDate).getTime() -
							new Date(a.planLecDate).getTime(),
					);

					setDaywiseData(lectures);
				} else {
					setDaywiseData([]);
				}
			} catch (err: unknown) {
				if (cancelled) return;
				console.error(err);
				const status = axios.isAxiosError(err)
					? err.response?.status
					: undefined;

				if (status === 401 || status === 403) {
					setError({
						title: "Session expired",
						message: "Please log in again to view the daywise record.",
					});
				} else {
					setError({
						title: "CyberVidya didn't return this subject's attendance",
						message:
							"Its attendance service didn't respond in time. Please try again in a moment.",
						cybervidya: true,
					});
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		fetchDaywiseAttendance();

		return () => {
			cancelled = true;
		};
	}, [token, payload, reloadKey]);

	useEffect(() => {
		if (!loading) {
			setSlow(false);
			return;
		}

		const timer = window.setTimeout(() => setSlow(true), 6000);
		return () => window.clearTimeout(timer);
	}, [loading]);

	const retry = () => {
		setError(null);
		setSlow(false);
		setLoading(true);
		setReloadKey((value) => value + 1);
	};

	if (error) {
		return (
			<div role="alert" className="border border-red-200 bg-red-50 p-3">
				<div className="flex flex-wrap items-start gap-2.5">
					<AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
					<div className="min-w-[200px] flex-1">
						<p className="text-sm font-bold text-red-800">{error.title}</p>
						<p className="text-xs text-red-700 mt-1">{error.message}</p>
						{error.cybervidya && (
							<p className="text-[11px] text-red-700/80 mt-1.5">
								This is on CyberVidya&apos;s side — nothing is wrong with your
								account.
							</p>
						)}
					</div>
					<button
						type="button"
						onClick={retry}
						className="style-border style-text shrink-0 py-1.5 px-2 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black transition-colors uppercase"
					>
						<RefreshCw className="h-3.5 w-3.5" />
						Try again
					</button>
				</div>
			</div>
		);
	}

	return (
		<div>
			{loading && (
				<output
					aria-live="polite"
					className={`mb-2 flex items-start gap-2 text-xs ${slow ? "border border-amber-200 bg-[#fffbeb] p-2.5 text-amber-800" : "text-gray-500"}`}
				>
					{slow ? (
						<AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
					) : (
						<Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 shrink-0 mt-0.5" />
					)}
					<span>
						{slow
							? "CyberVidya is taking longer than usual — its attendance service is responding slowly. This table will fill in automatically."
							: "Loading this subject's attendance from CyberVidya…"}
					</span>
				</output>
			)}

			{!loading && daywiseData.length === 0 ? (
				<p className="text-sm text-gray-600">
					CyberVidya has no daywise attendance records for this subject yet.
				</p>
			) : (
				<div className="bg-white rounded-lg border-2 border-black style-fade-in overflow-x-auto max-h-[500px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
					<table className="w-full border border-gray-300">
						<thead className="bg-gray-100">
							<tr className="text-sm font-semibold text-gray-700">
								<th className="p-2 sm:p-3 border">Date</th>
								<th className="p-2 sm:p-3 border">Day</th>
								<th className="p-2 sm:p-3 border">Time Slot</th>
								<th className="p-3 sm:p-3 border">Attendance</th>
							</tr>
						</thead>
						<tbody
							className={`text-center text-gray-800 text-sm ${!loading ? "style-fade-opacity" : ""}`}
						>
							{loading ? (
								<>
									<SkeletonRow />
									<SkeletonRow />
									<SkeletonRow />
									<SkeletonRow />
								</>
							) : (
								daywiseData.map((lecture) => (
									<tr
										key={`${lecture.planLecDate}-${lecture.timeSlot}`}
										className="hover:bg-gray-50 transition-colors"
									>
										<td className="p-2 border">
											{formatDate(lecture.planLecDate)}
										</td>
										<td className="p-2 border">
											{lecture.dayName.substring(0, 3)}
										</td>
										<td className="p-2 border text-xs">{lecture.timeSlot}</td>
										<td className="p-2 border font-semibold">
											{lecture.attendance === "PRESENT" && (
												<span className="text-green-600">
													{lecture.attendance}
												</span>
											)}
											{lecture.attendance === "ADJUSTED" && (
												<span className="text-green-800">
													{lecture.attendance}
												</span>
											)}
											{lecture.attendance === "ABSENT" && (
												<span className="text-red-600">
													{lecture.attendance}
												</span>
											)}
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

export default DaywiseReport;
