import fs from "fs";
import path from "path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOADS_DIR = path.join(process.cwd(), "public", "uploads");

export function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function listingPath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

export function listingUploadDir(id: string) {
  return path.join(UPLOADS_DIR, id);
}

export function originalsDir(id: string) {
  return path.join(listingUploadDir(id), "original");
}

export function processedDir(id: string) {
  return path.join(listingUploadDir(id), "processed");
}

