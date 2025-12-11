import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	server: {
		proxy: {
			"/moodle": {
				target: "http://lms.kiet.edu",
				changeOrigin: true,
				secure: false,
				cookieDomainRewrite: "localhost",
				cookiePathRewrite: {
					"/moodle": "/moodle",
				},
			},
		},
	},
});
