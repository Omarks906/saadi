"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import PhotoGrid from "@/components/PhotoGrid";
import AdPanel from "@/components/AdPanel";
import type { Listing } from "@/lib/listings";

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>("#FFFFFF"); // Default white
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug: log params to see what we're getting
  useEffect(() => {
    console.log("Params object:", params);
    console.log("Params.id:", params.id);
    console.log("Type of params.id:", typeof params.id);
  }, [params]);

  // Extract listingId from params, handling both string and array cases
  // In Next.js App Router, params.id should be a string, but let's be defensive
  const listingId = params?.id 
    ? (typeof params.id === "string" 
        ? params.id 
        : Array.isArray(params.id) 
          ? params.id[0] 
          : String(params.id))
    : undefined;

  const fetchListing = useCallback(async () => {
    if (!listingId) {
      setError("Invalid listing ID");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/listings/${listingId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch listing`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setListing(data);
      setError(null);
    } catch (err) {
      console.error("Fetch listing error:", err);
      setError(err instanceof Error ? err.message : "Failed to load listing");
      setListing(null);
    } finally {
      setIsLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    if (listingId) {
      fetchListing();
    } else {
      setError("Invalid listing ID");
      setIsLoading(false);
    }
  }, [listingId, fetchListing]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !listingId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("listingId", listingId);
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload photos");
      }

      await fetchListing(); // Refresh listing data
    } catch (err) {
      alert("Failed to upload photos");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveBackground = async (filename: string) => {
    if (!listingId) return;
    
    setIsProcessing(filename);
    try {
      const response = await fetch("/api/bg-remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          filename,
          backgroundColor, // Include background color
        }),
      });

      if (!response.ok) {
        let errorMsg = "Failed to remove background";
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorData.message || errorMsg;
        } catch {
          errorMsg = `HTTP ${response.status}: ${response.statusText || "Failed to remove background"}`;
        }
        throw new Error(errorMsg);
      }

      await fetchListing(); // Refresh listing data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to remove background";
      console.error("Background removal error:", err);
      alert(errorMessage);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleDeletePhoto = async (filename: string) => {
    if (!listingId) return;
    
    if (!confirm("Are you sure you want to delete this photo?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/photos/delete?listingId=${listingId}&filename=${encodeURIComponent(filename)}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to delete photo");
      }

      await fetchListing(); // Refresh listing data
    } catch (err) {
      console.error("Delete photo error:", err);
      alert(`Failed to delete photo: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleExport = async () => {
    if (!listingId) return;
    
    try {
      const response = await fetch(`/api/export?listingId=${listingId}`);
      if (!response.ok) {
        throw new Error("Failed to export");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `listing-${listingId}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to export listing");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading listing...</p>
        </div>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Listing not found"}</p>
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const photos = Array.isArray(listing.photos) ? listing.photos : [];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-800 mb-4"
          >
            ← Back
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                {listing.car.year} {listing.car.make} {listing.car.model}
              </h1>
              {listing.car.notes && (
                <p className="text-gray-600">{listing.car.notes}</p>
              )}
            </div>
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Export ZIP
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleUpload(e.target.files)}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUploading ? "Uploading..." : "Upload Photos"}
                </button>
                {photos.length > 0 && (
                  <button
                    onClick={async () => {
                      const toProcess = photos.filter(
                        (photo) => (photo.status === "uploaded" || photo.status === "failed") && !photo.processedUrl
                      );
                      for (const photo of toProcess) {
                        await handleRemoveBackground(photo.filename);
                      }
                    }}
                    disabled={!!isProcessing}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? "Processing..." : "Remove All Backgrounds"}
                  </button>
                )}
              </div>
              
              {/* Background Color Picker */}
              <div className="flex items-center gap-3 p-3 bg-white rounded-lg border">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                  Background Color:
                </label>
                <div className="flex items-center gap-2 flex-1">
                  {/* Preset Colors */}
                  <button
                    onClick={() => setBackgroundColor("#FFFFFF")}
                    className={`w-8 h-8 rounded border-2 ${
                      backgroundColor === "#FFFFFF" ? "border-blue-600" : "border-gray-300"
                    }`}
                    style={{ backgroundColor: "#FFFFFF" }}
                    title="White"
                  />
                  <button
                    onClick={() => setBackgroundColor("#F3F4F6")}
                    className={`w-8 h-8 rounded border-2 ${
                      backgroundColor === "#F3F4F6" ? "border-blue-600" : "border-gray-300"
                    }`}
                    style={{ backgroundColor: "#F3F4F6" }}
                    title="Light Gray"
                  />
                  <button
                    onClick={() => setBackgroundColor("#000000")}
                    className={`w-8 h-8 rounded border-2 ${
                      backgroundColor === "#000000" ? "border-blue-600" : "border-gray-300"
                    }`}
                    style={{ backgroundColor: "#000000" }}
                    title="Black"
                  />
                  <button
                    onClick={() => setBackgroundColor("#E5E7EB")}
                    className={`w-8 h-8 rounded border-2 ${
                      backgroundColor === "#E5E7EB" ? "border-blue-600" : "border-gray-300"
                    }`}
                    style={{ backgroundColor: "#E5E7EB" }}
                    title="Gray"
                  />
                  
                  {/* Custom Color Picker */}
                  <div className="flex items-center gap-2 ml-2">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-10 h-8 rounded border border-gray-300 cursor-pointer"
                      title="Custom Color"
                    />
                    <input
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => {
                        const color = e.target.value;
                        if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
                          setBackgroundColor(color);
                        }
                      }}
                      className="px-2 py-1 text-sm border rounded w-24 font-mono"
                      placeholder="#FFFFFF"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </div>
              </div>
            </div>
            <PhotoGrid
              photos={photos}
              showComparison={true}
            />
            {photos.length > 0 && (
              <div className="space-y-2">
                {photos.map((photo) => (
                  <div key={photo.filename} className="flex items-center justify-between p-3 bg-white rounded-lg border gap-2">
                    <span className="text-sm truncate flex-1">{photo.filename}</span>
                    <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${
                      photo.status === "processed" ? "bg-green-100 text-green-800" :
                      photo.status === "processing" ? "bg-yellow-100 text-yellow-800" :
                      photo.status === "failed" ? "bg-red-100 text-red-800" :
                      "bg-gray-100 text-gray-800"
                    }`}>
                      {photo.status}
                    </span>
                    <div className="flex items-center gap-2">
                      {(photo.status === "uploaded" || photo.status === "failed") && !photo.processedUrl && (
                        <button
                          onClick={() => handleRemoveBackground(photo.filename)}
                          disabled={isProcessing === photo.filename || !!isProcessing}
                          className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isProcessing === photo.filename ? "Processing..." : photo.status === "failed" ? "Retry" : "Remove BG"}
                        </button>
                      )}
                      <button
                        onClick={() => handleDeletePhoto(photo.filename)}
                        disabled={isProcessing === photo.filename || !!isProcessing}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete photo"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <AdPanel
              listingId={listing.id}
              title={`${listing.car.year} ${listing.car.make} ${listing.car.model}`}
              description={listing.car.notes}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

