import { Moon, Sun } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";

function Footer() {
	const { theme, toggleTheme } = useAppContext();

	return (
		<footer className="w-full py-4 px-6 flex justify-between items-center mt-auto text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-400">
			<div>CyberVidya Attendance • Built with React & Vite</div>

			<button
				type="button"
				onClick={toggleTheme}
				className="flex items-center gap-2 p-2 border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-[2px_2px_0_#000] dark:shadow-[2px_2px_0_#fff]"
				aria-label="Toggle theme"
			>
				{theme === "dark" ? (
					<>
						<Sun className="h-4 w-4" />
						<span>Light Mode</span>
					</>
				) : (
					<>
						<Moon className="h-4 w-4" />
						<span>Dark Mode</span>
					</>
				)}
			</button>
		</footer>
	);
}

export default Footer;
