export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "attendance_theme";

/**
 * Saved choice wins. If the user never chose, follow the OS setting.
 * Storage or matchMedia can throw (private mode, old browsers), so guard both.
 */
export function getInitialTheme(): Theme {
	try {
		const saved = localStorage.getItem(THEME_STORAGE_KEY);
		if (saved === "light" || saved === "dark") {
			return saved;
		}
	} catch {
		// Ignore storage errors
	}
	try {
		if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
			return "dark";
		}
	} catch {
		// Ignore matchMedia errors
	}
	return "light";
}

/** Adds or removes the `dark` class on <html>. Does NOT touch storage. */
export function applyTheme(theme: Theme): void {
	document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Saves the user's explicit choice. Only call this from the toggle handler. */
export function saveTheme(theme: Theme): void {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch {
		// Ignore storage errors
	}
}
