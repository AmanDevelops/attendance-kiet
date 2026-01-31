console.log(
	"Kiet Extension: Content script starting on " + window.location.href,
);

function checkAndRedirect() {
	const currentUrl = window.location.href;

	if (currentUrl.includes("kiet.cybervidya.net")) {
		if (currentUrl.includes("/home")) {
			let token = localStorage.getItem("authenticationtoken");

			if (token) {
				token = token.replace(/^"|"$/g, "");
				console.log("Kiet Extension: Token found.");

				chrome.storage.local.get(["targetOrigin"], (result) => {
					const targetOrigin =
						result.targetOrigin || "https://cybervidya.pages.dev";
					console.log("Kiet Extension: Redirecting to " + targetOrigin);
					window.location.href = `${targetOrigin}/?token=${encodeURIComponent(token)}`;
				});
			}
		}
	} else if (
		currentUrl.includes("localhost") ||
		currentUrl.includes("127.0.0.1") ||
		currentUrl.includes("cybervidya.pages.dev")
	) {
		console.log(
			"Kiet Extension: Running on App (" + window.location.origin + ")",
		);

		if (!document.getElementById("kiet-extension-installed")) {
			const marker = document.createElement("div");
			marker.id = "kiet-extension-installed";
			marker.style.display = "none";
			document.body.appendChild(marker);
			console.log("Kiet Extension: Marker injected.");
		}

		chrome.storage.local.set({ targetOrigin: window.location.origin }, () => {
			console.log("Kiet Extension: Origin saved as " + window.location.origin);
		});
	}
}

checkAndRedirect();

let lastUrl = location.href;
new MutationObserver(() => {
	const url = location.href;
	if (url !== lastUrl) {
		lastUrl = url;
		checkAndRedirect();
	}
}).observe(document, { subtree: true, childList: true });
