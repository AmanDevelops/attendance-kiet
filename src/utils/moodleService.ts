import axios from "axios";
import type { MoodleAssignment } from "../types/response";

// Proxy prefix to avoid CORS issues locally
const MOODLE_PROXY = "/moodle";

export const loginToMoodle = async (
	username: string,
	password: string,
): Promise<string> => {
	try {
		console.log("Initiating Moodle Login...");

		// 1. Get Login Token (or check if already logged in)
		const loginPage = await axios.get(`${MOODLE_PROXY}/login/index.php`);
		const parser = new DOMParser();
		const doc = parser.parseFromString(loginPage.data, "text/html");

		// Check if we are already logged in (redirected to dashboard or similar)
		// search for sesskey directly in the initial response
		let sesskey = "";
		const scripts = doc.querySelectorAll("script");
		scripts.forEach((script) => {
			const match = script.textContent?.match(/"sesskey":"([^"]+)"/);
			if (match) sesskey = match[1];
		});

		// FIX: Check if we are actually on the login page even if sesskey is found
		// The login page itself might expose a sesskey but we still need to log in.
		const isLoginPage =
			doc.querySelector('input[type="password"]') !== null ||
			doc.querySelector('input[name="password"]') !== null;

		if (sesskey && !isLoginPage) {
			console.log("Already logged in! Sesskey found directly:", sesskey);
			return sesskey;
		}

		const loginToken = doc
			.querySelector('input[name="logintoken"]')
			?.getAttribute("value");

		if (!loginToken) {
			console.error(
				"Debug: Login Page HTML snippet:",
				loginPage.data.substring(0, 500),
			);
			throw new Error("Could not find login token (and not logged in)");
		}

		// 2. Post Credentials
		const params = new URLSearchParams();
		params.append("username", username);
		params.append("password", password);
		params.append("logintoken", loginToken);

		const loginResponse = await axios.post(
			`${MOODLE_PROXY}/login/index.php`,
			params,
		);

		if (loginResponse.data.includes("Invalid login")) {
			throw new Error("Invalid Moodle credentials");
		}

		// 3. Get Sesskey from Dashboard
		// Moodle usually redirects or sets cookie which the browser handles automatically
		// We just need to fetch the dashboard to get the sesskey
		const dashboard = await axios.get(`${MOODLE_PROXY}/my/`);
		const dashboardDoc = parser.parseFromString(dashboard.data, "text/html");

		// Try to find sesskey in script
		sesskey = "";
		const dashboardScripts = dashboardDoc.querySelectorAll("script");
		dashboardScripts.forEach((script) => {
			const match = script.textContent?.match(/"sesskey":"([^"]+)"/);
			if (match) sesskey = match[1];
		});

		if (!sesskey) {
			const logoutLink = dashboardDoc.querySelector('a[href*="logout.php"]');
			if (logoutLink) {
				const urlParams = new URLSearchParams(
					logoutLink.getAttribute("href")?.split("?")[1],
				);
				sesskey = urlParams.get("sesskey") || "";
			}
		}

		if (!sesskey)
			throw new Error("Could not retrieve Moodle session key after login");

		console.log("Moodle Login Success. Sesskey:", sesskey);
		return sesskey;
	} catch (error) {
		console.error("Moodle Login Error:", error);
		throw error;
	}
};

export const fetchMoodleAssignments = async (
	sesskey: string,
): Promise<MoodleAssignment[]> => {
	try {
		console.log("Fetching Moodle assignments with sesskey:", sesskey);
		const now = Math.floor(Date.now() / 1000);
		const startTime = now - 30 * 24 * 60 * 60;
		const endTime = now + 180 * 24 * 60 * 60;

		const payload = [
			{
				index: 0,
				methodname: "core_calendar_get_action_events_by_timesort",
				args: {
					timesortfrom: startTime,
					timesortto: endTime,
					limitnum: 50,
				},
			},
		];

		const response = await axios.post(
			`${MOODLE_PROXY}/lib/ajax/service.php`,
			payload,
			{
				params: {
					sesskey: sesskey,
					info: "core_calendar_get_action_events_by_timesort",
				},
			},
		);

		console.log(
			"Moodle API Response FULL:",
			JSON.stringify(response.data, null, 2),
		);

		if (response.data?.[0]?.error) {
			console.warn(
				"Moodle API returned error (ignoring if spurious):",
				response.data[0].error,
			);
		}

		const events = response.data[0]?.data?.events || [];
		console.log("Raw Moodle Events found:", events.length);

		// biome-ignore lint/suspicious/noExplicitAny: Moodle API response is complex/dynamic
		return events.map((event: any) => ({
			id: event.id,
			course: event.course?.fullname || "Unknown Course",
			assignment: event.name || "Untitled Assignment",
			dueDate: new Date(event.timesort * 1000).toLocaleString(),
			status: event.timesort < now ? "Overdue/Past" : "Upcoming",
		}));
	} catch (error) {
		console.error("Fetch Assignments Error:", error);
		throw error;
	}
};
