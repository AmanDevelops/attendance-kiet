import { AlertTriangle, CheckCircle } from "lucide-react";
import { memo } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { TARGET_PERCENTAGE } from "../../types/constants";
import type { CourseAttendanceInfo } from "../../types/response";
import type { SelectedComponentType } from "../Attendance";

interface CourseCardProps {
	onViewDaywiseAttendance: (
		course: SelectedComponentType["course"],
		component: SelectedComponentType["component"],
	) => void;
	course: CourseAttendanceInfo;
}

function calculateAttendanceProjection(
	present: number,
	total: number,
	targetPercentage: number = TARGET_PERCENTAGE,
) {
	if (total === 0) {
		return { status: "safe", message: "No classes held yet." };
	}
	const currentPercentage = (present / total) * 100;

	if (currentPercentage >= targetPercentage) {
		const canMiss = Math.floor(
			(present - (targetPercentage / 100) * total) / (targetPercentage / 100),
		);
		return {
			status: "safe",
			message:
				canMiss > 0
					? `You can miss ${canMiss} class${canMiss === 1 ? "" : "es"} only`
					: "Try not to miss any more classes",
		};
	} else {
		const needToAttend = Math.ceil(
			((targetPercentage / 100) * total - present) /
				(1 - targetPercentage / 100),
		);
		return {
			status: "warning",
			message: `Need to attend next ${needToAttend} class${
				needToAttend === 1 ? "" : "es"
			}`,
		};
	}
}

function CourseCard({ onViewDaywiseAttendance, course }: CourseCardProps) {
	const { targetPercentage, theme } = useAppContext();
	const subjectMissed = 0;

	return (
		<div
			key={course.courseCode}
			className="rounded-lg shadow-md p-6 style-border style-fade-in transition-colors duration-200"
			style={{
				backgroundColor: theme === "dark" ? "#1f2937" : "#ffffff",
				color: theme === "dark" ? "#ffffff" : "#000000",
				borderColor: theme === "dark" ? "#ffffff" : "#000000",
			}}
		>
			<h3
				className={`text-sm font-bold mb-2 style-text ${theme === "dark" ? "text-white" : "text-gray-900"}`}
			>
				{course.courseName}
			</h3>
			<p
				className={`text-sm mb-4 style-text ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
			>
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
							targetPercentage,
						);

						return (
							<div
								key={component.componentName}
								className={`border-t-2 pt-4 ${theme === "dark" ? "border-gray-600" : "border-black"}`}
							>
								<div className="flex justify-between items-center mb-2">
									<span
										className={`text-sm font-medium style-text ${theme === "dark" ? "text-gray-200" : "text-gray-700"}`}
									>
										{component.componentName}
									</span>
									<span
										className={`text-sm font-semibold ${
											projectedSubjectPercent >= targetPercentage
												? "text-emerald-600 dark:text-emerald-400"
												: "text-red-600 dark:text-red-400"
										}`}
									>
										{`${projectedSubjectPercent.toFixed(1)}% ${component.isProjected ? "(Projected)" : ""}`}
									</span>
								</div>
								<div
									className={`text-sm mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
								>
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
										<div className="pt-2">
											<button
												type="button"
												onClick={() =>
													onViewDaywiseAttendance(course, component)
												}
												className="style-border style-text py-2 px-3 text-xs font-black flex items-center gap-1 cursor-pointer bg-black text-white dark:text-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 transform transition-transform duration-300 hover:-translate-y-1 focus:outline-none"
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
