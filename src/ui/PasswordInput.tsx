import { Eye, EyeOff } from "lucide-react";
import { forwardRef, memo, useState } from "react";

interface InputProps {
	defaultValue?: string;
}

const PasswordInput = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
	const [isPasswordVisible, togglePasswordVisibility] =
		useState<boolean>(false);

	return (
		<div className="flex items-center relative">
			<input
				id="password"
				type={isPasswordVisible ? "text" : "password"}
				ref={ref}
				defaultValue={props.defaultValue}
				className="mt-1 block w-full style-border rounded-none px-3 py-2 pr-10 bg-white focus:outline-none focus:ring-2 focus:ring-black"
				required
			/>

			<button
				type="button"
				onClick={() => togglePasswordVisibility(!isPasswordVisible)}
				className="absolute right-3 top-1/2 -translate-y-1/2 text-black hover:text-black focus:outline-none cursor-pointer"
				aria-label={isPasswordVisible ? "Hide password" : "Show password"}
			>
				{isPasswordVisible ? (
					<Eye className="h-6 w-6" />
				) : (
					<EyeOff className="h-6 w-6" />
				)}
			</button>
		</div>
	);
});

export default memo(PasswordInput);
