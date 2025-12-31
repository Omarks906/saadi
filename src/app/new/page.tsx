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
          {(["make","model","transmission","fuel"] as const).map((k) => (
            <input key={k} className="border rounded-xl p-3" placeholder={k}
              value={(car as any)[k]} onChange={(e)=>setCar({...car,[k]:e.target.value})}/>
          ))}
          <input className="border rounded-xl p-3" type="number" placeholder="year"
            value={car.year} onChange={(e)=>setCar({...car,year:Number(e.target.value)})}/>
          <input className="border rounded-xl p-3" type="number" placeholder="Mileage (km)"
            value={car.mileageKm} onChange={(e)=>setCar({...car,mileageKm:Number(e.target.value)})}/>
          <input className="border rounded-xl p-3" type="number" placeholder="price"
            value={car.price} onChange={(e)=>setCar({...car,price:Number(e.target.value)})}/>
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-2 gap-3">
          <input className="border rounded-xl p-3" placeholder="Exterior color"
            value={car.exteriorColor} onChange={(e)=>setCar({...car,exteriorColor:e.target.value})}/>
          <input className="border rounded-xl p-3" placeholder="Interior color"
            value={car.interiorColor} onChange={(e)=>setCar({...car,interiorColor:e.target.value})}/>
          <input className="border rounded-xl p-3" placeholder="Trim"
            value={car.trim} onChange={(e)=>setCar({...car,trim:e.target.value})}/>
          <input className="border rounded-xl p-3" placeholder="Condition"
            value={car.condition} onChange={(e)=>setCar({...car,condition:e.target.value})}/>
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

