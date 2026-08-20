import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { REQUIRED_EXTENSION_VERSION } from "../types/constants";

const DISMISS_KEY = "extension_update_notice_dismissed";

function isVersionOutdated(version: string | null): boolean {
	if (!version) return true; // Old extensions do not report a version
	const current = version.split(".").map(Number);
	const required = REQUIRED_EXTENSION_VERSION.split(".").map(Number);
	for (let i = 0; i < required.length; i++) {
		const currentPart = current[i] ?? 0;
		const requiredPart = required[i];
		if (currentPart < requiredPart) return true;
		if (currentPart > requiredPart) return false;
	}
	return false;
}

function ExtensionUpdateNotice() {
	const [installedVersion, setInstalledVersion] = useState<string | null>(null);
	const [isOutdated, setIsOutdated] = useState<boolean>(false);
	const [dismissed, setDismissed] = useState<boolean>(
		() => sessionStorage.getItem(DISMISS_KEY) === "true",
	);

	useEffect(() => {
		const checkExtension = () => {
			const marker = document.getElementById("kiet-extension-installed");
			if (marker) {
				const version = marker.getAttribute("data-version");
				setInstalledVersion(version);
				setIsOutdated(isVersionOutdated(version));
			}
		};

		checkExtension();
		const interval = setInterval(checkExtension, 1000); // Check periodically
		return () => clearInterval(interval);
	}, []);

	if (!isOutdated || dismissed) return null;

	const handleDismiss = () => {
		sessionStorage.setItem(DISMISS_KEY, "true");
		setDismissed(true);
	};

	return (
		<div className="w-full bg-amber-100 border-b-2 border-amber-400">
			<div className="max-w-3xl mx-auto py-3 px-4 flex items-start gap-3">
				<AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
				<div className="text-sm text-amber-900">
					<p className="font-bold">
						Extension update required
						{installedVersion ? ` (you have v${installedVersion})` : ""}
					</p>
					<p className="mt-1">
						You are using an outdated version of the{" "}
						<strong>KIET Auth Bridge</strong> extension. Please remove it and
						install the latest version (v{REQUIRED_EXTENSION_VERSION}) to
						continue using the app:
					</p>
					<ol className="list-decimal list-inside mt-2 space-y-1">
						<li>
							Remove the old extension — Chrome:{" "}
							<code>chrome://extensions</code> · Firefox:{" "}
							<code>about:addons</code>
						</li>
						<li>Download and install the latest version:</li>
					</ol>
					<div className="flex flex-wrap gap-2 mt-2">
						<a
							href="https://github.com/AmanDevelops/attendance-kiet/releases/latest/download/chrome.zip"
							className="style-border bg-white px-3 py-1 font-bold text-black hover:bg-black hover:text-white transition-colors"
						>
							Chrome / Edge / Brave
						</a>
						<a
							href="https://github.com/AmanDevelops/attendance-kiet/releases/latest/download/firefox.xpi"
							className="style-border bg-white px-3 py-1 font-bold text-black hover:bg-black hover:text-white transition-colors"
						>
							Firefox
						</a>
					</div>
				</div>
				<button
					type="button"
					onClick={handleDismiss}
					className="ml-auto shrink-0 text-amber-600 hover:text-amber-900 cursor-pointer"
					aria-label="Dismiss extension update notice"
				>
					<X className="h-5 w-5" />
				</button>
			</div>
		</div>
	);
}

export default ExtensionUpdateNotice;
