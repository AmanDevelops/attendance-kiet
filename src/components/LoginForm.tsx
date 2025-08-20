import { BookOpen, Eye, EyeOff, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

function LoginForm() {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://buttons.github.io/buttons.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const tooglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center p-4">
      <div className="flex gap-5 align-center mb-5 items-center">
        <div className="follow-btn">
          <a
            className="github-button follow-btn"
            href="https://github.com/amandevelops"
            data-color-scheme="no-preference: light; light: light; dark: light;"
            data-size="large"
            aria-label="Follow @amandevelops on GitHub"
          >
            Follow @amandevelops
          </a>
        </div>
        <div>
          <a
            href="https://github.com/AmanDevelops/attendance-kiet"
            target="_blank"
          >
            <img
              src="/star.gif"
              alt="star this repo"
              className="h-15 rounded-2xl"
            />
          </a>
        </div>
      </div>
      <div className="manga-panel manga-border w-full max-w-md bg-white p-8 manga-fade-in">
        <div className="flex items-center justify-center mb-8">
          <BookOpen className="h-16 w-16 text-black transform -rotate-12" />
          <Sparkles className="h-8 w-8 text-black absolute translate-x-8 -translate-y-8" />
        </div>
        <h2 className="anga-text text-3xl font-black text-center text-black mb-8 transform -rotate-2">
          CyberVidya Attendance
        </h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="username"
              className="manga-text block text-sm font-bold text-black"
            >
              University Roll Number
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="20240XXXXXXXXXX"
              className="mt-1 block w-full manga-border rounded-none px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="manga-text block text-sm font-bold text-black"
            >
              CyberVidya Password
            </label>
            <div className="flex items-center relative">
              <input
                id="password"
                type={isPasswordVisible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full manga-border rounded-none px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-black"
                required
              />
              {isPasswordVisible ? (
                <Eye
                  className="absolute right-3 cursor-pointer"
                  onClick={tooglePasswordVisibility}
                />
              ) : (
                <EyeOff
                  className="absolute right-3 cursor-pointer"
                  onClick={tooglePasswordVisibility}
                />
              )}
            </div>
          </div>
          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-5 w-5 manga-border rounded-none"
            />
            <label
              htmlFor="remember-me"
              className="ml-2 block manga-text-sm font-bold text-black"
            >
              Remember me
            </label>
          </div>
          <div>
            By clicking <i>'View Attendance'</i>, you agree to Cybervidya’s{" "}
            <a
              href="https://cybervidya.net/privacy-policy"
              className="text-gray-500"
            >
              Privacy Policy.
            </a>
          </div>

          {error && (
            <p className="manga-text text-red-600 text-sm bg-red-100 p-2 manga-border">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full manga-border manga-text py-3 px-4 text-sm font-black text-white bg-black hover:bg-gray-800 focus:outline-none disabled:opacity-50 transform hover:-translate-y-1 transition-transform cursor-pointer"
          >
            {loading ? "Loading..." : "View Attendance"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginForm;
