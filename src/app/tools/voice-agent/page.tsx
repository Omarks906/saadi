"use client";

import Link from "next/link";
import { useState } from "react";

export default function VoiceAgentPage() {
  const [showMessage, setShowMessage] = useState(false);

  const handleRequestAccess = () => {
    setShowMessage(true);
    setTimeout(() => setShowMessage(false), 5000);
  };

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-8"
        >
          ← Back to home
        </Link>

        {/* Title */}
        <h1 className="text-4xl font-bold mb-4">Voice Agent</h1>
        
        {/* Description */}
        <p className="text-lg text-gray-600 mb-6">
          An AI phone assistant that answers calls, takes orders, and supports staff.
        </p>

        {/* Notice box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-blue-800 text-sm">
            This feature is currently in private pilot.
          </p>
        </div>

        {/* Request access button */}
        <div className="mb-6">
          <button
            onClick={handleRequestAccess}
            className="inline-flex items-center rounded-xl bg-black text-white px-5 py-3 hover:bg-gray-800 transition-colors"
          >
            Request pilot access
          </button>
          
          {showMessage && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-800 text-sm">
                Contact us to join the pilot. We'll be in touch soon!
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

