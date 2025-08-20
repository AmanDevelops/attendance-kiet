import { useState } from "react";
import LoginForm from "./components/LoginForm";
import type { AttendanceResponse } from "./types/response";

function App() {
  const [attendanceData, setAttendanceData] = useState<
    AttendanceResponse["data"] | null
  >(null);

  return (
    <div className="min-h-screen bg-gray-100">
      {!attendanceData && <LoginForm />}
    </div>
  );
}

export default App;
