import {
	createContext,
	type Dispatch,
	type SetStateAction,
	useContext,
	useEffect,
	useState,
} from "react";
import type { StudentDetails } from "../types/response";

export type Theme = "light" | "dark";

export type AttendanceDataContextType = {
	attendanceData: StudentDetails | null;
	setAttendanceData: Dispatch<SetStateAction<StudentDetails | null>>;
	targetPercentage: number;
	setTargetPercentage: (val: number) => void;
	theme: Theme;
	toggleTheme: () => void;
};

export const AttendanceDataContext = createContext<
	AttendanceDataContextType | undefined
>(undefined);

export const AttendanceDataProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [attendanceData, setAttendanceData] = useState<StudentDetails | null>(
		null,
	);
	const [targetPercentage, setTargetPercentage] = useState<number>(75);

	// Initialize theme from localStorage or system preference
	const [theme, setTheme] = useState<Theme>(() => {
		const savedTheme = localStorage.getItem("cybervidya_theme");
		return savedTheme === "dark" || savedTheme === "light"
			? savedTheme
			: "light";
	});

	useEffect(() => {
		const root = document.documentElement;
		if (theme === "dark") {
			root.classList.add("dark");
		} else {
			root.classList.remove("dark");
		}
		localStorage.setItem("cybervidya_theme", theme);
	}, [theme]);

	const toggleTheme = () => {
		setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
	};

	return (
		<AttendanceDataContext.Provider
			value={{
				attendanceData,
				setAttendanceData,
				targetPercentage,
				setTargetPercentage,
				theme,
				toggleTheme,
			}}
		>
			{children}
		</AttendanceDataContext.Provider>
	);
};

export const useAppContext = (): AttendanceDataContextType => {
	const context = useContext(AttendanceDataContext);
	if (context === undefined) {
		throw new Error(
			"useAppContext must be used within an AttendanceDataProvider",
		);
	}
	return context;
};
