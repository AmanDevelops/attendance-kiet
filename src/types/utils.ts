import axios from "axios";

export async function fetchStudentId(token: string): Promise<number | null> {
  try {
    const response = await axios.get(
      "https://kiet.cybervidya.net/api/student/dashboard/registered-courses",
      { headers: { Authorization: `GlobalEducation ${token}` } }
    );

    if (response.data.data.length > 0) {
      return response.data.data[0].studentId; // Assume studentId is same for all items
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching registered courses", error);
    return null;
  }
}
