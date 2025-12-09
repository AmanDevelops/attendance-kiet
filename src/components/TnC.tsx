import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";

export default function TnC({
	setIsPasswordVisible,
}: {
	setIsPasswordVisible: React.Dispatch<React.SetStateAction<boolean>>;
}) {
	useEffect(() => {
		window.scrollTo({ top: 0, behavior: "instant" });
	}, []);
	return (
		<article className="m-2 sm:m-10 style-border p-6 font-sans text-gray-800 leading-relaxed bg-white">
			<button
				type="button"
				className="style-border flex items-center justify-center h-10 p-5 gap-1 cursor-pointer hover:-translate-y-1 transition-transform"
				onClick={() => setIsPasswordVisible(false)}
			>
				<ArrowLeft />
				Back
			</button>
			<br />
			<header className="mb-8 border-b border-gray-200 pb-6">
				<h1 className="text-3xl font-bold mb-2 text-gray-900">
					Privacy Policy for CyberVidya Attendance
				</h1>
			</header>

			<div className="space-y-4">
				<p className="font-semibold text-gray-600">Last Updated: 20-08-2025</p>

				<p className="mb-4">
					This Privacy Policy describes how your personal information is handled
					in{" "}
					<a
						href="http://cybervidya.pages.dev"
						className="text-blue-600 hover:underline"
					>
						KIET Attendance - Cybervidya
					</a>{" "}
					(the "Application").
				</p>

				{/* Section 1 */}
				<section>
					<h3 className="text-xl font-bold mt-8 mb-4 text-gray-900">
						1. The "Client-Side" Architecture
					</h3>
					<p className="mb-4">
						It is vital that you understand how this Application works:{" "}
						<strong className="font-bold">
							We do not store your academic data or your passwords on our
							servers.
						</strong>
					</p>
					<p className="mb-4">
						This Application is built using{" "}
						<strong className="font-bold">
							Client-Side technology (React)
						</strong>
						. This means that when you use the Application:
					</p>
					<ol className="list-decimal pl-6 space-y-2 mb-4">
						<li>We provide the code to your browser.</li>
						<li>
							<strong className="font-bold">Your browser</strong> executes the
							code.
						</li>
						<li>
							<strong className="font-bold">Your browser</strong> sends your
							credentials directly to the Official CyberVidya API.
						</li>
						<li>
							<strong className="font-bold">Your browser</strong> receives the
							data and formats it for you to see.
						</li>
					</ol>
					<p className="mb-4">
						At no point does your password or your academic record pass through
						a backend server owned or controlled by this Application. We act
						solely as a provider of the interface.
					</p>
				</section>

				{/* Section 2 */}
				<section>
					<h3 className="text-xl font-bold mt-8 mb-4 text-gray-900">
						2. Information Collection and Use
					</h3>

					<h4 className="text-lg font-semibold mt-4 mb-2 text-gray-800">
						A. User Credentials (Login Data)
					</h4>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>
							<strong className="font-bold">What we do:</strong> The Application
							accepts your Username and Password to authenticate with the
							Official CyberVidya API.
						</li>
						<li>
							<strong className="font-bold">Where it goes:</strong> These
							credentials are sent directly from your device to the Official
							CyberVidya servers.
						</li>
						<li>
							<strong className="font-bold">Storage:</strong> We{" "}
							<strong className="font-bold">do not</strong> store your password
							on our servers. The Application offers an optional "Remember Me"
							feature, if you enable it, your passwords are saved locally on{" "}
							<strong className="font-bold">your device</strong> (using Cookies)
							and are never transmitted to us.
						</li>
					</ul>

					<h4 className="text-lg font-semibold mt-4 mb-2 text-gray-800">
						B. Academic Data (Attendance, Marks, Profile)
					</h4>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>
							<strong className="font-bold">What we do:</strong> The Application
							processes your raw data to help you{" "}
							<strong className="font-bold">
								effectively manage your attendance
							</strong>
							. Instead of just listing records, we generate actionable metrics
							- specifically calculating the exact number of classes you must
							attend, or are permitted to miss, to maintain the required{" "}
							<strong className="font-bold">75% attendance threshold</strong>.
						</li>
						<li>
							<strong className="font-bold">Storage:</strong> This data exists
							only in your browser's memory (RAM) while the tab is open. We do
							not database, archive, or mine your academic records.
						</li>
					</ul>

					<h4 className="text-lg font-semibold mt-4 mb-2 text-gray-800">
						C. Infrastructure & Performance Logs (Cloudflare)
					</h4>
					<p className="mb-4">
						We host this Application on{" "}
						<strong className="font-bold">Cloudflare</strong>, a global cloud
						infrastructure provider. To maintain the security, stability, and
						performance of the site, Cloudflare automatically collects
						aggregate, non-personally identifiable anonymised traffic data at
						the network edge.
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>
							<strong className="font-bold">No Tracking Scripts:</strong> We do{" "}
							<strong className="font-bold">not</strong> inject tracking
							cookies, pixels, or JavaScript "spyware" into your browser.
						</li>
						<li>
							<strong className="font-bold">What is Logged:</strong> Based on
							standard web traffic protocols, Cloudflare reports to us:
							<ul className="list-[circle] pl-6 mt-2 space-y-1">
								<li>
									<strong className="font-bold">Device Information:</strong>{" "}
									Operating System and Browser type.
								</li>
								<li>
									<strong className="font-bold">General Location:</strong> The
									country from which the request originated.
								</li>
								<li>
									<strong className="font-bold">Traffic Sources:</strong> How
									you arrived at the site.
								</li>
							</ul>
						</li>
						<li>
							<strong className="font-bold">Purpose:</strong> This data is used
							solely to monitor server load and optimize the Application. It
							cannot be used to identify you personally.
						</li>
					</ul>
				</section>

				{/* Section 3 */}
				<section>
					<h3 className="text-xl font-bold mt-8 mb-4 text-gray-900">
						3. Data Security
					</h3>
					<p className="mb-4">
						Because we do not store your data, the security of your information
						relies primarily on:
					</p>
					<ol className="list-decimal pl-6 space-y-2 mb-4">
						<li>
							<strong className="font-bold">Your Device Security:</strong>{" "}
							Keeping your phone/laptop secure.
						</li>
						<li>
							<strong className="font-bold">
								The Official Source Security:
							</strong>{" "}
							The security protocols of the official CyberVidya API (HTTPS).
						</li>
					</ol>
				</section>

				{/* Section 4 */}
				<section>
					<h3 className="text-xl font-bold mt-8 mb-4 text-gray-900">
						4. Third-Party Services
					</h3>
					<p className="mb-4">
						This Application relies on the API provided by{" "}
						<strong className="font-bold">CyberVidya</strong>. Their use of your
						data is governed by their own Privacy Policy. We have no control
						over, and assume no responsibility for, the content, privacy
						policies, or practices of the{" "}
						<a
							href="https://cybervidya.net/privacy-policy"
							className="text-blue-600 hover:underline"
						>
							official CyberVidya service
						</a>
						.
					</p>
				</section>

				{/* Section 5 */}
				<section>
					<h3 className="text-xl font-bold mt-8 mb-4 text-gray-900">
						5. Disclaimer of Liability
					</h3>
					<p className="mb-4">
						By using this Application, you acknowledge that you are voluntarily
						providing your credentials to a third-party interface to access your
						data. You agree that this Application is not responsible for any
						data breaches resulting from malware on your device or
						vulnerabilities in the Official CyberVidya API.
					</p>
				</section>

				<hr className="my-8 border-gray-300" />

				{/* Addendum */}
				<section>
					<h3 className="text-xl font-bold mb-4 text-gray-900">
						Addendum to Terms of Service (Update)
					</h3>

					<h4 className="text-lg font-semibold mt-4 mb-2 text-gray-800">
						Updated Section 3: Nature of the Service (Client-Side Execution)
					</h4>
					<p className="mb-4">
						You acknowledge that this Service operates as a{" "}
						<strong className="font-bold">Client-Side Application</strong>.
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>
							<strong className="font-bold">No Intermediary:</strong> When you
							use this Service, your device connects directly to the Official
							Source. Our servers do not proxy, intercept, or store this
							traffic.
						</li>
						<li>
							<strong className="font-bold">User-Initiated Traffic:</strong> All
							API requests generated by this Service are initiated by{" "}
							<strong className="font-bold">you</strong>.
						</li>
					</ul>

					<h4 className="text-lg font-semibold mt-4 mb-2 text-gray-800">
						Updated Section 5: API Load and Account Safety
					</h4>
					<p className="mb-4">
						Because this Service runs on your device, excessive refreshing or
						automated usage may trigger security flags on the Official Source's
						servers.
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>
							<strong className="font-bold">Rate Limiting:</strong> You agree
							not to use automated scripts or bots to refresh the Service.
						</li>
						<li>
							<strong className="font-bold">Liability:</strong> We are not
							liable if the Official Source blocks your IP address or suspends
							your account due to high traffic volume generated by your usage.
						</li>
					</ul>
				</section>

				<hr className="my-8 border-gray-300" />
			</div>
		</article>
	);
}
