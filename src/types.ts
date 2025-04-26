export interface AttendanceResponse {
  data: {
    fullName: string;
    registrationNumber: string;
    rollNumber: string;
    sectionName: string;
    branchShortName: string;
    degreeName: string;
    semesterName: string;
    admissionBatchName: string;
    academicSessionName: string;
    attendanceCourseComponentInfoList: {
      courseName: string;
      courseCode: string;
      attendanceCourseComponentNameInfoList: {
        numberOfExtraAttendance: number;
        componentName: string;
        numberOfPeriods: number;
        numberOfPresent: number;
        presentPercentage: number | null;
        presentPercentageWith: string;
      }[];
    }[];
  };
  message: string;
}

export interface LoginResponse {
  data: {
    token: string;
  };
}