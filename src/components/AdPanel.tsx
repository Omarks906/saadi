"use client";

import { useState, useEffect } from "react";

interface AdContent {
  headline: string;
  short: string;
  body: string;
  bulletPoints: string[];
}

interface AdPanelProps {
  listingId: string;
  title: string;
  description?: string;
}

export default function AdPanel({ listingId, title, description }: AdPanelProps) {
  const [adContent, setAdContent] = useState<AdContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAd = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-ad", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ listingId }),
      });

      if (!response.ok) {
        // Try to parse error response, but handle if it's not JSON
        let errorMsg: string = `HTTP ${response.status}: Failed to generate ad`;
        
        try {
          const errorData = await response.json();
          if (errorData && typeof errorData === 'object') {
            // Prioritize message field, then error, then details
            const errorText = errorData.message || errorData.error || errorData.details;
            if (errorText && typeof errorText === 'string') {
              errorMsg = errorText;
            } else {
              errorMsg = `HTTP ${response.status}: ${JSON.stringify(errorData)}`;
            }
            if (errorData.raw) {
              errorMsg += `\n\nRaw response: ${errorData.raw}`;
            }
            if (errorData.code && errorData.code !== 'UNKNOWN') {
              errorMsg += ` (Code: ${errorData.code})`;
            }
          }
          console.error("API error response:", errorData);
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const text = await response.text();
            errorMsg = text && text.trim() 
              ? `HTTP ${response.status}: ${text}`
              : `HTTP ${response.status}: ${response.statusText || "Failed to generate ad"}`;
            console.error("Non-JSON error response:", text);
          } catch (textError) {
            errorMsg = `HTTP ${response.status}: ${response.statusText || "Failed to generate ad"}`;
            console.error("Could not read error response:", textError);
          }
        }
        
        // Ensure errorMsg is always a string
        if (typeof errorMsg !== 'string') {
          errorMsg = `HTTP ${response.status}: ${JSON.stringify(errorMsg)}`;
        }
        
        // Add user-friendly messages for common errors (only if we don't have a specific message)
        if (errorMsg === `HTTP ${response.status}: Failed to generate ad` || errorMsg.includes("HTTP")) {
          if (response.status === 429) {
            errorMsg = "Rate limit exceeded. Please wait a moment and try again. (Code: 429)";
          } else if (response.status === 401) {
            errorMsg = "Authentication failed. Please check your API key. (Code: 401)";
          } else if (response.status === 500) {
            errorMsg = "Server error. Please try again later or check your API key.";
          }
        }
        
        console.error("Full error details:", { 
          status: response.status, 
          statusText: response.statusText, 
          errorMsg: String(errorMsg) 
        });
        throw new Error(String(errorMsg));
      }

      // Only parse JSON if response is OK
      const data = await response.json();
      const ad = data.ad;
      
      if (!ad) {
        throw new Error("No ad data returned from server");
      }

      const safeAd = {
        headline: ad?.headline ?? "",
        short: ad?.short ?? "",
        body: ad?.body ?? "",
        bulletPoints: Array.isArray(ad?.bulletPoints) ? ad.bulletPoints : [],
      };
      setAdContent(safeAd);
    } catch (err) {
      console.error("Generate ad error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate ad");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Ad Content</h3>
        <button
          onClick={generateAd}
          disabled={isGenerating}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {isGenerating ? "Generating..." : "Generate Ad"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {adContent && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Headline</label>
              <button
                onClick={() => copyToClipboard(adContent.headline)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copy
              </button>
            </div>
            <div className="bg-gray-50 p-3 rounded border">{adContent.headline}</div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Short</label>
              <button
                onClick={() => copyToClipboard(adContent.short)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copy
              </button>
            </div>
            <div className="bg-gray-50 p-3 rounded border">{adContent.short}</div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Body</label>
              <button
                onClick={() => copyToClipboard(adContent.body)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copy
              </button>
            </div>
            <div className="bg-gray-50 p-3 rounded border">{adContent.body}</div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Bullet Points</label>
              <button
                onClick={() => copyToClipboard(adContent.bulletPoints.join(", "))}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copy All
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {adContent.bulletPoints.map((point, index) => (
                <span
                  key={index}
                  className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                >
                  {point}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


