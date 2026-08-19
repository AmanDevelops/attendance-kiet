console.log(
	"Kiet Extension: Content script starting on " + window.location.href,
);

const TARGET_URL = "https://cybervidya.pages.dev";
const TOKEN_KEY = "authenticationtoken";
const ATTENDANCE_API =
	"https://kiet.cybervidya.net/api/attendance/course/component/student";
const REGISTERED_COURSES_API =
	"https://kiet.cybervidya.net/api/student/dashboard/registered-courses";
const SCHEDULE_API = "https://kiet.cybervidya.net/api/student/schedule/class";

/**
 * Extracts the auth token from localStorage, stripping surrounding quotes.
 * Returns null if no token is found.
 */
function getAuthToken() {
	const raw = localStorage.getItem(TOKEN_KEY);
	if (!raw) return null;
	return raw.replace(/^"|"$/g, "");
}

/**
 * Returns the current week's start (Sunday) and end (Saturday) dates
 * formatted as YYYY-MM-DD.
 */
function getWeekRange() {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dayOfWeek = today.getDay();

	const startDate = new Date(today);
	startDate.setDate(today.getDate() - dayOfWeek);

	const endDate = new Date(startDate);
	endDate.setDate(startDate.getDate() + 6);

	const fmt = (d) => {
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const dd = String(d.getDate()).padStart(2, "0");
		return `${yyyy}-${mm}-${dd}`;
	};

	return { startDate: fmt(startDate), endDate: fmt(endDate) };
}

/**
 * Fetches attendance data, registered courses, and weekly schedule
 * from the ERP API. Returns a combined payload.
 */
async function fetchERPData(token) {
	const headers = { Authorization: `GlobalEducation ${token}` };
	const { startDate, endDate } = getWeekRange();

	const [attendanceRes, coursesRes, scheduleRes] = await Promise.all([
		fetch(ATTENDANCE_API, { headers }),
		fetch(REGISTERED_COURSES_API, { headers }),
		fetch(`${SCHEDULE_API}?weekStartDate=${startDate}&weekEndDate=${endDate}`, {
			headers,
		}),
	]);

	if (!attendanceRes.ok) {
		throw new Error(`Attendance API failed: ${attendanceRes.status}`);
	}
	if (!coursesRes.ok) {
		throw new Error(`Registered courses API failed: ${coursesRes.status}`);
	}

	const attendanceData = await attendanceRes.json();
	const coursesData = await coursesRes.json();

	const studentId =
		coursesData.data && coursesData.data.length > 0
			? coursesData.data[0].studentId
			: null;

	// Schedule is optional — don't fail if it errors
	let schedule = null;
	if (scheduleRes.ok) {
		const scheduleData = await scheduleRes.json();
		schedule = scheduleData.data || null;
	}

	return {
		attendance: attendanceData.data,
		studentId: studentId,
		schedule: schedule,
	};
}

/**
 * Compresses a string using deflate and encodes it as base64url.
 * Uses the browser's built-in CompressionStream API.
 */
async function compressAndEncode(data) {
	const json = JSON.stringify(data);
	const stream = new Blob([json])
		.stream()
		.pipeThrough(new CompressionStream("deflate"));
	const compressed = await new Response(stream).arrayBuffer();
	const bytes = new Uint8Array(compressed);

	// Convert to base64
	let binary = "";
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	let base64 = btoa(binary);

	// Make URL-safe (base64url)
	base64 = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return base64;
}

/**
 * Creates a button element configured to fetch ERP data and redirect.
 */
function createRedirectButton(id) {
	const button = document.createElement("button");
	button.innerText = "Analyse Attendance via CyberVidya";
	button.id = id;
	button.className = "cta-btn-sm";

	button.addEventListener("click", async () => {
		const token = getAuthToken();

		if (!token) {
			alert("Authentication token not found. Please log in to the ERP first.");
			return;
		}

		// Show loading state
		const originalText = button.innerText;
		button.innerText = "Loading...";
		button.disabled = true;

		try {
			const data = await fetchERPData(token);
			const encoded = await compressAndEncode(data);

			const url = `${TARGET_URL}/?data=${encoded}`;
			console.log(
				"Kiet Extension: Opening CyberVidya (payload: " +
					encoded.length +
					" chars)",
			);
			window.open(url, "_blank");
		} catch (error) {
			console.error("Kiet Extension: Failed to fetch data", error);
			alert("Failed to fetch attendance data: " + error.message);
		} finally {
			button.innerText = originalText;
			button.disabled = false;
		}
	});

	return button;
}

/**
 * Polls for Attendance containers on the dashboard and injects buttons.
 * Should only be called when already on /main/dashboard.
 */
function injectButton() {
	const checkExist = setInterval(() => {
		const containers = document.getElementsByClassName(
			"dashboard-box-with-loader",
		);

		// Avoid injecting twice (e.g. SPA re-renders)
		if (document.getElementById("injected-button")) {
			clearInterval(checkExist);
			return;
		}

		const attendanceIndexes = [];
		for (let i = 0; i < containers.length; i++) {
			if (containers[i].innerText.includes("Attendance")) {
				attendanceIndexes.push(i);
			}
		}

		if (attendanceIndexes.length > 0) {
			clearInterval(checkExist);

			attendanceIndexes.forEach((index, order) => {
				const buttonId =
					order === 0 ? "injected-button" : `injected-button-${order}`;
				const button = createRedirectButton(buttonId);

				if (order === 1) {
					// Replace the search bar and remove the submit button
					const searchBar = containers[index].querySelector(
						"input.ng-untouched.ng-pristine.ng-valid",
					);
					const searchSubmit = containers[index].querySelector(
						'button[type="submit"]',
					);
					if (searchBar) {
						searchBar.parentNode.replaceChild(button, searchBar);
					} else {
						containers[index].appendChild(button);
					}
					if (searchSubmit) {
						searchSubmit.remove();
					}
				} else {
					containers[index].appendChild(button);
				}
			});

			console.log(
				"Kiet Extension: Button injected into " +
					attendanceIndexes.length +
					" container(s)",
			);
		}
	}, 500);
}

// Track SPA navigation via MutationObserver (works in content script isolated world)
let lastUrl = location.href;
let injected = false;

function checkRoute() {
	const onDashboard = window.location.pathname.includes("/main/dashboard");

	if (onDashboard && !injected) {
		console.log("Kiet Extension: Dashboard detected, injecting buttons");
		injected = true;
		injectButton();
	}
}

// Check on every DOM mutation (SPA route changes always mutate the DOM)
new MutationObserver(() => {
	if (location.href !== lastUrl) {
		lastUrl = location.href;
		checkRoute();
	}
}).observe(document.body, { childList: true, subtree: true });

// Also check immediately
checkRoute();
