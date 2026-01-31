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
					Terms of Service & Privacy Policy
				</h1>
				<p className="text-gray-500 text-sm">Last Updated: 31-01-2026</p>
			</header>

			<div className="space-y-6">
				{/* CRITICAL DISCLAIMER */}
				<section className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
					<h3 className="text-xl font-black text-red-800 mb-2 uppercase tracking-wide">
						Strictly Personal Project - Disclaimer
					</h3>
					<p className="mb-2 font-bold text-red-900">
						PLEASE READ THIS CAREFULLY BEFORE PROCEEDING.
					</p>
					<p className="mb-3 text-red-800">
						This Application is a <strong>personal project</strong> created
						solely for the private use of its developer/creator. It is{" "}
						<strong>NOT</strong> an official product of CyberVidya.
					</p>
					<p className="mb-3 text-red-800">
						While the source code is hosted publicly (e.g., on GitHub) for
						educational and portfolio purposes,{" "}
						<strong>
							the creator assumes NO RESPONSIBILITY for its use, distribution,
							or modification by any third party.
						</strong>
					</p>
					<p className="mb-0 text-red-800 italic">
						If you are not the creator and you choose to use this Application,
						you do so entirely at your own risk. The creator expressly disclaims
						any liability for any consequences resulting from your use of this
						software.
					</p>
				</section>

				{/* Section 1 */}
				<section>
					<h3 className="text-xl font-bold mb-4 text-gray-900">
						1. Nature of the Application
					</h3>
					<p className="mb-4">
						This Application is a client-side interface designed to facilitate
						access to attendance data.
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>
							<strong>No Server-Side Storage:</strong> We do not store your
							passwords or academic records on our servers.
						</li>
						<li>
							<strong>Direct Connection:</strong> Your browser connects directly
							to the official CyberVidya API.
						</li>
						<li>
							<strong>Open Source:</strong> The code is open-source, allowing
							transparency. However, this transparency does not constitute a
							license for unauthorized public deployment or commercial use.
						</li>
					</ul>
				</section>

				{/* Section 2 */}
				<section>
					<h3 className="text-xl font-bold mb-4 text-gray-900">
						2. Limitation of Liability & Indemnification
					</h3>
					<p className="mb-4">
						<strong>To the fullest extent permitted by Indian Law:</strong>
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>
							The creator shall not be liable for any direct, indirect,
							incidental, special, consequential, or exemplary damages,
							including but not limited to, damages for loss of profits,
							goodwill, use, data, or other intangible losses.
						</li>
						<li>
							The creator is not responsible for any legal disputes, academic
							penalties, or administrative actions taken against you by your
							Institution or CyberVidya arising from your use of this tool.
						</li>
						<li>
							<strong>Unauthorized Distribution:</strong> If this Application is
							shared, hosted, or distributed by third parties without the
							creator's explicit consent, the creator holds no responsibility
							for such actions. Any person using such third-party distributions
							does so at their own peril.
						</li>
					</ul>
				</section>

				{/* Section 3 */}
				<section>
					<h3 className="text-xl font-bold mb-4 text-gray-900">
						3. Compliance with Indian Laws
					</h3>
					<p className="mb-4">
						This project is created with the intent of purely personal utility
						and educational experimentation, protected under the principles of
						fair dealing/fair use.
					</p>
					<p className="mb-4">
						<strong>Notice to CyberVidya:</strong>
					</p>
					<p className="mb-4 bg-gray-50 p-3 rounded text-sm border border-gray-200">
						"This software acts as a user-agent (browser extension/interface)
						that automates the retrieval of data that the user is already
						authorized to access via their official credentials. It does not
						bypass authentication, does not hack into servers, and does not
						access data of other users. It strictly operates within the scope of
						the user's own authorized session. Any legal notice regarding this
						personal project should be directed to the creator for amicable
						resolution, acknowledging that this is a non-commercial,
						student-made utility."
					</p>
				</section>

				{/* Section 4 */}
				<section>
					<h3 className="text-xl font-bold mb-4 text-gray-900">
						4. Data Privacy
					</h3>
					<p className="mb-4">
						Since the project is designed for personal use:
					</p>
					<ul className="list-disc pl-6 space-y-2 mb-4">
						<li>
							<strong>Credentials:</strong> Your credentials are sent only to
							the official ERP. We do not see them.
						</li>
						<li>
							<strong>Local Storage:</strong> Any data persisting across
							sessions (like tokens) is stored locally on your device via
							browser mechanisms (Cookies/LocalStorage).
						</li>
					</ul>
				</section>

				{/* Section 5 */}
				<section>
					<h3 className="text-xl font-bold mb-4 text-gray-900">
						5. Third-Party Services
					</h3>
					<p className="mb-4">
						This Application interacts with the API provided by{" "}
						<strong className="font-bold">CyberVidya</strong>. We claim no
						ownership over the data provided by their service. All rights to the
						attendance data and institutional records belong to CyberVidya.
					</p>
				</section>

				<hr className="my-8 border-gray-300" />

				<footer className="text-sm text-gray-500 italic text-center">
					By using this software, you confirm that you have read, understood,
					and agreed to these terms. If you do not agree, you must stop using
					this Application immediately.
				</footer>
			</div>
		</article>
	);
}
