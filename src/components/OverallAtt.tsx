import ProgressBar from "@ramonak/react-progress-bar";
import { Sliders } from "lucide-react";
import { memo, useState } from "react";
import { useAppContext } from "../contexts/AppContext";
import { toCount } from "../utils/attendanceMath";
import CustomizeSubjectsModal from "./Attendance/CustomizeSubjectsModal";

const attendanceColour = {
	above80: "22c55e",
	aboveTarget: "eab308",
	belowTarget: "dc2626",
};

const OverallAtt = memo(function OverallAtt() {
	const {
		attendanceData,
		targetPercentage,
		setTargetPercentage,
		subjectOverrides,
	} = useAppContext();
	const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

	if (!attendanceData) return null;

	const activeOverrideCount = Object.keys(subjectOverrides).length;

	let totalClasses = 0;
	let presentClasses = 0;

	// Every component counts: a course can have separate theory and lab rows,
	// and the overall bar used to silently ignore everything after the first.
	for (const course of attendanceData.attendanceCourseComponentInfoList ?? []) {
		const components = course.attendanceCourseComponentNameInfoList;
		if (!Array.isArray(components)) continue;

		for (const component of components) {
			if (!component) continue;
			totalClasses += toCount(component.numberOfPeriods);
			presentClasses +=
				toCount(component.numberOfExtraAttendance) +
				toCount(component.numberOfPresent);
		}
	}

	function handleAttendanceSliderColour(): string {
		if (totalClasses <= 0) return attendanceColour.belowTarget;
		const percentage = (presentClasses / totalClasses) * 100;

		if (percentage < targetPercentage) {
			return attendanceColour.belowTarget;
		}
		if (percentage >= 80) {
			return attendanceColour.above80;
		}
		return attendanceColour.aboveTarget;
	}

	function handleLabelSize(): number {
		if (window.innerWidth > 476) {
			return 35;
		}
		return 15;
	}

	function handleProgressBarSize(): number {
		if (window.innerWidth > 476) {
			return 50;
		}
		return 25;
	}

	const percentage =
		totalClasses > 0
			? Number(((presentClasses / totalClasses) * 100).toFixed(1))
			: 0;

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-8 style-border style-fade-in m-auto">
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
				<div>
					<h1 className="text-xl sm:text-2xl font-bold style-text">
						Overall Attendance
					</h1>
					<p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
						Target Criteria:{" "}
						<span
							className={`font-bold ${
								percentage >= targetPercentage
									? "text-emerald-600 dark:text-emerald-400"
									: "text-red-600 dark:text-red-400"
							}`}
						>
							{targetPercentage}%
						</span>
						{percentage >= targetPercentage
							? " (Target Met ✓)"
							: " (Below Target)"}
					</p>
				</div>

				{/* Right Side Control Box */}
				<div className="flex flex-col gap-2.5 w-full md:w-auto md:min-w-[320px]">
					{/* Top Control Row */}
					<div className="flex items-center justify-between gap-2">
						<span className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-200 style-text">
							Criteria:
						</span>
						<div className="flex items-center gap-1.5">
							<span className="inline-flex items-center justify-center min-w-[3.25rem] px-2 py-0.5 text-xs font-black bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-gray-400 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]">
								{targetPercentage}%
							</span>
							<button
								type="button"
								onClick={() => setTargetPercentage(60)}
								aria-pressed={targetPercentage === 60}
								className={`px-2 py-0.5 text-[11px] font-bold border-2 border-black dark:border-gray-400 transition-transform active:scale-95 cursor-pointer select-none ${
									targetPercentage === 60
										? "bg-black text-white dark:bg-white dark:text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]"
										: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
								}`}
							>
								60%
							</button>
							<button
								type="button"
								onClick={() => setTargetPercentage(75)}
								aria-pressed={targetPercentage === 75}
								className={`px-2 py-0.5 text-[11px] font-bold border-2 border-black dark:border-gray-400 transition-transform active:scale-95 cursor-pointer select-none ${
									targetPercentage === 75
										? "bg-black text-white dark:bg-white dark:text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]"
										: "bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
								}`}
							>
								75%
							</button>
						</div>
					</div>

					{/* Middle Control Row */}
					<div className="w-full">
						<input
							type="range"
							min="0"
							max="100"
							step="1"
							value={targetPercentage}
							onChange={(e) => setTargetPercentage(Number(e.target.value))}
							aria-label="Attendance criteria percentage"
							aria-valuemin={0}
							aria-valuemax={100}
							aria-valuenow={targetPercentage}
							className="criteria-slider w-full"
						/>
					</div>

					{/* Bottom Action Row */}
					<button
						type="button"
						onClick={() => setIsCustomizeOpen(true)}
						className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold border-2 border-black dark:border-gray-400 bg-white dark:bg-gray-800 text-black dark:text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)] hover:bg-gray-100 dark:hover:bg-gray-700 transform hover:-translate-y-0.5 active:translate-y-0 transition-transform cursor-pointer select-none style-text"
					>
						<Sliders className="w-3.5 h-3.5" />
						<span>Customize Subjects</span>
						{activeOverrideCount > 0 && (
							<span className="inline-flex items-center justify-center px-1.5 py-0.2 text-[10px] font-black bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white rounded-full">
								{activeOverrideCount}
							</span>
						)}
					</button>
				</div>
			</div>

			<CustomizeSubjectsModal
				isOpen={isCustomizeOpen}
				onClose={() => setIsCustomizeOpen(false)}
			/>

			<ProgressBar
				completed={percentage}
				bgColor={`#${handleAttendanceSliderColour()}`}
				baseBgColor="var(--progress-track)"
				height={`${handleProgressBarSize()}px`}
				labelAlignment="center"
				labelColor="#ffffff"
				labelSize={`${handleLabelSize()}px`}
				animateOnRender
				customLabel={`${percentage}%`}
			/>
		</div>
	);
});

export default OverallAtt;
