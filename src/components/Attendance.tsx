import Cookies from "js-cookie";
import { AlertTriangle, CheckCircle, LogOut, User } from "lucide-react";
import {
  AUTH_COOKIE_NAME,
  PASSWORD_COOKIE,
  REMEMBER_ME_COOKIE,
  USERNAME_COOKIE,
} from "../types/CookieVars";
import type { AttendanceResponse } from "../types/response";
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
  function handleLogout(): void {
    Cookies.remove(AUTH_COOKIE_NAME);
    if (!Cookies.get(REMEMBER_ME_COOKIE)) {
      Cookies.remove(USERNAME_COOKIE);
      Cookies.remove(PASSWORD_COOKIE);
    }
    setAttendanceData(null);
  }
  return (
    <div className="container mx-auto px-4 py-8 flex-grow">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8 manga-border manga-fade-in">
        <div className="flex flex-col gap-4">
          <div className="flex items-center sm:gap-4 justify-between">
            <div className="flex items-center gap-4">
              <User className="h-14 w-14" />{" "}
              <div className="flex flex-col">
                <h1 className="text-xl font-black text-black mb-1 manga-text">
                  {attendanceData.data.fullName}
                </h1>
                <p className="text-xs text-black font-semibold manga-text mb-0.5">
                  {attendanceData.data.registrationNumber} |{" "}
                  {attendanceData.data.branchShortName} - Section{" "}
                  {attendanceData.data.sectionName}
                </p>
                <p className="text-xs text-black font-semibold manga-text">
                  {attendanceData.data.degreeName} | Semester{" "}
                  {attendanceData.data.semesterName}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="manga-border manga-text py-2 px-3 text-xs font-bold flex items-center gap-1 cursor-pointer hover:text-white hover:bg-black transform transition-transform duration-300 hover:-translate-y-1 focus:outline-none hover:transition-all hover:duration-300"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </div>
      <OverallAtt />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {attendanceData.data.attendanceCourseComponentInfoList.map((course) => (
          <div
            key={course.courseCode}
            className="bg-white rounded-lg shadow-md p-6 manga-border manga-fade-in"
          >
            <h3 className="text-sm font-bold text-gray-800 mb-2 manga-text">
              {course.courseName}
            </h3>
            <p className="text-sm text-gray-600 mb-4 manga-text">
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
                    <div key={index} className="border-t-2 pt-4 border-black">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 manga-text">
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
                    </div>
                  );
                }
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Attendance;
