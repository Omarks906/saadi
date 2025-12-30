"use client";

import { useState, useRef, useCallback } from "react";

interface PhotoUploaderProps {
  listingId: string;
  onUploadComplete?: (photos: string[]) => void;
  onProcessingComplete?: (processedPhotos: string[]) => void;
  multiple?: boolean;
}

export default function PhotoUploader({
  listingId,
  onUploadComplete,
  onProcessingComplete,
  multiple = true,
}: PhotoUploaderProps) {
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [processedPhotos, setProcessedPhotos] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      setIsUploading(true);
      const fileArray = Array.from(files);
      const uploaded: string[] = [];
      const processed: string[] = [];

      try {
        // Upload all files at once
        const formData = new FormData();
        formData.append("listingId", listingId);
        for (const file of fileArray) {
          formData.append("files", file);
        }

        setProgress(50);

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload files");
        }

        const uploadResult = await uploadResponse.json();
        // Extract uploaded photo URLs from the listing response
        if (uploadResult.photos && Array.isArray(uploadResult.photos)) {
          uploadResult.photos.forEach((photo: any) => {
            if (photo.originalUrl) {
              uploaded.push(photo.originalUrl);
            }
          });
        }

        // Process with background removal
        setIsProcessing(true);
        if (uploadResult.photos && Array.isArray(uploadResult.photos)) {
          for (let i = 0; i < uploadResult.photos.length; i++) {
            const photo = uploadResult.photos[i];
            setProgress(50 + ((i + 1) / uploadResult.photos.length) * 50);

            const processResponse = await fetch("/api/bg-remove", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                listingId,
                filename: photo.filename,
              }),
            });

            if (processResponse.ok) {
              const processResult = await processResponse.json();
              processed.push(processResult.processedUrl);
            }
          }
        }

        setUploadedPhotos((prev) => [...prev, ...uploaded]);
        setProcessedPhotos((prev) => [...prev, ...processed]);
        onUploadComplete?.(uploaded);
        onProcessingComplete?.(processed);
      } catch (error) {
        console.error("Upload error:", error);
        alert("Failed to upload photos");
      } finally {
        setIsUploading(false);
        setIsProcessing(false);
        setProgress(0);
      }
    },
    [listingId, onUploadComplete, onProcessingComplete]
  );

  return (
    <div className="space-y-4">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept="image/*"
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading || isProcessing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isUploading || isProcessing
            ? `${isProcessing ? "Processing" : "Uploading"}... ${Math.round(progress)}%`
            : "Upload Photos"}
        </button>
      </div>

      {(isUploading || isProcessing) && (
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {uploadedPhotos.length > 0 && (
        <div className="text-sm text-gray-600">
          {uploadedPhotos.length} photo(s) uploaded
        </div>
      )}
    </div>
  );
}

