"use client";

import { useState } from "react";

export default function NewListingPage() {
  const [car, setCar] = useState({
    make: "",
    model: "",
    year: 2020,
    mileageKm: 0,
    transmission: "",
    fuel: "",
    price: 0,
    notes: "",
  });

  async function create() {
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ car }),
      });
      
      if (!res.ok) {
        let errorMessage = "Unknown error";
        try {
          const error = await res.json();
          errorMessage = error.error || error.message || `HTTP ${res.status}`;
        } catch {
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        alert(`Failed to create listing: ${errorMessage}`);
        return;
      }
      
      const listing = await res.json();
      if (listing.id) {
        window.location.href = `/listing/${listing.id}`;
      } else {
        alert("Failed to create listing: No ID returned");
      }
    } catch (err) {
      console.error("Create listing error:", err);
      alert(`Failed to create listing: ${err instanceof Error ? err.message : "Network error"}`);
    }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">New listing</h1>
        <div className="grid grid-cols-2 gap-3">
          {(["make","model","transmission","fuel"] as const).map((k) => (
            <input key={k} className="border rounded-xl p-3" placeholder={k}
              value={(car as any)[k]} onChange={(e)=>setCar({...car,[k]:e.target.value})}/>
          ))}
          <input className="border rounded-xl p-3" type="number" placeholder="year"
            value={car.year} onChange={(e)=>setCar({...car,year:Number(e.target.value)})}/>
          <input className="border rounded-xl p-3" type="number" placeholder="mileageKm"
            value={car.mileageKm} onChange={(e)=>setCar({...car,mileageKm:Number(e.target.value)})}/>
          <input className="border rounded-xl p-3" type="number" placeholder="price"
            value={car.price} onChange={(e)=>setCar({...car,price:Number(e.target.value)})}/>
        </div>
        <textarea className="border rounded-xl p-3 w-full" rows={4} placeholder="notes (optional)"
          value={car.notes} onChange={(e)=>setCar({...car,notes:e.target.value})}/>
        <button onClick={create} className="rounded-xl bg-black text-white px-5 py-3">
          Create listing
        </button>
      </div>
    </main>
  );
}

