console.log(
	"Kiet Extension: Content script starting on " + window.location.href,
);

function checkAndRedirect() {
	const currentUrl = window.location.href;

	// Logic for Kiet ERP site
	if (currentUrl.includes("kiet.cybervidya.net")) {
		if (currentUrl.includes("/home")) {
			let token = localStorage.getItem("authenticationtoken");

			if (token) {
				// Remove surrounding double quotes if present
				token = token.replace(/^"|"$/g, "");

				console.log("Kiet Extension: Token found, redirecting...");
				window.location.href = `https://cybervidya.pages.dev/?token=${encodeURIComponent(token)}`;
			}
		}
	} else if (
		currentUrl.includes("localhost") ||
		currentUrl.includes("127.0.0.1")
	) {
		console.log("Kiet Extension: Running on local app, signaling presence...");
		if (!document.getElementById("kiet-extension-installed")) {
			const marker = document.createElement("div");
			marker.id = "kiet-extension-installed";
			marker.style.display = "none";
			document.body.appendChild(marker);
			console.log("Kiet Extension: Marker injected.");
		}
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
