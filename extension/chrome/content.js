console.log(
	"Kiet Extension: Content script starting on " + window.location.href,
);

const TARGET_URL = "https://cybervidya.pages.dev";
const TOKEN_KEY = "authenticationtoken";
const ERP_HOSTNAME = "kiet.cybervidya.net";

// URL marker the website appends when sending the user to the ERP, so the
// extension knows this visit is part of the attendance flow (and not a
// manual visit to the ERP, which must never trigger a redirect).
const ARM_MARKER = "analyse-attendance";

// Tab-scoped flag on the ERP origin: survives SPA navigations and full
// reloads during login, but is never set for tabs the user opens manually.
const ARM_FLAG_KEY = "kiet_analyse_armed";

// Remembers which origin (prod site or localhost dev server) sent the user,
// so they are returned to the same place.
const RETURN_ORIGIN_KEY = "kiet_return_origin";

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Extracts the auth token from localStorage, stripping surrounding quotes.
 * Returns null if no token is found.
 */
function getAuthToken() {
	const raw = localStorage.getItem(TOKEN_KEY);
	if (!raw) return null;
	return raw.replace(/^"|"$/g, "");
}

function isWebsiteHost(hostname) {
	return (
		hostname === "cybervidya.pages.dev" ||
		hostname.endsWith(".cybervidya.pages.dev") ||
		hostname === "localhost" ||
		hostname === "127.0.0.1"
	);
}

/**
 * Website side: injects the detection marker the app looks for and stores
 * the current origin as the return URL for after ERP login.
 */
function handleWebsite() {
	if (!document.getElementById("kiet-extension-installed")) {
		const marker = document.createElement("div");
		marker.id = "kiet-extension-installed";
		marker.style.display = "none";
		marker.setAttribute("aria-hidden", "true");
		// Lets the website detect outdated installs and prompt users to update.
		marker.setAttribute("data-version", chrome.runtime.getManifest().version);
		document.body.appendChild(marker);
	}

	chrome.storage.local.set({ [RETURN_ORIGIN_KEY]: window.location.origin });
}

function isArmedFromUrl() {
	return (
		window.location.hash.includes(ARM_MARKER) ||
		window.location.search.includes(ARM_MARKER)
	);
}

/**
 * Primary arming signal: the user navigated here from the attendance
 * website, so the referrer is the website's origin. Manual visits (typed
 * URL, bookmark, new tab) have an empty or foreign referrer and must never
 * arm the flow. Unlike the URL marker, the referrer survives the ERP's
 * client-side redirects (/ -> /login -> /home).
 */
function cameFromWebsite() {
	try {
		return (
			!!document.referrer && isWebsiteHost(new URL(document.referrer).hostname)
		);
	} catch {
		return false;
	}
}

/**
 * Removes the marker from the URL so a later manual refresh or back
 * navigation on the ERP does not re-arm the flow.
 */
function cleanMarkerFromUrl() {
	const url = new URL(window.location.href);
	url.searchParams.delete(ARM_MARKER);
	if (url.hash.includes(ARM_MARKER)) {
		url.hash = "";
	}
	window.history.replaceState({}, document.title, url.toString());
}

function redirectWithToken(token) {
	sessionStorage.removeItem(ARM_FLAG_KEY);
	chrome.storage.local.get(RETURN_ORIGIN_KEY, (result) => {
		const origin = (result && result[RETURN_ORIGIN_KEY]) || TARGET_URL;
		console.log("Kiet Extension: Auth token found, returning to " + origin);
		window.location.href = `${origin}/?token=${encodeURIComponent(token)}`;
	});
}

/**
 * ERP side: if the flow is armed, wait for the auth token to appear in
 * localStorage (i.e. successful login) and immediately return the user to
 * the website with it. Already-logged-in users are sent back instantly.
 */
function handleErp() {
	if (isArmedFromUrl() || cameFromWebsite()) {
		sessionStorage.setItem(ARM_FLAG_KEY, "1");
		cleanMarkerFromUrl();
		console.log("Kiet Extension: Attendance flow armed, waiting for login");
	}

	if (sessionStorage.getItem(ARM_FLAG_KEY) !== "1") {
		console.log("Kiet Extension: Flow not armed, staying on ERP");
		return;
	}

	const existingToken = getAuthToken();
	if (existingToken) {
		redirectWithToken(existingToken);
		return;
	}

	const startedAt = Date.now();
	const poll = setInterval(() => {
		const token = getAuthToken();
		if (token) {
			clearInterval(poll);
			redirectWithToken(token);
		} else if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
			clearInterval(poll);
			sessionStorage.removeItem(ARM_FLAG_KEY);
			console.log("Kiet Extension: Timed out waiting for login, disarmed");
		}
	}, POLL_INTERVAL_MS);
}

const hostname = window.location.hostname;
if (isWebsiteHost(hostname)) {
	handleWebsite();
} else if (hostname === ERP_HOSTNAME) {
	handleErp();
}
