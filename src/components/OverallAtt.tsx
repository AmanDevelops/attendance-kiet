import ProgressBar from "@ramonak/react-progress-bar";
import { memo } from "react";
import { useAppContext } from "../contexts/AppContext";

const attendanceColour = {
	above80: "22c55e",
	below80: "eab308",
	below75: "dc2626",
};

const OverallAtt = memo(function OverallAtt() {
	const { attendanceData } = useAppContext();

	if (!attendanceData) return;

	let totalClasses = 0;
	let presentClasses = 0;

	attendanceData.data.attendanceCourseComponentInfoList.forEach((course) => {
		const courseData = course.attendanceCourseComponentNameInfoList[0];

		totalClasses += courseData.numberOfPeriods;
		presentClasses +=
			courseData.numberOfExtraAttendance + courseData.numberOfPresent;
	});

	function handleAttendanceSliderColour(): string {
		const percentage = (presentClasses / totalClasses) * 100;

		if (percentage >= 80) {
			return attendanceColour.above80;
		} else if (percentage >= 75) {
			return attendanceColour.below80;
		} else {
			return attendanceColour.below75;
		}
	}

	function handleLabelSize(): number {
		if (window.innerWidth > 476) {
			return 35;
		} else {
			return 15;
		}
	}

	function handleProgressBarSize(): number {
		if (window.innerWidth > 476) {
			return 50;
		} else {
			return 25;
		}
	}
	return (
		<div className="bg-white rounded-lg shadow-md p-6 mb-8 style-border style-fade-in m-auto">
			<h1 className="text-2xl mb-1 ml-1 font-bold">Overall Attendance</h1>

			<ProgressBar
				completed={((presentClasses / totalClasses) * 100).toFixed(0)}
				bgColor={`#${handleAttendanceSliderColour()}`}
				height={`${handleProgressBarSize()}px`}
				labelAlignment="center"
				labelColor="#ffffff"
				labelSize={`${handleLabelSize()}px`}
				animateOnRender
				customLabel={`${((presentClasses / totalClasses) * 100).toFixed(1)}%`}
			/>
		</div>
	);
});

export default OverallAtt;
