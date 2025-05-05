import React, { useState, useEffect } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  User,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import type { AttendanceResponse, LoginResponse } from "./types";

const AUTH_COOKIE_NAME = "auth_token";
const USERNAME_COOKIE = "username";
const PASSWORD_COOKIE = "password";
const REMEMBER_ME_COOKIE = "remember_me";
const THEME_COOKIE = "theme_preference";
const COOKIE_EXPIRY = 28; // days

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

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attendanceData, setAttendanceData] = useState<
    AttendanceResponse["data"] | null
  >(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Load saved credentials
    const savedUsername = Cookies.get(USERNAME_COOKIE) || "";
    const savedRememberMe = Cookies.get(REMEMBER_ME_COOKIE) === "true";
    const savedPassword = savedRememberMe
      ? Cookies.get(PASSWORD_COOKIE) || ""
      : "";
    const savedTheme = Cookies.get(THEME_COOKIE) === "dark";

    setUsername(savedUsername);
    setPassword(savedPassword);
    setRememberMe(savedRememberMe);
    setDarkMode(savedTheme);

    // Check for auth token
    const token = Cookies.get(AUTH_COOKIE_NAME);
    if (token) {
      fetchAttendanceData(token);
    }
  }, []);

  // Updates the theme when darkMode changes ,;
  useEffect(() => {
    Cookies.set(THEME_COOKIE, darkMode ? "dark" : "light", {
      expires: COOKIE_EXPIRY,
    });
  }, [darkMode]);

  const fetchAttendanceData = async (token: string) => {
    try {
      const attendanceResponse = await axios.get<AttendanceResponse>(
        "https://kiet.cybervidya.net/api/attendance/course/component/student",
        {
          headers: {
            Authorization: `GlobalEducation ${token}`,
          },
        }
      );
      setAttendanceData(attendanceResponse.data.data);
    } catch (err) {
      setError("Session expired. Please login again.");
      Cookies.remove(AUTH_COOKIE_NAME);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const loginResponse = await axios.post<LoginResponse>(
        "https://kiet.cybervidya.net/api/auth/login",
        {
          userName: username,
          password: password,
        }
      );

      const token = loginResponse.data.data.token;

      // Save credentials
      Cookies.set(USERNAME_COOKIE, username, { expires: COOKIE_EXPIRY });
      Cookies.set(REMEMBER_ME_COOKIE, rememberMe.toString(), {
        expires: COOKIE_EXPIRY,
      });

      if (rememberMe) {
        Cookies.set(PASSWORD_COOKIE, password, { expires: COOKIE_EXPIRY });
        Cookies.set(AUTH_COOKIE_NAME, token, { expires: COOKIE_EXPIRY });
      } else {
        Cookies.remove(PASSWORD_COOKIE);
        Cookies.set(AUTH_COOKIE_NAME, token); // Session cookie
      }

      await fetchAttendanceData(token);
    } catch (err) {
      setError(
        "Failed to fetch attendance data. Please check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    // Clear all auth-related cookies
    Cookies.remove(AUTH_COOKIE_NAME);

    // Only clear password if remember me is not set
    if (!rememberMe) {
      Cookies.remove(PASSWORD_COOKIE);
      setPassword("");
    }

    // Reset attendance data to trigger login screen
    setAttendanceData(null);
    setError("");
  };

  const toggleTheme = () => {
    setDarkMode(!darkMode);
  };

  return (
    <div
      className={`min-h-screen ${
        darkMode && attendanceData ? "bg-gray-900" : "bg-gray-100"
      }`}
    >
      <AnimatePresence mode="wait">
        {!attendanceData ? (
          <motion.div
            key="login"
            className="flex min-h-screen items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="manga-panel manga-border w-full max-w-md bg-white p-8 manga-fade-in"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center justify-center mb-8">
                <BookOpen className="h-16 w-16 text-black transform -rotate-12" />
                <Sparkles className="h-8 w-8 text-black absolute translate-x-8 -translate-y-8" />
              </div>
              <h2 className="anga-text text-3xl font-black text-center text-black mb-8 transform -rotate-2">
                CyberVidya Attendance
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <label
                    htmlFor="username"
                    className="manga-text block text-sm font-bold text-black"
                  >
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
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <label
                    htmlFor="password"
                    className="manga-text block text-sm font-bold text-black"
                  >
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
                </motion.div>
                <motion.div
                  className="flex items-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-5 w-5 manga-border rounded-none"
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 block manga-text-sm font-bold text-black"
                  >
                    Remember me
                  </label>
                </motion.div>
                {error && (
                  <motion.p
                    className="manga-text text-red-600 text-sm bg-red-100 p-2 manga-border"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {error}
                  </motion.p>
                )}
                <motion.button
                  type="submit"
                  disabled={loading}
                  className="w-full manga-border manga-text py-3 px-4 text-sm font-black text-white bg-black hover:bg-gray-800 focus:outline-none disabled:opacity-50 transform hover:-translate-y-1 transition-transform"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {loading ? "Loading..." : "View Attendance"}
                </motion.button>
              </form>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            className="container mx-auto px-4 py-8 flex-grow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className={`${
                darkMode ? "bg-gray-800" : "bg-white"
              } rounded-lg shadow-md p-6 mb-8 manga-border manga-fade-in`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <User
                    className={`h-14 w-14 ${
                      darkMode ? "text-blue-400" : "text-blue-600"
                    }`}
                  />
                  <div className="flex flex-col">
                    <h1
                      className={`text-xl font-black ${
                        darkMode ? "text-white" : "text-black"
                      } mb-1 text-center manga-text`}
                    >
                      {attendanceData.fullName}
                    </h1>
                    <p
                      className={`text-xs ${
                        darkMode ? "text-gray-300" : "text-black"
                      } font-semibold manga-text mb-0.5`}
                    >
                      {attendanceData.registrationNumber} |{" "}
                      {attendanceData.branchShortName} - Section{" "}
                      {attendanceData.sectionName}
                    </p>
                    <p
                      className={`text-xs ${
                        darkMode ? "text-gray-300" : "text-black"
                      } font-semibold manga-text`}
                    >
                      {attendanceData.degreeName} | Semester{" "}
                      {attendanceData.semesterName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-start md:gap-2 w-full md:w-auto self-start md:self-auto">
                  <motion.button
                    onClick={toggleTheme}
                    className={`manga-border manga-text p-2 rounded-full text-xs font-bold ${
                      darkMode
                        ? "bg-gray-700 text-yellow-300 hover:bg-gray-600"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    } focus:outline-none flex items-center gap-1`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {darkMode ? (
                      <Sun className="h-4 w-4" />
                    ) : (
                      <Moon className="h-4 w-4" />
                    )}
                  </motion.button>

                  <motion.button
                    onClick={handleLogout}
                    className={`manga-border manga-text py-2 px-3 text-xs font-bold text-white ${
                      darkMode
                        ? "bg-gray-600 hover:bg-gray-700"
                        : "bg-black hover:bg-gray-800"
                    } focus:outline-none transform hover:-translate-y-1 transition-transform flex items-center gap-1`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </motion.button>
                </div>
              </div>
            </motion.div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {attendanceData.attendanceCourseComponentInfoList.map(
                (course, index) => (
                  <motion.div
                    key={course.courseCode}
                    className={`${
                      darkMode ? "bg-gray-800" : "bg-white"
                    } rounded-lg shadow-md p-6 manga-border manga-fade-in`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                  >
                    <h3
                      className={`text-sm font-semibold ${
                        darkMode ? "text-gray-200" : "text-gray-800"
                      } mb-2 manga-text`}
                    >
                      {course.courseName}
                    </h3>
                    <p
                      className={`text-sm ${
                        darkMode ? "text-gray-400" : "text-gray-600"
                      } mb-4 manga-text`}
                    >
                      Code: {course.courseCode}
                    </p>
                    <div className="space-y-4">
                      {course.attendanceCourseComponentNameInfoList.map(
                        (component, idx) => {
                          const projection =
                            component.numberOfPeriods > 0
                              ? calculateAttendanceProjection(
                                  component.numberOfPresent +
                                    component.numberOfExtraAttendance,
                                  component.numberOfPeriods
                                )
                              : null;

                          return (
                            <motion.div
                              key={idx}
                              className="border-t-2 pt-4 border-black"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: 0.2 + idx * 0.1 }}
                            >
                              <div className="flex justify-between items-center mb-2">
                                <span
                                  className={`text-sm font-medium ${
                                    darkMode ? "text-gray-300" : "text-gray-700"
                                  } manga-text`}
                                >
                                  {component.componentName}
                                </span>
                                <span
                                  className="text-sm font-semibold"
                                  style={{
                                    color:
                                      (component.presentPercentage ?? 0) >= 75
                                        ? darkMode
                                          ? "#34D399"
                                          : "#059669"
                                        : darkMode
                                        ? "#F87171"
                                        : "#DC2626",
                                  }}
                                >
                                  {component.presentPercentageWith}
                                </span>
                              </div>
                              <div
                                className={`text-sm ${
                                  darkMode ? "text-gray-400" : "text-gray-600"
                                } mb-2`}
                              >
                                Present: {component.numberOfPresent}/
                                {component.numberOfPeriods}
                              </div>
                              {projection && (
                                <div
                                  className={`flex items-center gap-2 text-sm ${
                                    projection.status === "safe"
                                      ? darkMode
                                        ? "text-emerald-400"
                                        : "text-emerald-600"
                                      : darkMode
                                      ? "text-amber-400"
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
                            </motion.div>
                          );
                        }
                      )}
                    </div>
                  </motion.div>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.footer
        className={`${
          darkMode && attendanceData ? "bg-gray-800" : "bg-white"
        } shadow-md mt-auto manga-border`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2">
              <a
                href="https://github.com/AmanDevelops/attendance-kiet"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center space-x-2 ${
                  darkMode && attendanceData
                    ? "text-gray-400 hover:text-white"
                    : "text-gray-600 hover:text-black"
                } transition-colors manga-text font-extrabold`}
              >
                <span>View on GitHub</span>
              </a>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`${
                  darkMode && attendanceData ? "text-gray-400" : "text-gray-600"
                } manga-text font-extrabold`}
              >
                Contributors:
              </span>
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
                  <span className="text-xs font-medium text-gray-500 manga-text">
                    +1
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`mt-4 text-center text-sm ${
              darkMode && attendanceData ? "text-gray-400" : "text-gray-500"
            } manga-text font-extrabold`}
          >
            Made with ❤️ by WebDevGeeks
          </div>
        </div>
      </motion.footer>
    </div>
  );
}

export default App;
