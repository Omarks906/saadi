import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const filePath = join(process.cwd(), "public", "uploads", ...resolvedParams.path);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const file = await readFile(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase();
    
    let contentType = "application/octet-stream";
    if (ext === "png") contentType = "image/png";
    if (ext === "jpg" || ext === "jpeg") contentType = "image/jpeg";
    if (ext === "gif") contentType = "image/gif";
    if (ext === "webp") contentType = "image/webp";

    return new NextResponse(file, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Failed to serve file" },
      { status: 500 }
    );
  }
}

