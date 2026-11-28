import { RotateCcw, Sliders, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useAppContext } from "../../contexts/AppContext";
import { resolveSubjectTarget } from "../../utils/attendanceMath";

interface CustomizeSubjectsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function CustomizeSubjectsModal({
	isOpen,
	onClose,
}: CustomizeSubjectsModalProps) {
	const {
		attendanceData,
		targetPercentage,
		subjectOverrides,
		setSubjectOverride,
		removeSubjectOverride,
		resetAllSubjectOverrides,
	} = useAppContext();

	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		const originalOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			window.removeEventListener("keydown", handleKeyDown);
			document.body.style.overflow = originalOverflow;
		};
	}, [isOpen, onClose]);

	if (!isOpen || typeof document === "undefined") return null;

	const courses = attendanceData?.attendanceCourseComponentInfoList ?? [];
	const activeOverrideCount = Object.keys(subjectOverrides).length;

	return createPortal(
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
			role="dialog"
			aria-modal="true"
			aria-labelledby="customize-subjects-title"
		>
			{/* Dark Backdrop */}
			<div
				className="fixed inset-0 bg-black/50 backdrop-blur-xs style-fade-opacity"
				onClick={onClose}
				aria-hidden="true"
			/>

			{/* Modal Dialog Content */}
			<div className="relative z-10 bg-white dark:bg-gray-800 w-[92vw] max-w-lg max-h-[85vh] flex flex-col rounded-lg style-border style-fade-in shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,0.9)] overflow-hidden">
				{/* Sticky Header */}
				<div className="shrink-0 flex items-start justify-between p-4 border-b-2 border-black dark:border-gray-400 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
					<div className="pr-3">
						<div className="flex items-center gap-2">
							<Sliders className="w-4 h-4 text-black dark:text-white shrink-0" />
							<h2
								id="customize-subjects-title"
								className="text-sm sm:text-base font-black uppercase tracking-wider style-text text-gray-900 dark:text-gray-100"
							>
								Customize by Subject
							</h2>
						</div>
						<p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 mt-1">
							Set custom target criteria per course. Non-customized subjects
							follow the global target ({targetPercentage}%).
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close customize modal"
						className="p-1 text-black dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 border-2 border-black dark:border-gray-400 rounded transition-transform active:scale-95 cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)] shrink-0"
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Scrollable Body */}
				<div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 custom-table-scroll min-h-0">
					{courses.length === 0 ? (
						<p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
							No course attendance records found.
						</p>
					) : (
						courses.map((course) => {
							const isCustom =
								subjectOverrides[course.courseCode] !== undefined;
							const currentTarget = resolveSubjectTarget(
								course.courseCode,
								subjectOverrides,
								targetPercentage,
							);

							return (
								<div
									key={course.courseCode}
									className={`p-3 rounded-md border-2 border-black dark:border-gray-400 transition-colors ${
										isCustom
											? "bg-amber-50/70 dark:bg-amber-950/25 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.4)]"
											: "bg-white dark:bg-gray-800"
									}`}
								>
									{/* Top Row: Name, code, custom tag, badge, reset button */}
									<div className="flex items-center justify-between gap-2 mb-2">
										<div className="min-w-0 flex-1 flex items-baseline gap-1.5 overflow-hidden">
											<h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
												{course.courseName}
											</h3>
											<span className="text-[10px] sm:text-[11px] font-mono text-gray-500 dark:text-gray-400 shrink-0">
												({course.courseCode})
											</span>
										</div>

										<div className="flex items-center gap-1.5 shrink-0">
											{isCustom && (
												<span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-1.5 py-0.5 border border-amber-400 dark:border-amber-700 rounded-sm">
													Custom
												</span>
											)}
											<span className="inline-flex items-center justify-center min-w-[3rem] px-1.5 py-0.5 text-xs font-black bg-black text-white dark:bg-white dark:text-black border-2 border-black dark:border-gray-400 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]">
												{currentTarget}%
											</span>
											{isCustom && (
												<button
													type="button"
													onClick={() =>
														removeSubjectOverride(course.courseCode)
													}
													aria-label={`Reset ${course.courseCode} to global criteria`}
													className="p-1 text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white bg-white dark:bg-gray-700 border-2 border-black dark:border-gray-400 rounded transition-transform active:scale-95 cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] dark:shadow-[1px_1px_0px_0px_rgba(255,255,255,1)]"
												>
													<RotateCcw className="w-3.5 h-3.5" />
												</button>
											)}
										</div>
									</div>

									{/* Bottom: Full-width slider */}
									<div className="pt-1">
										<input
											type="range"
											min="0"
											max="100"
											step="1"
											value={currentTarget}
											onChange={(e) =>
												setSubjectOverride(
													course.courseCode,
													Number(e.target.value),
												)
											}
											aria-label={`${course.courseName} attendance criteria`}
											aria-valuemin={0}
											aria-valuemax={100}
											aria-valuenow={currentTarget}
											className="criteria-slider w-full"
										/>
									</div>
								</div>
							);
						})
					)}
				</div>

				{/* Sticky Footer */}
				<div className="shrink-0 flex items-center justify-between p-3 sm:p-4 border-t-2 border-black dark:border-gray-400 bg-gray-50 dark:bg-gray-900 rounded-b-lg gap-2">
					<button
						type="button"
						onClick={resetAllSubjectOverrides}
						disabled={activeOverrideCount === 0}
						className="px-3 py-1.5 text-xs font-bold border-2 border-black dark:border-gray-400 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-transform active:scale-95 cursor-pointer style-text"
					>
						Reset All to Global
					</button>

					<button
						type="button"
						onClick={onClose}
						className="px-4 py-1.5 text-xs font-bold border-2 border-black dark:border-gray-400 bg-black text-white dark:bg-white dark:text-black hover:bg-gray-900 dark:hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] transition-transform active:scale-95 cursor-pointer style-text"
					>
						Done
					</button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
