console.log("Kiet Auth Bridge loaded");

function checkAndRedirect() {
	if (window.location.href.includes("/home")) {
		let token = localStorage.getItem("authenticationtoken");

		if (token) {
			token = token.replace(/^"|"$/g, "");

			console.log("Token found, redirecting...");
			window.location.href = `https://cybervidya.pages.dev/?token=${encodeURIComponent(token)}`;
		} else {
			console.log(
				"On home page but no 'authenticationtoken' found in localStorage.",
			);
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
