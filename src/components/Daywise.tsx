import { useEffect, useState } from "react";
import axios from "axios";

type DaywiseReportProps = {
  token: string;
  payload: {
    courseCompId: number;
    courseId: number;
    sessionId: number | null;
    studentId: number | string;
  };
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
function DaywiseReport({ token, payload }: DaywiseReportProps) {
  const [daywiseData, setDaywiseData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchDaywiseAttendance = async () => {
      try {
        const response = await axios.post(
          "https://kiet.cybervidya.net/api/attendance/schedule/student/course/attendance/percentage",
          payload,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `GlobalEducation ${token}`,
            },
          }
        );

        if (response.data.data && response.data.data.length > 0) {
          const lectures = response.data.data[0].lectureList;

          // Sort descending by date
          lectures.sort(
            (a: any, b: any) =>
              new Date(b.planLecDate).getTime() -
              new Date(a.planLecDate).getTime()
          );

          setDaywiseData(lectures);
        } else {
          setDaywiseData([]);
        }
      } catch (err: any) {
        console.error(err);
        setError(
          "Failed to load daywise attendance data. Or this subject does not have any classes yet"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDaywiseAttendance();
  }, [token, payload]);

  if (loading) return <p>Loading daywise attendance data...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (daywiseData.length === 0)
    return <p>No daywise attendance data available.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md p-1 sm:p-6 style-border style-fade-in overflow-x-auto max-h-[500px]">
      <table className="w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr className="text-sm font-semibold text-gray-700">
            <th className="p-1 sm:p-3 border">Date</th>
            <th className="p-1 sm:p-3 border">Day</th>
            <th className="p-1 sm:p-3 border">Time Slot</th>
            <th className="p-1 sm:p-3 border">Attendance</th>
          </tr>
        </thead>
        <tbody className="text-center text-gray-800 text-sm">
          {daywiseData.map((lecture, index) => (
            <tr key={index} className="hover:bg-gray-50 transition-colors">
              <td className="p-2 border">{formatDate(lecture.planLecDate)}</td>
              <td className="p-2 border">{lecture.dayName}</td>
              <td className="p-2 border">{lecture.timeSlot}</td>
              <td className="p-2 border font-semibold">
                {lecture.attendance === "PRESENT" ? (
                  <span className="text-green-600">{lecture.attendance}</span>
                ) : (
                  <span className="text-red-600">{lecture.attendance}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DaywiseReport;
