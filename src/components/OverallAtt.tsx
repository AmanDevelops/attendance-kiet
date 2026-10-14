import ProgressBar from "@ramonak/react-progress-bar";
import { memo } from "react";
import { useAppContext } from "../contexts/AppContext";

const attendanceColour = {
	above80: "22c55e",
	aboveTarget: "eab308",
	belowTarget: "dc2626",
};

const OverallAtt = memo(function OverallAtt() {
	const { attendanceData, targetPercentage, setTargetPercentage } =
		useAppContext();

	if (!attendanceData) return null;

	let totalClasses = 0;
	let presentClasses = 0;

	attendanceData.attendanceCourseComponentInfoList.forEach((course) => {
		const courseData = course.attendanceCourseComponentNameInfoList[0];

		totalClasses += courseData.numberOfPeriods;
		presentClasses +=
			courseData.numberOfExtraAttendance + courseData.numberOfPresent;
	});

	function handleAttendanceSliderColour(): string {
		const percentage = (presentClasses / totalClasses) * 100;

		if (percentage >= 80) {
			return attendanceColour.above80;
		} else if (percentage >= targetPercentage) {
			return attendanceColour.aboveTarget;
		} else {
			return attendanceColour.belowTarget;
		}
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

	const toggleCriteria = () => {
		setTargetPercentage(targetPercentage === 75 ? 60 : 75);
	};

	return (
		<div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8 style-border style-fade-in m-auto">
			<div className="flex flex-wrap items-center justify-between gap-3 mb-3">
				<div>
					<h1 className="text-xl sm:text-2xl font-bold style-text">
						Overall Attendance
					</h1>
					<p className="text-[11px] sm:text-xs text-gray-500 font-medium mt-0.5">
						Target Criteria:{" "}
						<span
							className={`font-bold ${
								percentage >= targetPercentage
									? "text-emerald-600"
									: "text-red-600"
							}`}
						>
							{targetPercentage}%
						</span>
						{percentage >= targetPercentage
							? " (Target Met ✓)"
							: " (Below Target)"}
					</p>
				</div>

				{/* Mobile-Friendly Criteria Toggle with Smooth Sliding Animation (75% <-> 60%) */}
				<div className="flex items-center gap-2 self-start sm:self-center">
					<span className="text-[11px] sm:text-xs font-bold text-gray-700 style-text">
						Criteria:
					</span>
					<button
						type="button"
						onClick={toggleCriteria}
						role="switch"
						aria-checked={targetPercentage === 60}
						aria-label={`Toggle attendance criteria (currently ${targetPercentage}%)`}
						title={`Click to switch criteria to ${targetPercentage === 75 ? "60%" : "75%"}`}
						className="relative inline-flex items-center bg-gray-100 p-1 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] select-none cursor-pointer focus:outline-none transition-transform active:scale-95"
					>
						{/* Sliding animated indicator */}
						<div
							className={`absolute top-1 bottom-1 left-1 w-12 sm:w-14 bg-black rounded-sm shadow-sm transition-transform duration-300 ease-in-out pointer-events-none ${
								targetPercentage === 60 ? "translate-x-full" : "translate-x-0"
							}`}
						/>

						<span
							className={`relative z-10 w-12 sm:w-14 py-1 text-xs font-black text-center transition-colors duration-200 pointer-events-none ${
								targetPercentage === 75
									? "text-white"
									: "text-gray-600 hover:text-black"
							}`}
						>
							75%
						</span>
						<span
							className={`relative z-10 w-12 sm:w-14 py-1 text-xs font-black text-center transition-colors duration-200 pointer-events-none ${
								targetPercentage === 60
									? "text-white"
									: "text-gray-600 hover:text-black"
							}`}
						>
							60%
						</span>
					</button>
				</div>
			</div>

			<ProgressBar
				completed={percentage}
				bgColor={`#${handleAttendanceSliderColour()}`}
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
