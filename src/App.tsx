import { useState } from "react";
import Attendance from "./components/Attendance";
import LoginForm from "./components/LoginForm";
import type { AttendanceResponse } from "./types/response";

function App() {
  const [attendanceData, setAttendanceData] =
    useState<AttendanceResponse | null>(null);

  return (
    <div className="min-h-screen bg-gray-100">
      {!attendanceData ? (
        <LoginForm setAttendanceData={setAttendanceData} />
      ) : (
        <Attendance
          attendanceData={attendanceData}
          setAttendanceData={setAttendanceData}
        />
      )}
    </div>
  );
}

export default App;
