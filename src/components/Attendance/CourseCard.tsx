import { AlertTriangle, CheckCircle } from "lucide-react";
import { TARGET_PERCENTAGE } from "../../types/constants";
import type { AttendanceResponse } from "../../types/response";
import type { SelectedComponentType } from "../Attendance";

interface CourseCardProps {
	onViewDaywiseAttendance: (
		course: SelectedComponentType["course"],
		component: SelectedComponentType["component"],
	) => void;
	course: AttendanceResponse["data"]["attendanceCourseComponentInfoList"][number];
}

function calculateAttendanceProjection(present: number, total: number) {
	if (total === 0) {
		return { status: "safe", message: "No classes held yet." };
	}
	const currentPercentage = (present / total) * 100;

	if (currentPercentage >= TARGET_PERCENTAGE) {
		const canMiss = Math.floor(
			(present - (TARGET_PERCENTAGE / 100) * total) / (TARGET_PERCENTAGE / 100),
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
			((TARGET_PERCENTAGE / 100) * total - present) /
				(1 - TARGET_PERCENTAGE / 100),
		);
		return {
			status: "warning",
			message: `Need to attend next ${needToAttend} class${
				needToAttend === 1 ? "" : "es"
			}`,
		};
	}
}

export default function CourseCard({
	onViewDaywiseAttendance,
	course,
}: CourseCardProps) {
	const subjectMissed = 0;

	return (
		<div
			key={course.courseCode}
			className="bg-white rounded-lg shadow-md p-6 style-border style-fade-in"
		>
			<h3 className="text-sm font-bold text-gray-800 mb-2 style-text">
				{course.courseName}
			</h3>
			<p className="text-sm text-gray-600 mb-4 style-text">
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
						);

						return (
							<div
								key={component.componentName}
								className="border-t-2 pt-4 border-black"
							>
								<div className="flex justify-between items-center mb-2">
									<span className="text-sm font-medium text-gray-700 style-text">
										{component.componentName}
									</span>
									<span
										className={`text-sm font-semibold ${
											projectedSubjectPercent >= TARGET_PERCENTAGE
												? "text-emerald-600"
												: "text-red-600"
										}`}
									>
										{`${projectedSubjectPercent.toFixed(0)}% ${subjectMissed ? "(Projected)" : ""}`}
									</span>
								</div>
								<div className="text-sm text-gray-600 mb-2">
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
													? "text-emerald-600"
													: "text-amber-600"
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
												className="style-border style-text py-2 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black transform transition-transform duration-300 hover:-translate-y-1 focus:outline-none hover:transition-all hover:duration-300"
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
