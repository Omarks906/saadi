"use client";

import { useState, useRef } from "react";

interface ProcessedImage {
  filename: string;
  originalUrl: string;
  processedUrl: string | null;
  status: "pending" | "processing" | "completed" | "error";
  error?: string;
}

export default function ImageProcessor() {
  const [listingId] = useState(() => `listing-${Date.now()}`);
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: ProcessedImage[] = Array.from(files).map((file) => ({
      filename: file.name,
      originalUrl: URL.createObjectURL(file),
      processedUrl: null,
      status: "pending" as const,
    }));

    setImages((prev) => [...prev, ...newImages]);
  };

  const processImage = async (image: ProcessedImage, index: number) => {
    try {
      setImages((prev) =>
        prev.map((img, i) =>
          i === index ? { ...img, status: "processing" } : img
        )
      );

      const response = await fetch("/api/bg-remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          listingId,
          filename: image.filename,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to process image");
      }

      const result = await response.json();

      setImages((prev) =>
        prev.map((img, i) =>
          i === index
            ? {
                ...img,
                status: "completed",
                processedUrl: result.processedUrl,
              }
            : img
        )
      );
    } catch (error) {
      setImages((prev) =>
        prev.map((img, i) =>
          i === index
            ? {
                ...img,
                status: "error",
                error: error instanceof Error ? error.message : "Unknown error",
              }
            : img
        )
      );
    }
  };

  const processBatch = async () => {
    setIsProcessing(true);
    setCurrentIndex(0);

    for (let i = 0; i < images.length; i++) {
      if (images[i].status === "pending") {
        setCurrentIndex(i);
        await processImage(images[i], i);
      }
    }

    setIsProcessing(false);
  };

  const getProgress = () => {
    const completed = images.filter((img) => img.status === "completed").length;
    const total = images.length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">Image Background Removal</h1>
        <div className="flex gap-4 items-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            disabled={isProcessing}
          >
            Select Images
          </button>
          {images.length > 0 && (
            <button
              onClick={processBatch}
              disabled={isProcessing}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? "Processing..." : "Process All"}
            </button>
          )}
          {images.length > 0 && (
            <div className="ml-auto text-sm text-gray-600">
              Progress: {getProgress()}% ({images.filter((img) => img.status === "completed").length}/{images.length})
            </div>
          )}
        </div>
      </div>

      {isProcessing && (
        <div className="mb-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm">
              Processing: {images[currentIndex]?.filename} ({currentIndex + 1}/{images.length})
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {images.map((image, index) => (
          <div
            key={index}
            className="border rounded-lg p-4 bg-white shadow-sm"
          >
            <div className="mb-2 text-sm font-medium truncate">{image.filename}</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <div className="text-xs text-gray-500 mb-1">Before</div>
                <div className="relative aspect-square bg-gray-100 rounded overflow-hidden">
                  <img
                    src={image.originalUrl}
                    alt="Original"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">After</div>
                <div className="relative aspect-square bg-gray-100 rounded overflow-hidden">
                  {image.status === "processing" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  {image.status === "completed" && image.processedUrl && (
                    <img
                      src={image.processedUrl}
                      alt="Processed"
                      className="w-full h-full object-contain"
                    />
                  )}
                  {image.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600 text-xs p-2 text-center">
                      Error: {image.error}
                    </div>
                  )}
                  {image.status === "pending" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400 text-xs">
                      Pending
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 capitalize">{image.status}</div>
          </div>
        ))}
      </div>

      {images.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          Select images to get started
        </div>
      )}
    </div>
  );
}

