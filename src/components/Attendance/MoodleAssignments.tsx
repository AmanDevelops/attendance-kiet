import { AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";

export default function MoodleAssignments() {
	const { moodleAssignments } = useAppContext();

	console.log("MoodleAssignments Component - Data:", moodleAssignments);

	if (!moodleAssignments) {
		return (
			<div className="p-4 bg-red-100 text-red-700">
				Debug: moodleAssignments is Null
			</div>
		);
	}
	if (moodleAssignments.length === 0) {
		return (
			<div className="p-4 bg-yellow-100 text-yellow-700">
				Debug: moodleAssignments is Empty Array
			</div>
		);
	}

	// moodle assignment sahi sae scrap nahi ho raha hae

	const projectsLeft = moodleAssignments.filter((a) => a.status === "Upcoming");
	const projectsPast = moodleAssignments.filter(
		(a) => a.status === "Overdue/Past" || a.status === "Submitted",
	);

	return (
		<div className="mb-8 grid gap-6 md:grid-cols-2">
			{/* Projects Left */}
			<div className="style-panel style-border bg-white p-6 rounded-lg shadow-sm">
				<div className="flex items-center gap-2 mb-4">
					<Clock className="w-6 h-6 text-amber-500" />
					<h3 className="text-xl font-bold text-black">Projects Left</h3>
				</div>
				{projectsLeft.length === 0 ? (
					<p className="text-gray-500 italic">No upcoming projects.</p>
				) : (
					<div className="space-y-3">
						{projectsLeft.map((task, idx) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: task.id is optional, fallback to idx
								key={task.id || idx}
								className="p-3 bg-amber-50 rounded-md border border-amber-100 flex flex-col gap-1"
							>
								<div className="font-bold text-black">{task.assignment}</div>
								<div className="text-xs font-semibold text-gray-600">
									{task.course}
								</div>
								<div className="text-xs text-amber-700 flex items-center gap-1 mt-1">
									<AlertCircle className="w-3 h-3" /> Due: {task.dueDate}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Projects Completed / Past */}
			<div className="style-panel style-border bg-white p-6 rounded-lg shadow-sm">
				<div className="flex items-center gap-2 mb-4">
					<CheckCircle className="w-6 h-6 text-green-500" />
					<h3 className="text-xl font-bold text-black">Projects Past/Done</h3>
				</div>
				{projectsPast.length === 0 ? (
					<p className="text-gray-500 italic">No past projects found.</p>
				) : (
					<div className="space-y-3">
						{projectsPast.map((task, idx) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: task.id is optional, fallback to idx
								key={task.id || idx}
								className="p-3 bg-gray-50 rounded-md border border-gray-100 flex flex-col gap-1 opacity-75"
							>
								<div className="font-bold text-black decoration-gray-400">
									{task.assignment}
								</div>
								<div className="text-xs font-semibold text-gray-500">
									{task.course}
								</div>
								<div className="text-xs text-gray-500 mt-1">
									Due: {task.dueDate}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
