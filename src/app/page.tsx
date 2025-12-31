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
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-semibold">Car Listings</h3>
                    <span className="bg-green-50 text-green-700 text-xs font-normal px-2 py-0.5 rounded">
                      Active
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Create clean car photos and ready-to-use ads
                  </p>
                </div>
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
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-semibold">Voice Agent</h3>
                    <span className="bg-gray-50 text-gray-500 text-xs font-normal px-2 py-0.5 rounded">
                      Coming soon
                    </span>
                  </div>
                  <p className="text-gray-600 text-sm">
                    AI phone assistant for handling customer calls
                  </p>
                </div>
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
