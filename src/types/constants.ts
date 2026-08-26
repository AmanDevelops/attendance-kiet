import Cookies from "js-cookie";

export const LIVE_URL = "https://kiet.cybervidya.net";
export const PROXY_URL = "https://proxy.cybervidya.workers.dev";
export const API_MODE_COOKIE_NAME = "api_mode"; // "proxy" | "live"

export function getApiMode(): "proxy" | "live" {
	try {
		const cookieVal = Cookies.get(API_MODE_COOKIE_NAME);
		if (cookieVal === "live" || cookieVal === "proxy") return cookieVal;
		if (typeof window !== "undefined") {
			const localVal = localStorage.getItem(API_MODE_COOKIE_NAME);
			if (localVal === "live" || localVal === "proxy") return localVal;
		}
	} catch {
		// Ignore storage errors
	}
	return "proxy";
}

export function setApiMode(mode: "proxy" | "live"): void {
	Cookies.set(API_MODE_COOKIE_NAME, mode, { expires: 365 });
	try {
		if (typeof window !== "undefined") {
			localStorage.setItem(API_MODE_COOKIE_NAME, mode);
		}
	} catch {
		// Ignore storage errors
	}
}

export function getBaseUrl(): string {
	return getApiMode() === "live" ? LIVE_URL : PROXY_URL;
}

export const BASE_URL = PROXY_URL;
export const AUTH_COOKIE_NAME = "auth_token";
export const USERNAME_COOKIE_NAME = "username";
export const REMEMBER_ME_COOKIE_NAME = "remember_me";
export const PASSWORD_COOKIE_NAME = "password";
export const COOKIE_EXPIRY = 7; // Days
export const STUDENT_ID_COOKIE_NAME = "studentId";
export const TARGET_PERCENTAGE = 75;
export const REQUIRED_EXTENSION_VERSION = "3.6";
