"use client";

import { useState } from "react";

// Predefined options for dropdowns - Popular brands in Sweden/Europe
const CAR_MAKES = [
  "Alfa Romeo", "Audi", "BMW", "Citroën", "Dacia", "Fiat", "Ford", "Honda",
  "Hyundai", "Jaguar", "Jeep", "Kia", "Land Rover", "Lexus", "Mazda", "Mercedes-Benz",
  "Mini", "Mitsubishi", "Nissan", "Opel", "Peugeot", "Porsche", "Renault", "Seat",
  "Skoda", "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo"
].sort();

// Car models by make (popular models in Sweden/Europe)
const CAR_MODELS: { [key: string]: string[] } = {
  "Alfa Romeo": ["Giulia", "Stelvio", "Tonale", "4C", "Giulietta"],
  "Audi": ["A3", "A4", "A5", "A6", "A7", "A8", "Q3", "Q5", "Q7", "Q8", "e-tron", "TT"],
  "BMW": ["1 Series", "2 Series", "3 Series", "4 Series", "5 Series", "6 Series", "7 Series", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "i3", "i4", "iX"],
  "Citroën": ["C3", "C4", "C5", "Berlingo", "Cactus", "C4 Picasso"],
  "Dacia": ["Sandero", "Duster", "Logan", "Lodgy", "Jogger"],
  "Fiat": ["500", "Panda", "Tipo", "Punto", "500X", "500L"],
  "Ford": ["Fiesta", "Focus", "Mondeo", "Kuga", "Edge", "Explorer", "Mustang", "Puma", "S-Max", "Galaxy"],
  "Honda": ["Civic", "Accord", "CR-V", "HR-V", "Pilot", "Jazz", "e"],
  "Hyundai": ["i10", "i20", "i30", "i40", "Kona", "Tucson", "Santa Fe", "Ioniq", "Ioniq 5", "Ioniq 6"],
  "Jaguar": ["XE", "XF", "XJ", "F-Pace", "E-Pace", "I-Pace"],
  "Jeep": ["Renegade", "Compass", "Cherokee", "Grand Cherokee", "Wrangler"],
  "Kia": ["Picanto", "Rio", "Ceed", "Optima", "Sportage", "Sorento", "Niro", "EV6", "EV9"],
  "Land Rover": ["Discovery", "Discovery Sport", "Range Rover", "Range Rover Sport", "Range Rover Evoque", "Defender"],
  "Lexus": ["IS", "ES", "GS", "LS", "NX", "RX", "UX", "LC"],
  "Mazda": ["2", "3", "6", "CX-3", "CX-5", "CX-30", "CX-60", "MX-5"],
  "Mercedes-Benz": ["A-Class", "B-Class", "C-Class", "E-Class", "S-Class", "CLA", "CLS", "GLA", "GLB", "GLC", "GLE", "GLS", "EQC", "EQS"],
  "Mini": ["Cooper", "Countryman", "Clubman", "Paceman"],
  "Mitsubishi": ["Outlander", "ASX", "Eclipse Cross", "L200"],
  "Nissan": ["Micra", "Leaf", "Juke", "Qashqai", "X-Trail", "Pathfinder", "Navara"],
  "Opel": ["Corsa", "Astra", "Insignia", "Crossland", "Grandland", "Mokka"],
  "Peugeot": ["108", "208", "308", "508", "2008", "3008", "5008", "Partner"],
  "Porsche": ["911", "Boxster", "Cayman", "Panamera", "Macan", "Cayenne", "Taycan"],
  "Renault": ["Clio", "Megane", "Scenic", "Kadjar", "Captur", "Koleos", "Zoe", "Twingo"],
  "Seat": ["Ibiza", "Leon", "Ateca", "Tarraco", "Arona", "Formentor"],
  "Skoda": ["Fabia", "Octavia", "Superb", "Kodiaq", "Karoq", "Kamiq", "Enyaq"],
  "Subaru": ["Impreza", "Legacy", "Outback", "Forester", "XV", "BRZ", "Ascent"],
  "Suzuki": ["Swift", "Vitara", "S-Cross", "Jimny", "Ignis"],
  "Tesla": ["Model S", "Model 3", "Model X", "Model Y"],
  "Toyota": ["Aygo", "Yaris", "Corolla", "Camry", "Prius", "RAV4", "Highlander", "Land Cruiser", "C-HR", "bZ4X"],
  "Volkswagen": ["Polo", "Golf", "Passat", "Arteon", "Tiguan", "Touareg", "T-Cross", "T-Roc", "ID.3", "ID.4", "ID.Buzz"],
  "Volvo": ["V40", "V60", "V90", "XC40", "XC60", "XC90", "C30", "C70", "S60", "S90", "EX30", "EX90"],
};

const TRANSMISSIONS = ["Automatic", "Manual", "CVT", "Dual Clutch", "Semi-Automatic"];

const FUEL_TYPES = ["Gasoline", "Diesel", "Electric", "Hybrid", "Plug-in Hybrid", "CNG", "LPG"];

const CONDITIONS = ["Excellent", "Very Good", "Good", "Fair", "Poor"];

const EXTERIOR_COLORS = [
  "Black", "White", "Silver", "Gray", "Blue", "Red", "Green", "Brown", "Beige", "Gold", "Orange", "Yellow", "Other"
];

const INTERIOR_COLORS = [
  "Black", "Beige", "Gray", "Brown", "White", "Red", "Blue", "Other"
];

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
    registrationNumber: "",
    vin: "",
    engineSize: "",
    power: 0,
    doors: 0,
    seats: 0,
  });
  
  const [featureInput, setFeatureInput] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

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

  const lookupCarData = async () => {
    if (!car.registrationNumber && !car.vin) {
      setLookupError("Please enter a registration number or VIN");
      return;
    }

    setIsLookingUp(true);
    setLookupError(null);

    try {
      const response = await fetch("/api/car-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationNumber: car.registrationNumber || undefined,
          vin: car.vin || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to lookup car data");
      }

      // If we get car data, populate the form
      if (data.data) {
        const carData = data.data;
        const hasData = carData.make || carData.model || carData.year;
        
        if (hasData) {
          // Real data found - populate form (only update fields that have values)
          setCar({
            ...car,
            make: carData.make || car.make,
            model: carData.model || car.model,
            year: carData.year || car.year,
            mileageKm: carData.mileageKm || car.mileageKm,
            transmission: carData.transmission || car.transmission,
            fuel: carData.fuel || car.fuel,
            engineSize: carData.engineSize || car.engineSize,
            power: carData.power || car.power,
            doors: carData.doors || car.doors,
            seats: carData.seats || car.seats,
            exteriorColor: carData.exteriorColor || car.exteriorColor,
            interiorColor: carData.interiorColor || car.interiorColor,
            trim: carData.trim || car.trim,
          });
          
          // Show success message
          const successMsg = data.message || "Car data found and populated!";
          setLookupError(null);
          
          // Show success message briefly (optional - you could add a success state)
          console.log("Lookup success:", successMsg, carData);
        } else {
          // No data found - show info message
          setLookupError(data.note || "No vehicle data found. Please enter car details manually.");
        }
      } else {
        setLookupError("No data returned from lookup service.");
      }
    } catch (err) {
      console.error("Lookup error:", err);
      setLookupError(err instanceof Error ? err.message : "Failed to lookup car data");
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">New listing</h1>
        
        {/* Registration Number Lookup */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-blue-900">Quick Lookup</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-gray-600">Registration Number</label>
              <input className="border rounded-xl p-3 w-full" placeholder="e.g., ABC123"
                value={car.registrationNumber} onChange={(e)=>setCar({...car,registrationNumber:e.target.value.toUpperCase()})}
                maxLength={6}/>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-gray-600">
                VIN (Optional) 
                <span className="text-blue-600 ml-1 cursor-help" title="17-character Vehicle Identification Number. Find it on dashboard (visible through windshield), registration documents, or driver's door jamb.">
                  ℹ️
                </span>
              </label>
              <input className="border rounded-xl p-3 w-full" placeholder="17-character VIN (e.g., YV1TS61P8K1234567)"
                value={car.vin} onChange={(e)=>setCar({...car,vin:e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})}
                maxLength={17}/>
              <p className="text-xs text-gray-500">
                💡 Tip: VIN is on dashboard (visible through windshield), registration documents, or door jamb. 
                <a href="/HOW_TO_FIND_VIN.md" target="_blank" className="text-blue-600 hover:underline ml-1">
                  Learn more
                </a>
              </p>
            </div>
          </div>
          <button 
            onClick={lookupCarData}
            disabled={isLookingUp || (!car.registrationNumber && !car.vin)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {isLookingUp ? "Looking up..." : "Lookup Car Data"}
          </button>
          {lookupError && (
            <div className={`text-sm p-2 rounded ${
              lookupError.includes("API integration") || lookupError.includes("needed") || lookupError.includes("ready")
                ? "text-blue-600 bg-blue-50 border border-blue-200"
                : "text-red-600 bg-red-50 border border-red-200"
            }`}>
              {lookupError}
            </div>
          )}
          <p className="text-xs text-gray-600">
            💡 <strong>Best results:</strong> Enter a VIN (17 characters) for real vehicle data. 
            Registration number lookup requires car.info API integration. 
            VIN is found on dashboard (visible through windshield), registration documents, or door jamb.
          </p>
        </div>
        
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Make</label>
            <select className="border rounded-xl p-3 w-full" 
              value={car.make} onChange={(e)=>{
                setCar({...car, make: e.target.value, model: ""}); // Reset model when make changes
              }}>
              <option value="">Select make</option>
              {CAR_MAKES.map(make => (
                <option key={make} value={make}>{make}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Model</label>
            {car.make && CAR_MODELS[car.make] && CAR_MODELS[car.make].length > 0 ? (
              <select className="border rounded-xl p-3 w-full" 
                value={car.model} onChange={(e)=>setCar({...car,model:e.target.value})}>
                <option value="">Select model</option>
                {CAR_MODELS[car.make].map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            ) : (
              <input className="border rounded-xl p-3 w-full" placeholder={car.make ? "Enter model name" : "e.g., Corolla"}
                value={car.model} onChange={(e)=>setCar({...car,model:e.target.value})}/>
            )}
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
            <select className="border rounded-xl p-3 w-full" 
              value={car.transmission} onChange={(e)=>setCar({...car,transmission:e.target.value})}>
              <option value="">Select transmission</option>
              {TRANSMISSIONS.map(trans => (
                <option key={trans} value={trans}>{trans}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Fuel</label>
            <select className="border rounded-xl p-3 w-full" 
              value={car.fuel} onChange={(e)=>setCar({...car,fuel:e.target.value})}>
              <option value="">Select fuel type</option>
              {FUEL_TYPES.map(fuel => (
                <option key={fuel} value={fuel}>{fuel}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Price (SEK)</label>
            <input className="border rounded-xl p-3 w-full" type="number" placeholder="e.g., 150000"
              value={car.price || ""} onChange={(e)=>setCar({...car,price:Number(e.target.value) || 0})}/>
          </div>
        </div>

        {/* Additional Technical Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Engine Size</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., 2.0L, 1.6 TDI"
              value={car.engineSize} onChange={(e)=>setCar({...car,engineSize:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Power (hk)</label>
            <input className="border rounded-xl p-3 w-full" type="number" placeholder="e.g., 150"
              value={car.power || ""} onChange={(e)=>setCar({...car,power:Number(e.target.value) || 0})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Doors</label>
            <input className="border rounded-xl p-3 w-full" type="number" placeholder="e.g., 5"
              value={car.doors || ""} onChange={(e)=>setCar({...car,doors:Number(e.target.value) || 0})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Seats</label>
            <input className="border rounded-xl p-3 w-full" type="number" placeholder="e.g., 5"
              value={car.seats || ""} onChange={(e)=>setCar({...car,seats:Number(e.target.value) || 0})}/>
          </div>
        </div>

        {/* Additional Technical Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Engine Size</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., 2.0L, 1.6 TDI"
              value={car.engineSize} onChange={(e)=>setCar({...car,engineSize:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Power (hk)</label>
            <input className="border rounded-xl p-3 w-full" type="number" placeholder="e.g., 150"
              value={car.power || ""} onChange={(e)=>setCar({...car,power:Number(e.target.value) || 0})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Doors</label>
            <input className="border rounded-xl p-3 w-full" type="number" placeholder="e.g., 5"
              value={car.doors || ""} onChange={(e)=>setCar({...car,doors:Number(e.target.value) || 0})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Seats</label>
            <input className="border rounded-xl p-3 w-full" type="number" placeholder="e.g., 5"
              value={car.seats || ""} onChange={(e)=>setCar({...car,seats:Number(e.target.value) || 0})}/>
          </div>
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Exterior Color</label>
            <select className="border rounded-xl p-3 w-full" 
              value={car.exteriorColor} onChange={(e)=>setCar({...car,exteriorColor:e.target.value})}>
              <option value="">Select color</option>
              {EXTERIOR_COLORS.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Interior Color</label>
            <select className="border rounded-xl p-3 w-full" 
              value={car.interiorColor} onChange={(e)=>setCar({...car,interiorColor:e.target.value})}>
              <option value="">Select color</option>
              {INTERIOR_COLORS.map(color => (
                <option key={color} value={color}>{color}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Trim</label>
            <input className="border rounded-xl p-3 w-full" placeholder="e.g., SE, LE, XLE"
              value={car.trim} onChange={(e)=>setCar({...car,trim:e.target.value})}/>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Condition</label>
            <select className="border rounded-xl p-3 w-full" 
              value={car.condition} onChange={(e)=>setCar({...car,condition:e.target.value})}>
              <option value="">Select condition</option>
              {CONDITIONS.map(condition => (
                <option key={condition} value={condition}>{condition}</option>
              ))}
            </select>
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

