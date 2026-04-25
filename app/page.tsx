export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 sm:p-24">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">
          Henry&apos;s Math Classroom
        </h1>
        <p className="text-lg sm:text-xl text-gray-600">
          Welcome to your math learning platform
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="/login"
            className="block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-center"
          >
            Login
          </a>
          <a
            href="/signup"
            className="block px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition text-center"
          >
            Sign Up
          </a>
        </div>
      </div>
    </main>
  )
}
