import { Moon, Sun } from "lucide-react";
import type { Theme } from "../utils/theme";

interface FooterProps {
	theme: Theme;
	onToggleTheme: () => void;
}

function Footer({ theme, onToggleTheme }: FooterProps) {
	return (
		<footer className="bg-white dark:bg-gray-800 shadow-md mt-auto style-border">
			<div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
				<div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
					<div className="flex items-center space-x-2">
						<a
							href="https://github.com/AmanDevelops/attendance-kiet"
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center space-x-2 text-gray-600 hover:text-black dark:text-gray-300 dark:hover:text-white transition-colors style-text font-extrabold"
						>
							<span>View on GitHub</span>
						</a>
					</div>

					<div className="flex items-center space-x-2">
						<span className="text-gray-600 dark:text-gray-300 style-text font-extrabold">
							Contributors:
						</span>
						<div className="flex -space-x-2">
							<a
								href="http://github.com/AmanDevelops"
								target="_blank"
								rel="noopener noreferrer"
							>
								<img
									className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 style-border transform hover:-translate-y-1 transition-transform"
									src="https://avatars.githubusercontent.com/AmanDevelops?s=36"
									alt="Contributor 1"
								/>
							</a>
							<a
								href="http://github.com/rishav76dev"
								target="_blank"
								rel="noopener noreferrer"
							>
								<img
									className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 style-border transform hover:-translate-y-1 transition-transform"
									src="https://avatars.githubusercontent.com/rishav76dev?s=16"
									alt="Contributor 3"
								/>
							</a>

							<a
								href="http://github.com/honoursbhaduria"
								target="_blank"
								rel="noopener noreferrer"
							>
								<img
									className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 style-border transform hover:-translate-y-1 transition-transform"
									src="https://avatars.githubusercontent.com/honoursbhaduria?s=48"
									alt="Contributor 1"
								/>
							</a>
							<a
								href="http://github.com/dev-himanshu-x"
								target="_blank"
								rel="noopener noreferrer"
							>
								<img
									className="inline-block h-8 w-8 rounded-full ring-2 ring-white dark:ring-gray-800 style-border transform hover:-translate-y-1 transition-transform"
									src="https://avatars.githubusercontent.com/dev-himanshu-x?s=48"
									alt="Contributor 1"
								/>
							</a>
							<div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white dark:bg-gray-700 dark:ring-gray-800 style-border transform hover:-translate-y-1 transition-transform">
								<span className="text-xs font-medium text-gray-500 dark:text-gray-300 style-text">
									+1
								</span>
							</div>
						</div>
					</div>

					<button
						type="button"
						onClick={onToggleTheme}
						aria-pressed={theme === "dark"}
						aria-label={
							theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
						}
						className="style-border style-text inline-flex items-center gap-2 px-3 py-2 text-xs font-black cursor-pointer bg-white text-black hover:bg-gray-100 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700 transition-colors"
					>
						{theme === "dark" ? (
							<Sun className="h-4 w-4" />
						) : (
							<Moon className="h-4 w-4" />
						)}
						<span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
					</button>
				</div>

				<div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400 style-text font-extrabold">
					Made with ❤️ by{" "}
					<a href="https://github.com/AmanDevelops">AmanDevelops</a>
				</div>
			</div>
		</footer>
	);
}

export default Footer;
