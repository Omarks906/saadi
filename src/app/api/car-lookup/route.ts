import { NextRequest, NextResponse } from "next/server";

/**
 * Car data lookup API
 * Supports lookup by registration number or VIN
 * Can integrate with car.info or alternative APIs
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { registrationNumber, vin } = body;

    if (!registrationNumber && !vin) {
      return NextResponse.json(
        { error: "Registration number or VIN is required" },
        { status: 400 }
      );
    }

    // TODO: Integrate with car.info API when available
    // For now, we'll use a mock structure that matches car.info's data format
    
    // Alternative: Use CarAPI or similar service
    // Example: https://carapi.app/api/docs
    
    // Try to integrate with a real API if available
    // For Swedish registration numbers, we could use:
    // 1. car.info API (when available)
    // 2. Transportstyrelsen (Swedish Transport Agency) - may require API access
    // 3. Alternative APIs
    
    // Demo mode: Return sample data for testing
    // Remove this when real API is integrated
    const DEMO_MODE = process.env.CAR_LOOKUP_DEMO_MODE !== "false"; // Default to true for demo
    
    let carData: any = {
      registrationNumber: registrationNumber || null,
      vin: vin || null,
      make: "",
      model: "",
      year: null,
      mileageKm: null,
      transmission: "",
      fuel: "",
      engineSize: "",
      power: null,
      doors: null,
      seats: null,
      exteriorColor: "",
      interiorColor: "",
      trim: "",
    };

    // Step 1: Try VIN decoder (FREE - NHTSA API)
    // This works for many international brands including Volvo, BMW, Toyota, etc.
    if (vin && vin.length === 17) {
      try {
        const vinResponse = await fetch(
          `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`,
          { next: { revalidate: 3600 } } // Cache for 1 hour
        );
        const vinData = await vinResponse.json();
        
        if (vinData.Results && vinData.Results.length > 0) {
          const results = vinData.Results;
          
          // Extract data from NHTSA response
          const getValue = (variable: string) => {
            const item = results.find((r: any) => r.Variable === variable);
            return item?.Value && item.Value !== "Not Applicable" ? item.Value : null;
          };
          
          carData = {
            ...carData,
            make: getValue("Make") || carData.make,
            model: getValue("Model") || carData.model,
            year: getValue("Model Year") ? parseInt(getValue("Model Year")) : carData.year,
            engineSize: getValue("Displacement (L)") ? `${getValue("Displacement (L)")}L` : carData.engineSize,
            transmission: getValue("Transmission Style") || carData.transmission,
            fuel: getValue("Fuel Type - Primary") || carData.fuel,
            doors: getValue("Doors") ? parseInt(getValue("Doors")) : carData.doors,
            seats: getValue("Seats") ? parseInt(getValue("Seats")) : carData.seats,
            trim: getValue("Trim") || carData.trim,
          };
        }
      } catch (vinError) {
        console.error("VIN decode error:", vinError);
        // Continue to demo mode or other sources
      }
    }

    // Step 2: Try car.info API if available (for Swedish registration numbers)
    if (process.env.CAR_INFO_API_KEY && registrationNumber) {
      try {
        // TODO: Replace with actual car.info API endpoint when available
        // const carInfoResponse = await fetch(
        //   `https://api.car.info/v1/vehicles/${registrationNumber}`,
        //   { headers: { 'Authorization': `Bearer ${process.env.CAR_INFO_API_KEY}` } }
        // );
        // const carInfoData = await carInfoResponse.json();
        // Merge carInfoData with carData
      } catch (carInfoError) {
        console.error("car.info API error:", carInfoError);
      }
    }

    // Step 3: Demo data for testing (only if no real data found)
    // Remove this when real API is fully integrated
    const hasRealData = carData.make || carData.model || carData.year;
    
    if (DEMO_MODE && registrationNumber && !hasRealData) {
      // Return sample data based on registration number pattern
      const regUpper = registrationNumber.toUpperCase();
      
      // Sample data for demonstration
      carData = {
        registrationNumber: registrationNumber,
        vin: vin || "DEMO1234567890123",
        make: "Volvo",
        model: "XC60",
        year: 2020,
        mileageKm: 45000,
        transmission: "Automatic",
        fuel: "Diesel",
        engineSize: "2.0L",
        power: 190,
        doors: 5,
        seats: 5,
        exteriorColor: "Silver",
        interiorColor: "Black",
        trim: "Momentum",
      };
      
      // Adjust based on registration number for variety
      if (regUpper.startsWith("LXR") || regUpper.startsWith("ABC")) {
        carData.make = "Volvo";
        carData.model = "XC60";
      } else if (regUpper.startsWith("XYZ") || regUpper.startsWith("DEF")) {
        carData.make = "BMW";
        carData.model = "320d";
        carData.fuel = "Diesel";
        carData.transmission = "Automatic";
      } else if (regUpper.startsWith("GHI") || regUpper.startsWith("JKL")) {
        carData.make = "Toyota";
        carData.model = "Corolla";
        carData.fuel = "Hybrid";
        carData.transmission = "CVT";
      }
    }

    // TODO: Replace with actual API call when car.info API is available
    // Example integration:
    /*
    if (process.env.CAR_INFO_API_KEY) {
      const response = await fetch(`https://api.car.info/v1/vehicles/${registrationNumber}`, {
        headers: { 'Authorization': `Bearer ${process.env.CAR_INFO_API_KEY}` }
      });
      const apiData = await response.json();
      carData = {
        ...carData,
        make: apiData.make,
        model: apiData.model,
        year: apiData.year,
        // ... map other fields
      };
    }
    */

    // Check if we have real data or demo data
    const hasData = carData.make || carData.model || carData.year;
    const isRealData = hasData && !(DEMO_MODE && registrationNumber && !vin);
    
    return NextResponse.json({
      success: true,
      message: hasData 
        ? (isRealData 
            ? "Car data found from VIN decoder!" 
            : "Car data found! (Demo mode - using sample data)")
        : "Lookup completed. Enter a VIN for real data, or car.info API needed for registration number lookup.",
      data: carData,
      note: hasData 
        ? (isRealData
            ? "Real vehicle data decoded from VIN. For Swedish registration number lookup, car.info API integration needed."
            : "This is demo data for testing. Enter a VIN for real data, or integrate car.info API for registration number lookup.")
        : "Enter a 17-character VIN to get real vehicle data, or integrate car.info API for Swedish registration number lookup.",
      demoMode: DEMO_MODE && hasData && !isRealData,
      source: isRealData ? "vin_decoder" : (hasData ? "demo" : "none"),
    });
  } catch (error: any) {
    console.error("Car lookup error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to lookup car data" },
      { status: 500 }
    );
  }
}

