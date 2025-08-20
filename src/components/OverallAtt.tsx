import ProgressBar from "@ramonak/react-progress-bar";
import axios from "axios";
import Cookies from "js-cookie";
import { useEffect, useState } from "react";
import { AUTH_COOKIE_NAME } from "../types/CookieVars";
import type { AttendanceDataSummaryResponse } from "../types/response";

const attendanceColour = {
  above80: "22c55e",
  below80: "eab308",
  below75: "dc2626",
};

function OverallAtt() {
  const [attendanceDataSummary, setSetAndanceDataSummary] =
    useState<AttendanceDataSummaryResponse | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      const response = await axios.get(
        "https://kiet.cybervidya.net/api/student/dashboard/attendance",
        {
          headers: {
            Authorization: "GlobalEducation " + Cookies.get(AUTH_COOKIE_NAME),
          },
        }
      );

      setSetAndanceDataSummary(response.data);
    };

    fetchData();
  }, []);

  function handleAttendanceSliderColour(): string {
    if (attendanceDataSummary) {
      const percentage = attendanceDataSummary.data.presentPerc;
      if (percentage >= 80) {
        return attendanceColour.above80;
      } else if (percentage >= 75) {
        return attendanceColour.below80;
      } else {
        return attendanceColour.below75;
      }
    }
    return attendanceColour.above80;
  }

  function handleLabelSize(): number {
    if (window.innerWidth > 476) {
      return 35;
    } else {
      return 15;
    }
  }

  function handleProgressBarSize(): number {
    if (window.innerWidth > 476) {
      return 50;
    } else {
      return 25;
    }
  }
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8 manga-border manga-fade-in m-auto">
      <h1 className="text-2xl mb-1 ml-1 font-bold">Overall Attendance</h1>
      {attendanceDataSummary && (
        // TODO: Make an object to store all the properties and calculate all at once
        <ProgressBar
          completed={attendanceDataSummary.data.presentPerc}
          bgColor={`#${handleAttendanceSliderColour()}`}
          height={`${handleProgressBarSize()}px`}
          labelAlignment="center"
          labelColor="#ffffff"
          labelSize={`${handleLabelSize()}px`}
          animateOnRender
          customLabel={`${attendanceDataSummary.data.presentPerc}%`}
        />
      )}
    </div>
  );
}

export default OverallAtt;
