import Cookies from "js-cookie";
import { AlertTriangle, CheckCircle, LogOut, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AUTH_COOKIE_NAME,
  PASSWORD_COOKIE,
  REMEMBER_ME_COOKIE,
  USERNAME_COOKIE,
} from "../types/CookieVars";
import type { AttendanceResponse } from "../types/response";
import { fetchStudentId } from "../types/utils";
import DaywiseReport from "./Daywise";
import OverallAtt from "./OverallAtt";

type AttendanceHook = {
  attendanceData: AttendanceResponse;
  setAttendanceData: React.Dispatch<
    React.SetStateAction<AttendanceResponse | null>
  >;
};

function calculateAttendanceProjection(present: number, total: number) {
  const currentPercentage = (present / total) * 100;

  if (currentPercentage >= 75) {
    const canMiss = Math.floor((present - 0.75 * total) / 0.75);
    return {
      status: "safe",
      message:
        canMiss > 0
          ? `You can miss ${canMiss} class${canMiss === 1 ? "" : "es"} only`
          : "Try not to miss any more classes",
    };
  } else {
    const needToAttend = Math.ceil((0.75 * total - present) / 0.25);
    return {
      status: "warning",
      message: `Need to attend next ${needToAttend} class${
        needToAttend === 1 ? "" : "es"
      }`,
    };
  }
}

function Attendance({ attendanceData, setAttendanceData }: AttendanceHook) {
  const [studentId, setStudentId] = useState<number | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<any | null>(null);
  const [isDaywiseModalOpen, setIsDaywiseModalOpen] = useState(false);

  function handleLogout(): void {
    Cookies.remove(AUTH_COOKIE_NAME);
    if (!Cookies.get(REMEMBER_ME_COOKIE)) {
      Cookies.remove(USERNAME_COOKIE);
      Cookies.remove(PASSWORD_COOKIE);
    }
    setAttendanceData(null);
  }

  function handleViewDaywiseAttendance(course: any, component: any) {
    setSelectedComponent({ course, component });
    setIsDaywiseModalOpen(true);
  }

  useEffect(() => {
    document.body.style.overflow = isDaywiseModalOpen ? "hidden" : "auto";
  }, [isDaywiseModalOpen]);

  useEffect(() => {
    const token = Cookies.get(AUTH_COOKIE_NAME) || "";
    fetchStudentId(token).then((id) => {
      if (id) setStudentId(id);
    });
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 flex-grow">
 
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-8 style-border style-fade-in">
        <div className="flex items-center justify-between gap-3 sm:gap-6 overflow-hidden flex-nowrap">

          <div className="flex items-center gap-3 sm:gap-5 overflow-hidden min-w-0">
            <User className="h-10 w-10 sm:h-14 sm:w-14 flex-shrink-0" />
            <div className="min-w-0 truncate">
              <h1 className="text-lg sm:text-xl font-black text-black mb-1 truncate style-text">
                {attendanceData.data.fullName}
              </h1>
              <p className="text-[11px] sm:text-xs text-black font-semibold style-text truncate">
                {attendanceData.data.registrationNumber} |{" "}
                {attendanceData.data.branchShortName} - Section{" "}
                {attendanceData.data.sectionName}
              </p>
              <p className="text-[11px] sm:text-xs text-black font-semibold style-text truncate">
                {attendanceData.data.degreeName} | Semester{" "}
                {attendanceData.data.semesterName}
              </p>
            </div>
          </div>

          <div className="flex-shrink-0">
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 sm:gap-2 style-border style-text py-1.5 sm:py-2 px-3 sm:px-5 text-[11px] sm:text-sm font-bold whitespace-nowrap hover:text-white hover:bg-black transition-transform duration-300 transform hover:-translate-y-1 focus:outline-none"
            >
              <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      <OverallAtt />

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {attendanceData.data.attendanceCourseComponentInfoList.map((course) => (
          <div
            key={course.courseCode}
            className="bg-white rounded-lg shadow-md p-5 sm:p-6 style-border style-fade-in"
          >
            <h3 className="text-sm font-bold text-gray-800 mb-2 style-text">
              {course.courseName}
            </h3>
            <p className="text-sm text-gray-600 mb-4 style-text">
              Code: {course.courseCode}
            </p>

            <div className="space-y-4">
              {course.attendanceCourseComponentNameInfoList.map(
                (component, index) => {
                  const projection =
                    component.numberOfPeriods > 0
                      ? calculateAttendanceProjection(
                          component.numberOfPresent +
                            component.numberOfExtraAttendance,
                          component.numberOfPeriods
                        )
                      : null;

                  return (
                    <div
                      key={index}
                      className="border-t-2 pt-4 border-black overflow-hidden"
                    >
                      <div className="flex justify-between items-center mb-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-700 style-text">
                          {component.componentName}
                        </span>
                        <span
                          className="text-sm font-semibold"
                          style={{
                            color:
                              (component.presentPercentage ?? 0) >= 75
                                ? "#059669"
                                : "#DC2626",
                          }}
                        >
                          {component.presentPercentageWith}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        Present:{" "}
                        {component.numberOfPresent +
                          component.numberOfExtraAttendance}
                        /{component.numberOfPeriods}
                      </div>

                      {projection && (
                        <div
                          className={`flex items-center gap-2 text-sm ${
                            projection.status === "safe"
                              ? "text-emerald-600"
                              : "text-amber-600"
                          }`}
                        >
                          {projection.status === "safe" ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                          {projection.message}
                        </div>
                      )}

                      <div className="pt-2">
                        <button
                          onClick={() =>
                            handleViewDaywiseAttendance(course, component)
                          }
                          className="style-border style-text py-2 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black transform transition-transform duration-300 hover:-translate-y-1 focus:outline-none"
                        >
                          See Daywise Attendance
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        ))}
      </div>

      {isDaywiseModalOpen && selectedComponent && (
        <div className="fixed inset-0 bg-blur bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-6">
          <div className="relative bg-white bg-opacity-95 rounded-xl shadow-lg w-full max-w-[95%] sm:max-w-3xl p-4 sm:p-6 overflow-y-auto max-h-[90vh] style-border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg">
                Daywise Attendance for{" "}
                <span className="font-bold">
                  {selectedComponent.course.courseName} -{" "}
                  {selectedComponent.component.componentName}
                </span>
              </h2>

              <button
                className="text-red-500 text-xl font-bold cursor-pointer"
                onClick={() => setIsDaywiseModalOpen(false)}
              >
                <X />
              </button>
            </div>

            <DaywiseReport
              token={Cookies.get(AUTH_COOKIE_NAME) || ""}
              payload={{
                courseCompId: selectedComponent.component.courseComponentId,
                courseId: selectedComponent.course.courseId,
                sessionId: null,
                studentId: studentId || 0,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default Attendance;
