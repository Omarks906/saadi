import { readListing, writeListing, createListing, type Listing } from "./storage";
import { readdir } from "fs/promises";
import { DATA_DIR } from "./paths";
import { existsSync } from "fs";

export type { Listing };

/**
 * Get all listings
 */
export async function getListings(): Promise<Listing[]> {
  if (!existsSync(DATA_DIR)) {
    return [];
  }
  
  const files = await readdir(DATA_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  
  const listings: Listing[] = [];
  for (const file of jsonFiles) {
    try {
      const id = file.replace(".json", "");
      const listing = readListing(id);
      listings.push(listing);
    } catch (error) {
      console.error(`Error reading listing file ${file}:`, error);
    }
  }
  
  return listings.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Get a single listing
 */
export function getListing(id: string): Listing | null {
  try {
    return readListing(id);
  } catch (error) {
    console.error(`Error reading listing ${id}:`, error);
    return null;
  }
}

/**
 * Update a listing
 */
export function updateListing(id: string, updates: Partial<Listing>): Listing | null {
  try {
    const listing = readListing(id);
    const updated: Listing = {
      ...listing,
      ...updates,
    };
    writeListing(updated);
    return updated;
  } catch (error) {
    console.error(`Error updating listing ${id}:`, error);
    return null;
  }
}

/**
 * Delete a listing
 */
export function deleteListing(id: string): boolean {
  try {
    const { listingPath } = require("./paths");
    const fs = require("fs");
    const filePath = listingPath(id);
    
    if (!existsSync(filePath)) {
      return false;
    }
    
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error(`Error deleting listing ${id}:`, error);
    return false;
  }
}

/**
 * Validate car listing data
 */
export function validateListing(data: Partial<{ car: Listing["car"] }>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.car) {
    errors.push("Car information is required");
    return { valid: false, errors };
  }

  if (!data.car.make || data.car.make.trim().length === 0) {
    errors.push("Car make is required");
  }

  if (!data.car.model || data.car.model.trim().length === 0) {
    errors.push("Car model is required");
  }

  if (!data.car.year || data.car.year < 1900 || data.car.year > new Date().getFullYear() + 1) {
    errors.push("Valid car year is required");
  }

  if (!data.car.mileageKm || data.car.mileageKm < 0) {
    errors.push("Valid mileage is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export { createListing, readListing, writeListing };

