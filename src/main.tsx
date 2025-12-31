import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) throw new Error("Root element not found");

createRoot(rootElement).render(
	<StrictMode>
		<GoogleReCaptchaProvider
			reCaptchaKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
		>
			<App />
		</GoogleReCaptchaProvider>
	</StrictMode>,
);
