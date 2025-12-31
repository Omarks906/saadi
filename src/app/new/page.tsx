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
    features: [] as string[],
    exteriorColor: "",
    interiorColor: "",
    trim: "",
    fwd: false,
    condition: "",
  });
  
  const [featureInput, setFeatureInput] = useState("");

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

  const addFeature = () => {
    if (featureInput.trim()) {
      setCar({ ...car, features: [...car.features, featureInput.trim()] });
      setFeatureInput("");
    }
  };

  const removeFeature = (index: number) => {
    setCar({ ...car, features: car.features.filter((_, i) => i !== index) });
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">New listing</h1>
        
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Make</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., Toyota"
              value={car.make} onChange={(e)=>setCar({...car,make:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Model</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., Corolla"
              value={car.model} onChange={(e)=>setCar({...car,model:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Year</label>
            <input className="border rounded-xl p-3 w-full" type="number" placeholder="e.g., 2020"
              value={car.year || ""} onChange={(e)=>setCar({...car,year:Number(e.target.value) || 0})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Mileage (km)</label>
            <input className="border rounded-xl p-3 w-full" type="number" placeholder="e.g., 50000"
              value={car.mileageKm || ""} onChange={(e)=>setCar({...car,mileageKm:Number(e.target.value) || 0})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Transmission</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., Automatic, Manual"
              value={car.transmission} onChange={(e)=>setCar({...car,transmission:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Fuel</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., Gasoline, Diesel, Electric"
              value={car.fuel} onChange={(e)=>setCar({...car,fuel:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Price (SEK)</label>
            <input className="border rounded-xl p-3 w-full" type="number" placeholder="e.g., 150000"
              value={car.price || ""} onChange={(e)=>setCar({...car,price:Number(e.target.value) || 0})}/>
          </div>
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Exterior Color</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., Silver, Black"
              value={car.exteriorColor} onChange={(e)=>setCar({...car,exteriorColor:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Interior Color</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., Black, Beige"
              value={car.interiorColor} onChange={(e)=>setCar({...car,interiorColor:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Trim</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., SE, LE, XLE"
              value={car.trim} onChange={(e)=>setCar({...car,trim:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Condition</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., Excellent, Good, Fair"
              value={car.condition} onChange={(e)=>setCar({...car,condition:e.target.value})}/>
          </div>
        </div>

        {/* FWD Checkbox */}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="fwd" checked={car.fwd}
            onChange={(e)=>setCar({...car,fwd:e.target.checked})}
            className="w-4 h-4"/>
          <label htmlFor="fwd" className="text-sm">FWD (Front Wheel Drive)</label>
        </div>

        {/* Features */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Features</label>
          <div className="flex gap-2">
            <input className="border rounded-xl p-3 flex-1" placeholder="Add feature"
              value={featureInput} onChange={(e)=>setFeatureInput(e.target.value)}
              onKeyPress={(e)=>e.key==="Enter" && addFeature()}/>
            <button onClick={addFeature} className="px-4 py-2 bg-gray-200 rounded-xl hover:bg-gray-300">
              Add
            </button>
          </div>
          {car.features.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {car.features.map((feature, idx) => (
                <span key={idx} className="bg-gray-100 px-3 py-1 rounded-lg text-sm flex items-center gap-2">
                  {feature}
                  <button onClick={()=>removeFeature(idx)} className="text-red-500 hover:text-red-700">×</button>
                </span>
              ))}
            </div>
          )}
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

