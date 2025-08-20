function Footer() {
  return (
    <footer className="bg-white shadow-md mt-auto manga-border">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <a
              href="https://github.com/AmanDevelops/attendance-kiet"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-2 text-gray-600 hover:text-black transition-colors manga-text font-extrabold"
            >
              <span>View on GitHub</span>
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-gray-600 manga-text font-extrabold">
              Contributors:
            </span>
            <div className="flex -space-x-2">
              <a
                href="http://github.com/AmanDevelops"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white manga-border transform hover:-translate-y-1 transition-transform"
                  src="https://avatars.githubusercontent.com/AmanDevelops"
                  alt="Contributor 1"
                />
              </a>
              <a
                href="http://github.com/rishav76dev"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white manga-border transform hover:-translate-y-1 transition-transform"
                  src="https://avatars.githubusercontent.com/rishav76dev"
                  alt="Contributor 3"
                />
              </a>
              <a
                href="http://github.com/honoursbhaduria"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white manga-border transform hover:-translate-y-1 transition-transform"
                  src="https://avatars.githubusercontent.com/honoursbhaduria"
                  alt="Contributor 1"
                />
              </a>
              <a
                href="http://github.com/webdevgeeks"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white manga-border transform hover:-translate-y-1 transition-transform"
                  src="https://avatars.githubusercontent.com/webdevgeeks"
                  alt="Contributor 2"
                />
              </a>
              <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-2 ring-white manga-border transform hover:-translate-y-1 transition-transform">
                <span className="text-xs font-medium text-gray-500 manga-text">
                  +1
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-sm text-gray-500 manga-text font-extrabold">
          Made with ❤️ by{" "}
          <a href="https://github.com/AmanDevelops">AmanDevelops</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
