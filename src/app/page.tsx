import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-3">SolutionOps</h1>
          <p className="text-xl text-gray-600">Practical AI tools for small businesses</p>
        </div>

        {/* Tools Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-6 text-center">Tools</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card 1: Car Listings */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Car Listings</h3>
                  <p className="text-gray-600 text-sm">
                    Create clean car photos and ready-to-use ads
                  </p>
                </div>
                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full">
                  Active
                </span>
              </div>
              <Link
                href="/new"
                className="inline-flex items-center rounded-xl bg-black text-white px-5 py-2.5 hover:bg-gray-800 transition-colors"
              >
                Open
              </Link>
            </div>

            {/* Card 2: Voice Agent */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Voice Agent</h3>
                  <p className="text-gray-600 text-sm">
                    AI phone assistant for handling customer calls
                  </p>
                </div>
                <span className="bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full">
                  Coming soon
                </span>
              </div>
              <Link
                href="/tools/voice-agent"
                className="inline-flex items-center rounded-xl border border-gray-300 text-gray-700 px-5 py-2.5 hover:bg-gray-50 transition-colors"
              >
                Learn more
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
