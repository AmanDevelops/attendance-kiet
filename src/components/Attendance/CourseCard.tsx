import { AlertTriangle, CheckCircle } from "lucide-react";
import { memo } from "react";
import { useAppContext } from "../../contexts/AppContext";
import type { CourseAttendanceInfo } from "../../types/response";
import {
	calculateAttendanceProjection,
	resolveSubjectTarget,
} from "../../utils/attendanceMath";
import type { SelectedComponentType } from "../Attendance";

interface CourseCardProps {
	onViewDaywiseAttendance: (
		course: SelectedComponentType["course"],
		component: SelectedComponentType["component"],
	) => void;
	course: CourseAttendanceInfo;
}

function CourseCard({ onViewDaywiseAttendance, course }: CourseCardProps) {
	const { targetPercentage, subjectOverrides } = useAppContext();
	const subjectMissed = 0;
	const isCustom = subjectOverrides[course.courseCode] !== undefined;
	const resolvedTarget = resolveSubjectTarget(
		course.courseCode,
		subjectOverrides,
		targetPercentage,
	);

	return (
		<div
			key={course.courseCode}
			className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 style-border style-fade-in"
		>
			<div className="flex items-start justify-between gap-2 mb-2">
				<h3 className="flex-1 min-w-0 text-sm font-bold text-gray-800 dark:text-gray-100 style-text">
					{course.courseName}
				</h3>
				<span
					className={`inline-flex items-center px-2 py-0.5 text-[10px] font-black uppercase tracking-wider shrink-0 whitespace-nowrap border-2 border-black ${
						isCustom
							? "bg-[#FEF3C7] text-[#92400E] shadow-[2px_2px_0px_#000] dark:bg-amber-950 dark:text-amber-200 dark:border-amber-400 dark:shadow-[2px_2px_0px_rgba(255,255,255,0.4)]"
							: "bg-gray-100 text-black shadow-[2px_2px_0px_#000] dark:bg-gray-700 dark:text-gray-200 dark:border-gray-400 dark:shadow-[2px_2px_0px_rgba(255,255,255,0.4)]"
					}`}
					title={
						isCustom
							? `Custom target criteria applied (${resolvedTarget}%)`
							: `Following global target criteria (${resolvedTarget}%)`
					}
				>
					TARGET: {resolvedTarget}%
				</span>
			</div>
			<p className="text-sm text-gray-600 dark:text-gray-300 mb-4 style-text">
				Code: {course.courseCode}
			</p>
			<div className="space-y-4">
				{course.attendanceCourseComponentNameInfoList.map(
					(component, _index) => {
						const projectedPresent =
							component.numberOfPresent + component.numberOfExtraAttendance;
						const projectedTotal = component.numberOfPeriods + subjectMissed;
						const projectedSubjectPercent =
							projectedTotal > 0
								? (projectedPresent / projectedTotal) * 100
								: 0;

						const currentSubjectProjection = calculateAttendanceProjection(
							component.numberOfPresent + component.numberOfExtraAttendance,
							component.numberOfPeriods + subjectMissed,
							resolvedTarget,
						);

						return (
							<div
								key={component.componentName}
								className="border-t-2 pt-4 border-black dark:border-gray-400"
							>
								<div className="flex justify-between items-center mb-2">
									<span className="text-sm font-medium text-gray-700 dark:text-gray-200 style-text">
										{component.componentName}
									</span>
									<span
										className={`text-sm font-semibold ${
											projectedSubjectPercent >= resolvedTarget
												? "text-emerald-600 dark:text-emerald-400"
												: "text-red-600 dark:text-red-400"
										}`}
									>
										{`${projectedSubjectPercent.toFixed(1)}% ${component.isProjected ? "(Projected)" : ""}`}
									</span>
								</div>
								<div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
									Present:{" "}
									{component.numberOfPresent +
										component.numberOfExtraAttendance}
									/{component.numberOfPeriods + subjectMissed}
								</div>
								{currentSubjectProjection && (
									<>
										<div
											className={`flex items-center gap-2 text-sm ${
												currentSubjectProjection.status === "safe"
													? "text-emerald-600 dark:text-emerald-400"
													: "text-amber-600 dark:text-amber-400"
											}`}
										>
											{currentSubjectProjection.status === "safe" ? (
												<CheckCircle className="h-4 w-4" />
											) : (
												<AlertTriangle className="h-4 w-4" />
											)}
											{currentSubjectProjection.message}
										</div>
										<div className="pt-2 ">
											<button
												type="button"
												onClick={() =>
													onViewDaywiseAttendance(course, component)
												}
												className="style-border style-text py-2 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black dark:hover:text-black dark:hover:bg-white transform transition-transform duration-300 hover:-translate-y-1 focus:outline-none hover:transition-all hover:duration-300"
											>
												See Daywise Attendance
											</button>
										</div>
									</>
								)}
							</div>
						);
					},
				)}
			</div>
		</div>
	);
}

export default memo(CourseCard);
