import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { BookOpen, User, AlertTriangle, CheckCircle ,Sparkles, LogOut, CalendarDays, Wand2} from 'lucide-react';
import type { AttendanceResponse, LoginResponse } from './types';

interface ScheduleEntry {
  id: string | null;
  start: string;
  end: string;
  title: string;
  courseName: string;
  courseCode: string;
  courseCompName: string;
  facultyName: string;
  lectureDate: string;
  type: 'CLASS' | 'HOLIDAY';
}

interface ScheduleResponse {
  data: ScheduleEntry[];
  message: string;
}

const AUTH_COOKIE_NAME = 'auth_token';
const USERNAME_COOKIE = 'username';
const PASSWORD_COOKIE = 'password';
const REMEMBER_ME_COOKIE = 'remember_me';
const COOKIE_EXPIRY = 28;
const TARGET_PERCENTAGE = 75;

function calculateAttendanceProjection(present: number, total: number,percent: number) {
  if (total === 0) {
    return { status: 'safe', message: 'No classes held yet.' };
  }
  const currentPercentage = (present / total) * 100;
  
  if (currentPercentage >= percent) {
    const canMiss = Math.floor((present - ((percent/100) * total)) / (percent/100));
    return {
      status: 'safe',
      message: canMiss > 0 ? `You can miss ${canMiss} class${canMiss === 1 ? '' : 'es'} only` : 'Try not to miss any more classes',
    };
  } else {
    if (percent === 100) {
      return { status: 'warning', message: 'Need to attend all future classes.'};
    }
    const needToAttend = Math.ceil(((percent/100) * total - present) / (1-percent/100));
    return {
      status: 'warning',
      message: `Need to attend next ${needToAttend} class${needToAttend === 1 ? '' : 'es'}`,
    };
  }
}

function processCourseData(courses: AttendanceResponse['data']['attendanceCourseComponentInfoList']) {
  return courses.map(course => {
    const components = course.attendanceCourseComponentNameInfoList;
    
    if (components.length > 1) {
      const totalPresent = components.reduce((sum, c) => sum + c.numberOfPresent + c.numberOfExtraAttendance, 0);
      const totalPeriods = components.reduce((sum, c) => sum + c.numberOfPeriods, 0);
      const percentage = totalPeriods > 0 ? (totalPresent / totalPeriods) * 100 : 0;
      const combined = {
        componentName: 'AVERAGE (ALL COMPONENTS)',
        numberOfPresent: totalPresent,
        numberOfPeriods: totalPeriods,
        numberOfExtraAttendance: 0,
        presentPercentage: percentage,
        presentPercentageWith: `${percentage.toFixed(2)}%`,
      };
      return { ...course, attendanceCourseComponentNameInfoList: [combined] };
    } else if (components.length > 0) {
      const c = components[0];
      const present = c.numberOfPresent + c.numberOfExtraAttendance;
      const percentage = c.numberOfPeriods > 0 ? (present / c.numberOfPeriods) * 100 : 0;
      return {
        ...course,
        attendanceCourseComponentNameInfoList: [{
          ...c,
          presentPercentage: percentage,
          presentPercentageWith: `${percentage.toFixed(2)}%`,
        }],
      };
    }
  });
}

function getWeekRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = today.getDay();
  
  const startDate = new Date(today.setDate(today.getDate() - dayOfWeek));
  const endDate = new Date(today.setDate(today.getDate() + 6));

  const formatDate = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] =useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attendanceData, setAttendanceData] = useState<AttendanceResponse['data'] | null>(null);
  
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [missedClasses, setMissedClasses] = useState<Set<string>>(new Set());
  const [showProjection, setShowProjection] = useState(false);

  const overallAttendance = useMemo(() => {
    if (!attendanceData) {
      return { present: 0, total: 0, percentage: 0 };
    }
    let totalPresent = 0;
    let totalPeriods = 0;
    attendanceData.attendanceCourseComponentInfoList.forEach(course => {
      course.attendanceCourseComponentNameInfoList.forEach(component => {
        totalPresent += component.numberOfPresent + component.numberOfExtraAttendance;
        totalPeriods += component.numberOfPeriods;
      });
    });
    const percentage = totalPeriods > 0 ? (totalPresent / totalPeriods) * 100 : 0;
    return { present: totalPresent, total: totalPeriods, percentage };
  }, [attendanceData]);

  const projectionAdjustments = useMemo(() => {
    const adjustments = {
      overall: 0,
      byCourseCode: new Map<string, number>()
    };

    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

    missedClasses.forEach(classStartString => {
      const missedClass = schedule.find(c => c.start === classStartString);
      
      if (missedClass && missedClass.lectureDate >= todayStr) {
        adjustments.overall += 1;
        const count = adjustments.byCourseCode.get(missedClass.courseCode) || 0;
        adjustments.byCourseCode.set(missedClass.courseCode, count + 1);
      }
    });
    return adjustments;
  }, [schedule, missedClasses]);

  const groupedSchedule = useMemo(() => {
    const grouped = new Map<string, ScheduleEntry[]>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    schedule
      .filter(c => c.type === 'CLASS')
      .sort((a, b) => new Date(a.start.split(' ')[0].split('/').reverse().join('-') + 'T' + a.start.split(' ')[1])
                     - new Date(b.start.split(' ')[0].split('/').reverse().join('-') + 'T' + b.start.split(' ')[1]))
      .forEach(c => {
        const [day, month, year] = c.lectureDate.split('/').map(Number);
        const classDate = new Date(year, month - 1, day);

        if (classDate >= today) {
          const dayName = classDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
          if (!grouped.has(dayName)) {
            grouped.set(dayName, []);
          }
          grouped.get(dayName)!.push(c);
        }
      });
    return grouped;
  }, [schedule]);

  useEffect(() => {
    const savedUsername = Cookies.get(USERNAME_COOKIE) || '';
    const savedRememberMe = Cookies.get(REMEMBER_ME_COOKIE) === 'true';
    const savedPassword = savedRememberMe ? Cookies.get(PASSWORD_COOKIE) || '' : '';
    setUsername(savedUsername);
    setPassword(savedPassword);
    setRememberMe(savedRememberMe);

    const token = Cookies.get(AUTH_COOKIE_NAME);
    if (token) {
      fetchData(token);
    }
  }, []);

  const fetchData = async (token: string) => {
    setLoading(true);
    setError('');
    try {
      const attendanceResponse = await axios.get<AttendanceResponse>(
        'https://kiet.cybervidya.net/api/attendance/course/component/student',
        { headers: { Authorization: `GlobalEducation ${token}` } }
      );
      setAttendanceData(attendanceResponse.data.data);

      const { startDate, endDate } = getWeekRange();
      const scheduleResponse = await axios.get<ScheduleResponse>(
        `https://kiet.cybervidya.net/api/student/schedule/class?weekEndDate=${endDate}&weekStartDate=${startDate}`,
        { headers: { Authorization: `GlobalEducation ${token}` } }
      );
      setSchedule(scheduleResponse.data.data);

    } catch (err) {
      setError('Session expired or failed to fetch data. Please login again.');
      Cookies.remove(AUTH_COOKIE_NAME);
      setAttendanceData(null);
      setSchedule([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const loginResponse = await axios.post<LoginResponse>('https://kiet.cybervidya.net/api/auth/login', {
        userName: username,
        password: password,
      });

      const token = loginResponse.data.data.token;
      
      Cookies.set(USERNAME_COOKIE, username, { expires: COOKIE_EXPIRY });
      Cookies.set(REMEMBER_ME_COOKIE, rememberMe.toString(), { expires: COOKIE_EXPIRY });
      
      if (rememberMe) {
        Cookies.set(PASSWORD_COOKIE, password, { expires: COOKIE_EXPIRY });
        Cookies.set(AUTH_COOKIE_NAME, token, { expires: COOKIE_EXPIRY });
      } else {
        Cookies.remove(PASSWORD_COOKIE);
        Cookies.set(AUTH_COOKIE_NAME, token);
      }

      await fetchData(token);
    } catch (err) {
      setError('Failed to fetch attendance data. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Cookies.remove(AUTH_COOKIE_NAME);
    if (!rememberMe) {
      Cookies.remove(PASSWORD_COOKIE);
      setPassword('');
    }
    setAttendanceData(null);
    setSchedule([]);
    setMissedClasses(new Set());
    setShowProjection(false);
    setError('');
  };

  const handleMissClassToggle = (classStartString: string) => {
    setMissedClasses(prev => {
      const newSet = new Set(prev);
      if (newSet.has(classStartString)) {
        newSet.delete(classStartString);
      } else {
        newSet.add(classStartString);
      }
      return newSet;
    });
  };

  const overallMissed = projectionAdjustments.overall;
  
  const projectedOverallTotal = overallAttendance.total + overallMissed;
  const projectedOverallPercent = projectedOverallTotal > 0
    ? (overallAttendance.present / projectedOverallTotal) * 100
    : 0;
  
  const currentOverallProjection = calculateAttendanceProjection(
    overallAttendance.present, 
    overallAttendance.total, 
    TARGET_PERCENTAGE
  );


  return (
    <div className="min-h-screen bg-gray-100">
      {!attendanceData ? (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="manga-panel manga-border w-full max-w-md bg-white p-8 manga-fade-in">
            <div className="flex items-center justify-center mb-8">
            <BookOpen className="h-16 w-16 text-black transform -rotate-12" />
            <Sparkles className="h-8 w-8 text-black absolute translate-x-8 -translate-y-8" />
            </div>
            <h2 className="anga-text text-3xl font-black text-center text-black mb-8 transform -rotate-2">
              CyberVidya Attendance
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="username" className="manga-text block text-sm font-bold text-black">
                  University Roll Number
                </label>
                <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 block w-full manga-border rounded-none px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black" required />
              </div>
              <div>
                <label htmlFor="password" className="manga-text block text-sm font-bold text-black">
                  CyberVidya Password
                </label>
                <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 block w-full manga-border rounded-none px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black" required />
              </div>
              <div className="flex items-center">
                <input id="remember-me" type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="h-5 w-5 manga-border rounded-none" />
                <label htmlFor="remember-me" className="ml-2 block manga-text-sm font-bold text-black">
                  Remember me
                </label>
              </div>
              {error && <p className="manga-text text-red-600 text-sm bg-red-100 p-2 manga-border">{error}</p>}
              <button type="submit" disabled={loading} className="w-full manga-border manga-text py-3 px-4 text-sm font-black text-white bg-black hover:bg-gray-800 focus:outline-none disabled:opacity-50 transform hover:-translate-y-1 transition-transform">
                {loading ? 'Loading...' : 'View Attendance'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8 flex-grow">
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 manga-border manga-fade-in">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <User className="h-14 w-14 text-blue-600" />
                <div className="flex flex-col">
                  <h1 className="text-xl font-black text-black mb-1 text-center manga-text">{attendanceData.fullName}</h1>
                  <p className="text-xs text-black font-semibold manga-text mb-0.5">
                    {attendanceData.registrationNumber} | {attendanceData.branchShortName} - Section {attendanceData.sectionName}
                  </p>
                  <p className="text-xs text-black font-semibold manga-text">
                    {attendanceData.degreeName} | Semester {attendanceData.semesterName}
                  </p>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-2 self-start md:self-auto">
                <button
                  onClick={() => setShowProjection(prev => !prev)}
                  className="manga-border manga-text py-2 px-3 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none transform hover:-translate-y-1 transition-transform flex items-center gap-1.5"
                >
                  <Wand2 className="h-4 w-4" />
                  {showProjection ? 'Hide Projection' : 'Show Projection'}
                </button>
                <button onClick={handleLogout} className="manga-border manga-text py-2 px-3 text-xs font-bold text-white bg-black hover:bg-gray-800 focus:outline-none transform hover:-translate-y-1 transition-transform flex items-center gap-1">
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>

          {showProjection && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8 manga-border manga-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <CalendarDays className="h-6 w-6 text-blue-600" />
                <h3 className="manga-text text-xl font-bold text-black">
                  Weekly Projection (Today Onwards)
                </h3>
              </div>
              <p className="manga-text text-sm text-gray-600 mb-4">Select classes you plan to miss to see the live impact on your attendance.</p>
              <div className="max-h-64 overflow-y-auto space-y-4 pr-2">
                {groupedSchedule.size === 0 && <p className="manga-text text-gray-500">No upcoming classes found for the rest of the week.</p>}
                {Array.from(groupedSchedule.entries()).map(([day, classes]) => (
                  <div key={day}>
                    <h4 className="manga-text font-bold text-black border-b-2 border-black pb-1 mb-2">{day}</h4>
                    <ul className="space-y-2">
                      {classes.map(c => (
                        <li key={c.start} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={c.start}
                            className="h-5 w-5 manga-border rounded-none"
                            checked={missedClasses.has(c.start)}
                            onChange={() => handleMissClassToggle(c.start)}
                          />
                          <label htmlFor={c.start} className="flex-1 manga-text text-sm">
                            <span className="font-bold">{c.courseName}</span> ({c.courseCompName})
                            <br />
                            <span className="text-xs text-gray-600">{c.start.split(' ')[1]} - {c.end.split(' ')[1]} | {c.facultyName}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow-md p-6 mb-8 manga-border manga-fade-in">
            <div className="mt-0">
              <h4 className="manga-text text-lg font-bold text-black mb-2">
                Overall Attendance
              </h4>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700 manga-text">
                  {showProjection ? 'Projected' : 'Current'} Overall
                </span>
                <span className="text-2xl font-semibold" style={{ color: (showProjection ? projectedOverallPercent : overallAttendance.percentage) >= TARGET_PERCENTAGE ? '#059669' : '#DC2626' }}>
                  {showProjection ? projectedOverallPercent.toFixed(2) + '%' : overallAttendance.percentage.toFixed(2) + '%'}
                </span>
              </div>
              
              {!showProjection ? (
                <>
                  <div className="text-sm text-gray-600 mb-2">
                    Total Classes Missed: {overallAttendance.total-overallAttendance.present}
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-600">
                  {overallMissed > 0 
                    ? `Projected after missing ${overallMissed} class${overallMissed === 1 ? '' : 'es'}.`
                    : 'No classes selected to miss.'}
                </div>
              )}
            </div>
          </div>


          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {processCourseData(attendanceData.attendanceCourseComponentInfoList).map((course) => (
              <div key={course.courseCode} className="bg-white rounded-lg shadow-md p-6 manga-border manga-fade-in">
                <h3 className="text-sm font-semibold text-gray-800 mb-2 manga-text">
                  {course.courseName}
                </h3>
                <p className="text-sm text-gray-600 mb-4 manga-text">Code: {course.courseCode}</p>
                <div className="space-y-4">
                  
                  {course.attendanceCourseComponentNameInfoList.map((component, index) => {
                    
                    const subjectMissed = projectionAdjustments.byCourseCode.get(course.courseCode) || 0;
                    const projectedPresent = component.numberOfPresent + component.numberOfExtraAttendance;
                    const projectedTotal = component.numberOfPeriods + subjectMissed;
                    const projectedSubjectPercent = projectedTotal > 0
                      ? (projectedPresent / projectedTotal) * 100
                      : 0;
                      
                    const currentSubjectProjection = calculateAttendanceProjection(
                        component.numberOfPresent + component.numberOfExtraAttendance,
                        component.numberOfPeriods,
                        TARGET_PERCENTAGE
                      );
                    
                    return (
                      <div key={index} className="border-t-2 pt-4 border-black">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700 manga-text">
                            {component.componentName}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: (showProjection ? projectedSubjectPercent : (component.presentPercentage ?? 0)) >= TARGET_PERCENTAGE ? '#059669' : '#DC2626' }}>
                            {showProjection 
                              ? `${projectedSubjectPercent.toFixed(2)}% (Projected)`
                              : component.presentPercentageWith
                            }
                          </span>
                        </div>
                        
                        {!showProjection ? (
                          <>
                            <div className="text-sm text-gray-600 mb-2">
                              Present: {component.numberOfPresent+component.numberOfExtraAttendance}/{component.numberOfPeriods}
                            </div>
                            {currentSubjectProjection && (
                              <div className={`flex items-center gap-2 text-sm ${currentSubjectProjection.status === 'safe' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {currentSubjectProjection.status === 'safe' ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                {currentSubjectProjection.message}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-gray-600">
                            {subjectMissed > 0 
                              ? `Projected after missing ${subjectMissed} class${subjectMissed === 1 ? '' : 'es'}.`
                              : 'No classes selected to miss.'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <footer className="bg-white shadow-md mt-auto manga-border">
  <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
    <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
      <div className="flex items-center space-x-2">
        <a href="https://github.com/AmanDevelops/attendance-kiet" target="_blank" rel="noopener noreferrer" className="inline-flex items-center space-x-2 text-gray-600 hover:text-black transition-colors manga-text font-extrabold">
          <span>View on GitHub</span>
        </a>
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-gray-600 manga-text font-extrabold">Contributors:</span>
        <div className="flex -space-x-2">
          <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white manga-border" src="https://avatars.githubusercontent.com/AmanDevelops" alt="Contributor 1" />
          <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white manga-border" src="https://avatars.githubusercontent.com/webdevgeeks" alt="Contributor 2" />
          <img className="inline-block h-8 w-8 rounded-full ring-2 ring-white manga-border" src="https://avatars.githubusercontent.com/rishav76dev" alt="Contributor 3" />
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white manga-border">
            <span className="text-xs font-medium text-gray-500 manga-text">+1</span>
          </div>
        </div>
      </div>
    </div>
    <div className="mt-4 text-center text-sm text-gray-500 manga-text font-extrabold">
      Made with ❤️ by WebDevGeeks
    </div>
  </div>
</footer>
    </div>
  );
}

export default App;