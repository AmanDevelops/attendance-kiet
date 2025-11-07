import { useState } from "react";
import Attendance from "./components/Attendance";
import Footer from "./components/Footer";
import LoginForm from "./components/LoginForm";
import type { AttendanceResponse } from "./types/response";

function App() {
  const [attendanceData, setAttendanceData] =
    useState<AttendanceResponse | null>(null);

  return (
 
        <div className="min-h-screen bg-gray-100">
          <div className="overflow-hidden m-auto bg-green-100">
            <div className="py-2 text-center text-sm font-medium text-green-600">
          YOUR CREDENTIALS ARE NEVER SHARED WITH US. THEY ARE SENT DIRECTLY TO
          CYBERVIDYA AND STORED LOCALLY.
          <a
            href="https://github.com/AmanDevelops/attendance-kiet"
            className="text-blue-400"
            target="_blank"
          >
            {" "}
            VIEW SOURCE CODE
          </a>
        </div>
      </div>

      {!attendanceData ? (
        <LoginForm setAttendanceData={setAttendanceData} />
      ) : (
        <Attendance
          attendanceData={attendanceData}
          setAttendanceData={setAttendanceData}
        />
      )}
      <Footer />
    </div>



    
  );
}

export default App;
