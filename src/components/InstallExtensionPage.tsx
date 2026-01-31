import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

interface InstallExtensionPageProps {
	onBack: () => void;
}

const InstallExtensionPage = ({ onBack }: InstallExtensionPageProps) => {
	useEffect(() => {
		window.scrollTo({ top: 0, behavior: "instant" });
	}, []);

	return (
		<article className="m-2 sm:m-10 style-border p-6 font-sans text-gray-800 leading-relaxed bg-white">
			<button
				type="button"
				className="style-border flex items-center justify-center h-10 p-5 gap-1 cursor-pointer hover:-translate-y-1 transition-transform mb-6"
				onClick={onBack}
			>
				<ArrowLeft />
				Back
			</button>

			<header className="mb-8 border-b border-gray-200 pb-6">
				<h1 className="text-3xl font-bold mb-2 text-gray-900">
					Install Kiet Auth Bridge
				</h1>
				<p className="text-gray-600">
					A secure bridge to sync your attendance from Kiet ERP.
				</p>
			</header>

			<div className="space-y-8">
				<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
					<p className="text-sm text-yellow-800">
						<strong>Why is this required?</strong> To securely retrieve your
						authentication token without storing your password, we use a browser
						extension. This ensures your credentials stay safe on the official
						ERP site.
					</p>
				</div>

				<div className="grid md:grid-cols-2 gap-8">
					{/* Chrome / Edge / Brave */}
					<section className="space-y-4">
						<h3 className="font-bold text-xl flex items-center gap-2 border-b pb-2">
							<span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
								DESKTOP
							</span>{" "}
							Chrome / Edge / Brave
						</h3>
						<a
							href="https://github.com/AmanDevelops/attendance-kiet/releases/download/v2.0/chrome.zip"
							className="block w-full text-center py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition-all hover:-translate-y-0.5"
						>
							Download Extension (ZIP)
						</a>
						<div className="bg-gray-50 p-4 rounded border border-gray-100">
							<h4 className="font-semibold mb-2">Installation Steps:</h4>
							<ol className="list-decimal list-inside text-sm space-y-2 text-gray-700">
								<li>Download and extract the ZIP file.</li>
								<li>
									Open <code>chrome://extensions</code> in your browser.
								</li>
								<li>
									Enable <strong>Developer mode</strong> (toggle in top right).
								</li>
								<li>
									Click <strong>Load unpacked</strong> button.
								</li>
								<li>Select the extracted folder.</li>
							</ol>
						</div>
					</section>

					{/* Firefox */}
					<section className="space-y-4">
						<h3 className="font-bold text-xl flex items-center gap-2 border-b pb-2">
							<span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
								DESKTOP
							</span>{" "}
							Firefox
						</h3>
						<a
							href="https://github.com/AmanDevelops/attendance-kiet/releases/download/v2.0/firefox.zip"
							className="block w-full text-center py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded shadow transition-all hover:-translate-y-0.5"
						>
							Download Extension (ZIP)
						</a>
						<div className="bg-orange-50 p-4 rounded border border-orange-200 text-sm text-orange-900">
							<strong>⚠️ IMPORTANT:</strong> After installing or changing
							permissions, you <u>MUST reload this page</u> for the extension to
							be detected.
						</div>
						<div className="bg-gray-50 p-4 rounded border border-gray-100">
							<h4 className="font-semibold mb-2">Installation Steps:</h4>
							<ol className="list-decimal list-inside text-sm space-y-2 text-gray-700">
								<li>Download and extract the ZIP file.</li>
								<li>
									Open <code>about:debugging</code> in Firefox.
								</li>
								<li>
									Click <strong>This Firefox</strong> on the left sidebar.
								</li>
								<li>
									Click <strong>Load Temporary Add-on...</strong>
								</li>
								<li>
									Select the <code>manifest.json</code> file inside the
									extracted folder.
								</li>
								<li>
									Ensure permissions are enabled for <code>localhost</code> (or{" "}
									<code>127.0.0.1</code>).
								</li>
							</ol>
						</div>
					</section>
				</div>

				{/* Android */}
				<section className="border-t pt-8">
					<h3 className="font-bold text-xl mb-4 flex items-center gap-2">
						<span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
							MOBILE
						</span>{" "}
						Android Users
					</h3>
					<div className="bg-gray-50 p-6 rounded border border-gray-100">
						<p className="text-gray-700 mb-4">
							Standard Chrome on Android does not support extensions. You must
							use a browser that does.
						</p>

						<div className="grid md:grid-cols-2 gap-6">
							<div>
								<h4 className="font-bold text-lg mb-2 text-teal-700">
									Option A: Kiwi Browser (Recommended)
								</h4>
								<p className="text-sm text-gray-600 mb-2">
									Kiwi is a Chromium-based browser that supports desktop Chrome
									extensions.
								</p>
								<ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
									<li>Install Kiwi Browser from Play Store.</li>
									<li>Download the Chrome ZIP file above.</li>
									<li>
										Go to <code>extensions</code> in the menu.
									</li>
									<li>Enable Developer Mode and load the .zip file.</li>
								</ul>
							</div>

							<div>
								<h4 className="font-bold text-lg mb-2 text-purple-700">
									Option B: Firefox Nightly
								</h4>
								<p className="text-sm text-gray-600 mb-2">
									Requires creating a custom add-on collection.
								</p>
								<ul className="list-disc list-inside text-sm space-y-1 text-gray-700">
									<li>
										See guide:{" "}
										<a
											href="https://blog.mozilla.org/addons/2020/09/29/expanded-extension-support-in-firefox-for-android-nightly/"
											target="_blank"
											rel="noreferrer"
											className="text-blue-600 underline"
										>
											Expanded Extension Support
										</a>
									</li>
									<li>Use debug mode via USB if necessary.</li>
								</ul>
							</div>
						</div>
					</div>
				</section>
			</div>
		</article>
	);
};

export default InstallExtensionPage;
