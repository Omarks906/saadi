"use client";

import { useState } from "react";

type Photo = {
  filename: string;
  originalUrl: string;
  processedUrl?: string;
  status: "uploaded" | "processing" | "processed" | "failed";
};

interface PhotoGridProps {
  photos: Photo[] | string[];
  processedPhotos?: string[];
  showComparison?: boolean;
  onPhotoClick?: (photo: string, index: number) => void;
}

export default function PhotoGrid({
  photos,
  processedPhotos = [],
  showComparison = false,
  onPhotoClick,
}: PhotoGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showProcessed, setShowProcessed] = useState(false);

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No photos uploaded yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showComparison && processedPhotos.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => setShowProcessed(false)}
            className={`px-4 py-2 rounded ${
              !showProcessed
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setShowProcessed(true)}
            className={`px-4 py-2 rounded ${
              showProcessed
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Processed
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo, index) => {
          const p: Photo = typeof photo === "string" 
            ? { filename: `photo-${index}`, originalUrl: photo, processedUrl: processedPhotos?.[index], status: "uploaded" }
            : photo as Photo;
          
          const displayPhoto = showProcessed && p.processedUrl
            ? p.processedUrl
            : p.originalUrl;

          return (
            <div
              key={index}
              className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 ${
                selectedIndex === index ? "border-blue-500" : "border-transparent"
              }`}
              onClick={() => {
                setSelectedIndex(index);
                onPhotoClick?.(displayPhoto, index);
              }}
            >
              {showProcessed && p.processedUrl ? (
                <img src={p.processedUrl} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
              ) : (
                <img src={p.originalUrl} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
              )}
              {showComparison && p.processedUrl && (
                <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                  {showProcessed ? "Processed" : "Original"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

