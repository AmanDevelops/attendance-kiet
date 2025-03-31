import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Cookies from 'js-cookie';
import { BookOpen, User, AlertTriangle, CheckCircle ,Sparkles} from 'lucide-react';
import type { AttendanceResponse, LoginResponse } from './types';

const AUTH_COOKIE_NAME = 'auth_token';
const USERNAME_COOKIE = 'username';
const PASSWORD_COOKIE = 'password';
const REMEMBER_ME_COOKIE = 'remember_me';
const COOKIE_EXPIRY = 28; // days

function calculateAttendanceProjection(present: number, total: number) {
  const currentPercentage = (present / total) * 100;
  
  if (currentPercentage >= 75) {
    const canMiss = Math.floor((present - (0.75 * total)) / 0.75);
    return {
      status: 'safe',
      message: canMiss > 0 ? `You can miss ${canMiss} class${canMiss === 1 ? '' : 'es'} only` : 'Try not to miss any more classes',
    };
  } else {
    const needToAttend = Math.ceil((0.75 * total - present) / 0.25);
    return {
      status: 'warning',
      message: `Need to attend next ${needToAttend} class${needToAttend === 1 ? '' : 'es'}`,
    };
  }
}

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attendanceData, setAttendanceData] = useState<AttendanceResponse['data'] | null>(null);

  useEffect(() => {
    // Load saved credentials
    const savedUsername = Cookies.get(USERNAME_COOKIE) || '';
    const savedRememberMe = Cookies.get(REMEMBER_ME_COOKIE) === 'true';
    const savedPassword = savedRememberMe ? Cookies.get(PASSWORD_COOKIE) || '' : '';

    setUsername(savedUsername);
    setPassword(savedPassword);
    setRememberMe(savedRememberMe);

    // Check for auth token
    const token = Cookies.get(AUTH_COOKIE_NAME);
    if (token) {
      fetchAttendanceData(token);
    }
  }, []);

  const fetchAttendanceData = async (token: string) => {
    try {
      const attendanceResponse = await axios.get<AttendanceResponse>(
        'https://kiet.cybervidya.net/api/attendance/course/component/student',
        {
          headers: {
            Authorization: `GlobalEducation ${token}`,
          },
        }
      );
      setAttendanceData(attendanceResponse.data.data);
    } catch (err) {
      setError('Session expired. Please login again.');
      Cookies.remove(AUTH_COOKIE_NAME);
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
      
      // Save credentials
      Cookies.set(USERNAME_COOKIE, username, { expires: COOKIE_EXPIRY });
      Cookies.set(REMEMBER_ME_COOKIE, rememberMe.toString(), { expires: COOKIE_EXPIRY });
      
      if (rememberMe) {
        Cookies.set(PASSWORD_COOKIE, password, { expires: COOKIE_EXPIRY });
        Cookies.set(AUTH_COOKIE_NAME, token, { expires: COOKIE_EXPIRY });
      } else {
        Cookies.remove(PASSWORD_COOKIE);
        Cookies.set(AUTH_COOKIE_NAME, token); // Session cookie
      }

      await fetchAttendanceData(token);
    } catch (err) {
      setError('Failed to fetch attendance data. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

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
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 block w-full manga-border rounded-none px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="manga-text block text-sm font-bold text-black">
                  CyberVidya Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full manga-border rounded-none px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black"
                  required
                />
              </div>
              <div className="flex items-center">
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-5 w-5 manga-border rounded-none"
                />
                <label htmlFor="remember-me" className="ml-2 block manga-text-sm font-bold text-black">
                  Remember me
                </label>
              </div>
              {error && <p className="manga-text text-red-600 text-sm bg-red-100 p-2 manga-border">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full manga-border manga-text py-3 px-4 text-sm font-black text-white bg-black hover:bg-gray-800 focus:outline-none disabled:opacity-50 transform hover:-translate-y-1 transition-transform"
              >
                {loading ? 'Loading...' : 'View Attendance'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="container mx-auto px-4 py-8">
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 manga-border manga-fade-in">
  <div className="flex items-center gap-6 mb-6">
    <User className="h-16 w-16 text-blue-600" /> {/* Increased size for better visibility */}
      <div className="flex flex-col">
      <h1 className="text-2xl font-black text-black mb-2 text-center manga-text">{attendanceData.fullName}</h1> {/* Adjusted margin */}
        <p className="text-sm text-black font-semibold manga-text mb-1">
          {attendanceData.registrationNumber} | {attendanceData.branchShortName} - Section {attendanceData.sectionName}</p>
        <p className="text-sm text-black font-semibold manga-text">
          {attendanceData.degreeName} | Semester {attendanceData.semesterName}
        </p>

    </div>
  </div>
</div>


          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {attendanceData.attendanceCourseComponentInfoList.map((course) => (
              <div key={course.courseCode} className="bg-white rounded-lg shadow-md p-6 manga-border manga-fade-in">
                <h3 className="text-sm font-semibold text-gray-800 mb-2 manga-text">
                  {course.courseName}
                </h3>
                <p className="text-sm text-gray-600 mb-4 manga-text">Code: {course.courseCode}</p>
                <div className="space-y-4">
                  {course.attendanceCourseComponentNameInfoList.map((component, index) => {
                    const projection = component.numberOfPeriods > 0 
                      ? calculateAttendanceProjection(component.numberOfPresent, component.numberOfPeriods)
                      : null;
                    
                    return (
                      <div key={index} className="border-t-2 pt-4 border-black">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-gray-700 manga-text">
                            {component.componentName}
                          </span>
                          <span className="text-sm font-semibold" style={{
                            color: (component.presentPercentage ?? 0) >= 75 ? '#059669' : '#DC2626'
                          }}>
                            {component.presentPercentageWith}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          Present: {component.numberOfPresent}/{component.numberOfPeriods}
                        </div>
                        {projection && (
                          <div className={`flex items-center gap-2 text-sm ${
                            projection.status === 'safe' ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {projection.status === 'safe' 
                              ? <CheckCircle className="h-4 w-4" />
                              : <AlertTriangle className="h-4 w-4" />
                            }
                            {projection.message}
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
        <a 
          href="https://github.com/AmanDevelops/attendance-kiet" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-2 text-gray-600 hover:text-black transition-colors manga-text font-extrabold"
        >
          <span>View on GitHub</span>
        </a>
      </div>

      <div className="flex items-center space-x-2">
        <span className="text-gray-600 manga-text font-extrabold">Contributors:</span>
        <div className="flex -space-x-2">
          <img
            className="inline-block h-8 w-8 rounded-full ring-2 ring-white manga-border"
            src="https://avatars.githubusercontent.com/AmanDevelops"
            alt="Contributor 1"
          />
          <img
            className="inline-block h-8 w-8 rounded-full ring-2 ring-white manga-border"
            src="https://avatars.githubusercontent.com/webdevgeeks"
            alt="Contributor 2"
          />
          <img
            className="inline-block h-8 w-8 rounded-full ring-2 ring-white manga-border"
            src="https://avatars.githubusercontent.com/rishav76dev"
            alt="Contributor 3"
          />
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
