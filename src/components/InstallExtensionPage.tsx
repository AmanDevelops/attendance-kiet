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
		<article className="m-2 sm:m-10 style-border p-6 font-sans text-gray-800 dark:text-gray-100 leading-relaxed bg-white dark:bg-gray-800">
			<button
				type="button"
				className="style-border flex items-center justify-center h-10 p-5 gap-1 cursor-pointer hover:-translate-y-1 transition-transform mb-6"
				onClick={onBack}
			>
				<ArrowLeft />
				Back
			</button>

			<header className="mb-8 border-b border-gray-200 dark:border-gray-700 pb-6">
				<h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
					Install Kiet Auth Bridge
				</h1>
				<p className="text-gray-600 dark:text-gray-300">
					A secure bridge to sync your attendance from Kiet ERP.
				</p>
			</header>

			<div className="space-y-8">
				<div className="bg-yellow-50 dark:bg-yellow-950 border-l-4 border-yellow-400 p-4">
					<p className="text-sm text-yellow-800 dark:text-yellow-200">
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
							<span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs px-2 py-1 rounded">
								DESKTOP
							</span>{" "}
							Chrome / Edge / Brave
						</h3>
						<a
							href="https://github.com/AmanDevelops/attendance-kiet/releases/latest/download/chrome.zip"
							className="block w-full text-center py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded shadow transition-all hover:-translate-y-0.5"
						>
							Download Extension (ZIP)
						</a>
						<div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-100 dark:border-gray-700">
							<h4 className="font-semibold mb-2">Installation Steps:</h4>
							<ol className="list-decimal list-inside text-sm space-y-2 text-gray-700 dark:text-gray-200">
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
							<span className="bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 text-xs px-2 py-1 rounded">
								DESKTOP
							</span>{" "}
							Firefox
						</h3>
						<a
							href="https://github.com/AmanDevelops/attendance-kiet/releases/latest/download/firefox.xpi"
							className="block w-full text-center py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded shadow transition-all hover:-translate-y-0.5"
						>
							Download Extension (.xpi)
						</a>
						<div className="bg-orange-50 dark:bg-orange-950 p-4 rounded border border-orange-200 dark:border-orange-800 text-sm text-orange-900 dark:text-orange-100">
							<strong>⚠️ IMPORTANT:</strong> After installing or changing
							permissions, you <u>MUST reload this page</u> for the extension to
							be detected.
						</div>
						<div className="bg-gray-50 dark:bg-gray-900 p-4 rounded border border-gray-100 dark:border-gray-700">
							<h4 className="font-semibold mb-2">Installation Steps:</h4>
							<ol className="list-decimal list-inside text-sm space-y-2 text-gray-700 dark:text-gray-200">
								<li>Download and extract the ZIP file.</li>
								<li>
									Open <code>about:addons</code> in Firefox.
								</li>
								<li>
									Click <strong>Settings</strong> icon on top.
								</li>
								<li>
									Click <strong>Install Add-on From File…</strong>
								</li>
								<li>
									Select the <code>firefox.xpi</code> file you just downloaded
								</li>
								<li>
									Click on <code>Add</code>
								</li>
								<li>Enable Extension that you just added</li>
							</ol>
						</div>
					</section>
				</div>

				{/* Android */}
				<section className="border-t pt-8">
					<h3 className="font-bold text-xl mb-4 flex items-center gap-2">
						<span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs px-2 py-1 rounded">
							MOBILE
						</span>{" "}
						Android Users
					</h3>
					<div className="bg-gray-50 dark:bg-gray-900 p-6 rounded border border-gray-100 dark:border-gray-700">
						<p className="text-gray-700 dark:text-gray-200 mb-4">
							Standard Chrome on Android does not support extensions. You must
							use a browser that does.
						</p>

						<div>
							<h4 className="font-bold text-lg mb-2 text-orange-700 dark:text-orange-300">
								Firefox Nightly (Recommended)
							</h4>
							<p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
								Firefox Nightly for Android now supports installing add-ons
								directly from .xpi files!
							</p>

							<a
								href="https://github.com/AmanDevelops/attendance-kiet/releases/latest/download/firefox.xpi"
								className="block w-full text-center py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded shadow transition-all hover:-translate-y-0.5 mb-4"
							>
								Download Extension (.xpi)
							</a>

							<div className="space-y-4">
								<div>
									<h5 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-2">
										Step 1: Access the Debug Menu
									</h5>
									<ul className="list-disc list-inside text-sm space-y-1 text-gray-700 dark:text-gray-200">
										<li>
											Open Firefox Nightly and navigate to{" "}
											<strong>Settings</strong>.
										</li>
										<li>
											Scroll to <strong>About Firefox Nightly</strong>.
										</li>
										<li>
											Tap the Firefox logo swiftly <strong>five times</strong>.
										</li>
										<li>
											This will unlock the <strong>Secret Settings</strong> in
											your main Settings menu.
										</li>
									</ul>
								</div>

								<div>
									<h5 className="font-semibold text-sm text-gray-800 dark:text-gray-100 mb-2">
										Step 2: Install Your Add-ons
									</h5>
									<ul className="list-disc list-inside text-sm space-y-1 text-gray-700 dark:text-gray-200">
										<li>
											Go back to the main <strong>Settings</strong> menu.
										</li>
										<li>
											You'll see a new option:{" "}
											<strong>Install add-on from file</strong>.
										</li>
										<li>Select the .xpi file you've saved on your device.</li>
										<li>Your add-on will be installed!</li>
									</ul>
								</div>

								<div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
									<a
										href="https://www.reddit.com/r/firefox/s/ATGHJktQN"
										target="_blank"
										rel="noreferrer"
										className="text-blue-600 dark:text-blue-400 underline text-sm"
									>
										Learn more about this feature →
									</a>
								</div>
							</div>
						</div>
					</div>
				</section>
			</div>
		</article>
	);
};

export default InstallExtensionPage;
