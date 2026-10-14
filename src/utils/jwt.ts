import Cookies from "js-cookie";
import { AUTH_COOKIE_NAME, STUDENT_ID_COOKIE_NAME } from "../types/constants";

const FALLBACK_LIFETIME_MS = 60 * 60 * 1000;

/** Expiry of a JWT as a Date, or null if it has no readable `exp` claim. */
export function getTokenExpiry(token: string): Date | null {
	try {
		// A JWT is three base64url parts joined by dots: header.payload.signature.
		// The expiry lives in the middle part, so that's the only one we need.
		const payload = token.split(".")[1];
		if (!payload) return null;

		// "base64url" swaps in `-`/`_` for the `+`/`/` that regular base64 (and
		// hence atob, the browser's base64 decoder) expects, and it drops the
		// trailing `=` padding - so we restore both before decoding.
		const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
		const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

		// atob turns base64 text back into the original JSON string, which we
		// then parse into the token's claims (e.g. `exp`, the expiry time).
		const claims = JSON.parse(atob(padded)) as { exp?: unknown };

		// `exp` is seconds since epoch per the JWT spec; Date wants milliseconds.
		return typeof claims.exp === "number" ? new Date(claims.exp * 1000) : null;
	} catch {
		return null;
	}
}

/** Stores the auth cookie so it lives exactly as long as the JWT does. */
export function setAuthCookie(token: string): void {
	const expiry =
		getTokenExpiry(token) ?? new Date(Date.now() + FALLBACK_LIFETIME_MS);
	Cookies.set(AUTH_COOKIE_NAME, token, { expires: expiry });
}

/** Milliseconds until the stored token expires, or null if there is none. */
export function msUntilAuthExpiry(): number | null {
	const token = Cookies.get(AUTH_COOKIE_NAME);
	if (!token) return null;
	const expiry = getTokenExpiry(token);
	return expiry ? expiry.getTime() - Date.now() : null;
}

export function clearAuthCookies(): void {
	Cookies.remove(AUTH_COOKIE_NAME);
	Cookies.remove(STUDENT_ID_COOKIE_NAME);
}
