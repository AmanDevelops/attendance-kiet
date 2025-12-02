import axios from "axios";

export async function fetchStudentId(token: string): Promise<number | null> {
	try {
		const response = await axios.get(
			"https://kiet.cybervidya.net/api/student/dashboard/registered-courses",
			{ headers: { Authorization: `GlobalEducation ${token}` } },
		);

		if (response.data.data.length > 0) {
			return response.data.data[0].studentId;
		} else {
			return null;
		}
	} catch (error) {
		console.error("Error fetching registered courses", error);
		return null;
	}
}

const formatDate = (date: Date) => {
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
};

export function getWeekRange() {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dayOfWeek = today.getDay();

	const startDate = new Date(today);
	startDate.setDate(today.getDate() - dayOfWeek);

	const endDate = new Date(startDate);
	endDate.setDate(startDate.getDate() + 6);

	console.log(startDate, endDate);

	return {
		startDate: formatDate(startDate),
		endDate: formatDate(endDate),
	};
}
