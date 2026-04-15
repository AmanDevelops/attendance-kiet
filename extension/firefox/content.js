/**
 * Kiet Auth Bridge - Content Script
 * Safely bridges authentication tokens between the ERP and the Attendance App.
 */

(() => {
	const API_NAMESPACE = browser;
	const TARGET_DOMAINS = ["cybervidya.pages.dev"];
	const ERP_DOMAIN = "kiet.cybervidya.net";
	const TOKEN_KEY = "authenticationtoken";
	const MARKER_ID = "kiet-extension-installed";

	/**
	 * Main logic to handle redirection or marker injection based on current URL.
	 */
	async function handleNavigation() {
		try {
			const url = new URL(window.location.href);

			// Case 1: On the ERP site, handle token extraction and redirection
			if (url.hostname === ERP_DOMAIN && url.pathname.includes("/home")) {
				const rawToken = localStorage.getItem(TOKEN_KEY);
				if (rawToken) {
					const token = rawToken.replace(/^"|"$/g, "");

					const settings =
						await API_NAMESPACE.storage.local.get("targetOrigin");
					if (!settings.targetOrigin) return;
					const targetOrigin = settings.targetOrigin;

					await API_NAMESPACE.storage.local.remove("targetOrigin");

					const redirectUrl = new URL(targetOrigin);
					redirectUrl.searchParams.set("token", token);

					window.location.replace(redirectUrl.toString());
				} else {
					await API_NAMESPACE.storage.local.remove("targetOrigin");
				}
			}
			// Case 2: On the app site, inject marker and save origin
			else if (TARGET_DOMAINS.includes(url.hostname)) {
				if (!document.getElementById(MARKER_ID)) {
					const marker = document.createElement("div");
					marker.id = MARKER_ID;
					marker.style.display = "none";
					marker.setAttribute("aria-hidden", "true");
					document.body.appendChild(marker);
				}

				await API_NAMESPACE.storage.local.set({
					targetOrigin: window.location.origin,
				});
			}
		} catch (error) {}
	}

	window.addEventListener("storage", (event) => {
		if (event.key === TOKEN_KEY && event.newValue === null) {
			API_NAMESPACE.storage.local.remove("targetOrigin");
		}
	});

	// Initial execution
	handleNavigation();

	// Observe URL changes for Single Page Applications (SPAs)
	let lastPath = location.pathname + location.search;
	const observer = new MutationObserver(() => {
		const currentPath = location.pathname + location.search;
		if (currentPath !== lastPath) {
			lastPath = currentPath;
			handleNavigation();
		}
	});

	// Start observing with minimal impact
	observer.observe(document, { subtree: true, childList: true });
})();
