import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { readListing, writeListing } from "@/lib/listings";
import { originalsDir, processedDir } from "@/lib/paths";
import { replicate, REMBG_MODEL } from "@/lib/replicate";
import { requireAuth } from "@/lib/apiAuth";

export const runtime = "nodejs";

async function download(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download output: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
}

export async function POST(req: NextRequest) {
  try {
    // 🔐 protect route
    const authErr = requireAuth(req);
    if (authErr) return authErr;

    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { listingId, filename, backgroundColor = "#FFFFFF" } = body;

  if (!listingId || !filename) {
    return NextResponse.json(
      { error: "listingId and filename are required" },
      { status: 400 }
    );
  }

  // Validate background color format (hex color)
  const colorRegex = /^#[0-9A-Fa-f]{6}$/;
  const bgColor = colorRegex.test(backgroundColor) ? backgroundColor : "#FFFFFF";

  let listing;
  try {
    listing = readListing(listingId);
  } catch {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  const photos = Array.isArray(listing.photos) ? listing.photos : [];
  const photo = photos.find((p) => p.filename === filename);

  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

    photo.status = "processing";
    writeListing(listing);

    try {
      // Verify original file exists
      const originalFilePath = path.join(originalsDir(listingId), filename);
      if (!fs.existsSync(originalFilePath)) {
        throw new Error(`Original image file not found: ${filename}`);
      }

      fs.mkdirSync(processedDir(listingId), { recursive: true });

      // Replicate requires a publicly accessible URL - it cannot access localhost
      // For local development, use ngrok or deploy to a public URL
      const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000";
      const isLocalhost = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1");
      
      if (isLocalhost) {
        throw new Error(
          "Replicate API cannot access localhost URLs. " +
          "For local development, please use ngrok to expose your local server publicly, " +
          "or set APP_BASE_URL to a publicly accessible URL. " +
          "Example: npx ngrok http 3000, then set APP_BASE_URL to the ngrok URL."
        );
      }
      
      // Use public URL
      const imageUrl = `${baseUrl}${photo.originalUrl}`;
      console.log("Using public image URL:", imageUrl);
      
      // Verify image URL is accessible
      try {
        const imageCheck = await fetch(imageUrl, { method: "HEAD" });
        if (!imageCheck.ok) {
          // ngrok free tier may require browser visit first
          if (imageCheck.status === 404 && imageUrl.includes("ngrok")) {
            throw new Error(
              `Image URL not accessible (404). ` +
              `If using ngrok free tier, visit ${imageUrl} in your browser first to accept the warning page, then try again.`
            );
          }
          throw new Error(`Image URL not accessible: ${imageUrl} (${imageCheck.status})`);
        }
      } catch (urlError: any) {
        console.error("Image URL check failed:", urlError);
        if (urlError.message.includes("ngrok")) {
          throw urlError; // Re-throw ngrok-specific errors as-is
        }
        throw new Error(
          `Cannot access image at ${imageUrl}: ${urlError.message}. ` +
          "Make sure APP_BASE_URL points to a publicly accessible URL."
        );
      }
      
      const imageInput = imageUrl;

      let output;
      try {
        console.log("Calling Replicate with model:", REMBG_MODEL);
        console.log("Replicate token present:", !!process.env.REPLICATE_API_TOKEN);
        console.log("Replicate token length:", process.env.REPLICATE_API_TOKEN?.length || 0);
        console.log("Image input type:", typeof imageInput);
        if (typeof imageInput === "string") {
          console.log("Image input preview:", imageInput.substring(0, 100) + "...");
        }
        
        // Replicate.run() returns the output directly, but may need to wait for async predictions
        console.log("About to call replicate.run() with model:", REMBG_MODEL);
        console.log("Image input:", typeof imageInput === "string" ? imageInput.substring(0, 150) : imageInput);
        
        try {
          // Use predictions.create() with model owner/name and version separately
          console.log("Creating prediction with Replicate...");
          console.log("Using model:", REMBG_MODEL);
          
          // Extract model owner/name and version from model string (format: owner/model:version)
          const [modelPath, versionHash] = REMBG_MODEL.split(':');
          if (!versionHash || !modelPath) {
            throw new Error(`Invalid model format: ${REMBG_MODEL}. Expected format: owner/model:version`);
          }
          
          console.log("Creating prediction with model:", modelPath, "version:", versionHash);
          const prediction = await replicate.predictions.create({
            model: modelPath, // e.g., "cjwbw/rembg"
            version: versionHash, // e.g., "fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003"
            input: { image: imageInput },
          });
          
          console.log("Prediction created. ID:", prediction.id);
          console.log("Initial status:", prediction.status);
          console.log("Initial output:", prediction.output);
          
          // Wait for prediction to complete
          let currentPrediction = prediction;
          let attempts = 0;
          const maxAttempts = 60; // Wait up to 60 seconds
          
          while (currentPrediction.status !== "succeeded" && currentPrediction.status !== "failed" && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            currentPrediction = await replicate.predictions.get(currentPrediction.id);
            console.log(`Prediction status (attempt ${attempts + 1}):`, currentPrediction.status);
            attempts++;
          }
          
          if (currentPrediction.status === "failed") {
            throw new Error(`Replicate prediction failed: ${currentPrediction.error || "Unknown error"}`);
          }
          
          if (currentPrediction.status !== "succeeded") {
            throw new Error(`Replicate prediction timed out. Status: ${currentPrediction.status}`);
          }
          
          output = currentPrediction.output;
          console.log("Prediction completed successfully");
          console.log("Final output type:", typeof output);
          console.log("Final output:", JSON.stringify(output, null, 2));
        } catch (runError: any) {
          console.error("Replicate API call failed:", runError);
          console.error("Error message:", runError?.message);
          if (runError.response) {
            console.error("Response status:", runError.response.status);
            console.error("Response data:", runError.response.data);
          }
          console.error("Error details:", JSON.stringify(runError, null, 2));
          throw runError;
        }
        
        // Check if output is an error response
        if (output && typeof output === "object" && (output as any).detail) {
          throw new Error(`Replicate API error: ${(output as any).detail} (Status: ${(output as any).status || "unknown"})`);
        }
        
        // Check if output is undefined, null, or empty
        if (output === undefined || output === null) {
          throw new Error("Replicate returned undefined/null. This usually means the API call failed silently. Check your API token and model version.");
        }
        
        // Check if output is empty object (likely an error)
        if (output && typeof output === "object" && !Array.isArray(output) && Object.keys(output).length === 0) {
          throw new Error("Replicate returned empty object. This usually means the model endpoint is incorrect or the request failed. Check your model version.");
        }
        
        // If output is a prediction object, wait for it to complete
        if (output && typeof output === "object" && (output as any).status) {
          console.log("Prediction status:", (output as any).status);
          // The SDK should handle this, but if it doesn't, we might need to poll
          if ((output as any).status !== "succeeded") {
            throw new Error(`Prediction not completed. Status: ${(output as any).status}`);
          }
          output = (output as any).output || (output as any).url || output;
        }
        
        console.log("Replicate call completed. Output type:", typeof output, "value:", JSON.stringify(output).substring(0, 200));
      } catch (replicateError: any) {
        console.error("Replicate API error:", replicateError);
        
        // Handle specific Replicate API errors
        if (replicateError?.status === 402 || replicateError?.response?.status === 402) {
          const errorDetail = replicateError?.response?.data?.detail || replicateError?.detail || 
                            "You have insufficient credit to run this model. Please add credit to your Replicate account.";
          throw new Error(`Replicate API: Payment Required (402). ${errorDetail}`);
        }
        
        if (replicateError?.status === 429 || replicateError?.response?.status === 429) {
          throw new Error("Replicate API: Rate limit exceeded. Please wait a moment and try again.");
        }
        
        const errorMsg = replicateError?.message || replicateError?.response?.data?.detail || "Replicate API error";
        throw new Error(`Replicate API failed: ${errorMsg}`);
      }

      console.log("Replicate output type:", typeof output);
      console.log("Replicate output value:", JSON.stringify(output, null, 2));
      console.log("Replicate output keys:", output && typeof output === "object" ? Object.keys(output) : "N/A");

      let outputUrl: string | null = null;
      
      if (typeof output === "string") {
        outputUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        outputUrl = typeof output[0] === "string" ? output[0] : (output[0] as any)?.url || (output[0] as any)?.image || null;
      } else if (output && typeof output === "object") {
        // Try various possible keys in the output object
        outputUrl = (output as any).url || 
                   (output as any).image || 
                   (output as any).output || 
                   (output as any).output_url ||
                   (output as any).image_url ||
                   null;
        
        // If output is an object with nested structure, try to find URL
        if (!outputUrl && (output as any).output) {
          const nested = (output as any).output;
          outputUrl = typeof nested === "string" ? nested : nested?.url || nested?.image || null;
        }
      }

      if (!outputUrl || typeof outputUrl !== "string") {
        console.error("Failed to extract URL from Replicate output:");
        console.error("  Type:", typeof output);
        console.error("  Value:", JSON.stringify(output, null, 2));
        console.error("  Is array:", Array.isArray(output));
        if (output && typeof output === "object") {
          console.error("  Keys:", Object.keys(output));
        }
        
        throw new Error(
          `Invalid output URL from Replicate. Received: ${JSON.stringify(output)}. ` +
          `Expected a URL string, array of URLs, or object with url/image/output property. ` +
          `Check the server console logs (where npm run dev is running) for detailed output.`
        );
      }

      const outName = filename.replace(/\.(jpg|jpeg|png)$/i, ".png");
      const tempPath = path.join(processedDir(listingId), `temp-${outName}`);
      const destPath = path.join(processedDir(listingId), outName);

      // Download the processed image (transparent PNG) from Replicate
      await download(outputUrl, tempPath);

      // Apply background color using sharp
      try {
        const image = sharp(tempPath);
        const metadata = await image.metadata();
        const width = metadata.width || 1024;
        const height = metadata.height || 1024;

        // Create a background with the selected color and composite the transparent image on top
        await sharp({
          create: {
            width,
            height,
            channels: 3,
            background: bgColor,
          },
        })
          .composite([
            {
              input: await image.toBuffer(),
              blend: "over",
            },
          ])
          .png()
          .toFile(destPath);

        // Remove temporary file
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }

        console.log(`Applied background color ${bgColor} to processed image`);
      } catch (sharpError: any) {
        console.error("Error applying background color:", sharpError);
        // If sharp fails, just use the original transparent image
        if (fs.existsSync(tempPath)) {
          fs.renameSync(tempPath, destPath);
        } else {
          throw new Error("Failed to process image with background color");
        }
      }

      photo.processedUrl = `/uploads/${listingId}/processed/${outName}`;
      photo.status = "processed";
      writeListing(listing);

      return NextResponse.json({
        ok: true,
        processedUrl: photo.processedUrl,
      });
    } catch (err: any) {
      console.error("Background removal error:", err);
      if (photo) {
        photo.status = "failed";
        writeListing(listing);
      }

      return NextResponse.json(
        { 
          error: err?.message || "Background removal failed",
          details: process.env.NODE_ENV === "development" ? err?.stack : undefined
        },
        { status: 500 }
      );
    }
  } catch (outerErr: any) {
    // Catch any unexpected errors outside the main try-catch
    console.error("Unexpected error in bg-remove route:", outerErr);
    return NextResponse.json(
      {
        error: outerErr?.message || "Internal server error",
        details: process.env.NODE_ENV === "development" ? outerErr?.stack : undefined
      },
      { status: 500 }
    );
  }
}

