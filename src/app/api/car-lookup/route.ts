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

    // Demo data for testing (remove when real API is available)
    if (DEMO_MODE && registrationNumber) {
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

    // Check if we have demo data or real data
    const hasData = carData.make || carData.model || carData.year;
    
    return NextResponse.json({
      success: true,
      message: hasData 
        ? "Car data found! (Demo mode - using sample data)" 
        : "Lookup completed. API integration needed for real data.",
      data: carData,
      note: hasData 
        ? "This is demo data for testing. Real API integration needed for production."
        : "Lookup service is ready. To enable real car data lookup, integrate with car.info API or an alternative service. For now, please enter car details manually.",
      demoMode: DEMO_MODE && hasData,
    });
  } catch (error: any) {
    console.error("Car lookup error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to lookup car data" },
      { status: 500 }
    );
  }
}

