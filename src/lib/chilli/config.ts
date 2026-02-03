/**
 * Chilli Restaurant Configuration
 * Opening hours, contact info, and settings
 */

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type OpeningHours = {
  day: DayOfWeek;
  daySv: string; // Swedish name
  open: string; // HH:mm format
  close: string; // HH:mm format
  closed?: boolean;
};

export type DeliveryZone = {
  name: string;
  postalCodes: string[];
  deliveryFee: number;
  minOrder: number;
  estimatedMinutes: number;
};

export type ChilliConfig = {
  name: string;
  slug: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  email?: string;
  openingHours: OpeningHours[];
  deliveryZones: DeliveryZone[];
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  minDeliveryOrder: number;
  defaultPrepTime: number; // minutes
  rushHourPrepTime: number; // minutes during busy times
};

export const CHILLI_CONFIG: ChilliConfig = {
  name: "Restaurang & Pizzeria Chilli",
  slug: "chilli",
  phone: "+46 XX XXX XX XX",
  address: "Storgatan 1",
  city: "Stockholm",
  postalCode: "123 45",
  email: "info@pizzeriachilli.se",
  openingHours: [
    { day: "monday", daySv: "Måndag", open: "11:00", close: "22:00" },
    { day: "tuesday", daySv: "Tisdag", open: "11:00", close: "22:00" },
    { day: "wednesday", daySv: "Onsdag", open: "11:00", close: "22:00" },
    { day: "thursday", daySv: "Torsdag", open: "11:00", close: "22:00" },
    { day: "friday", daySv: "Fredag", open: "11:00", close: "23:00" },
    { day: "saturday", daySv: "Lördag", open: "12:00", close: "23:00" },
    { day: "sunday", daySv: "Söndag", open: "12:00", close: "21:00" },
  ],
  deliveryZones: [
    {
      name: "Zone 1 - Central",
      postalCodes: ["123 45", "123 46", "123 47"],
      deliveryFee: 0,
      minOrder: 150,
      estimatedMinutes: 20,
    },
    {
      name: "Zone 2 - Near",
      postalCodes: ["123 50", "123 51", "123 52"],
      deliveryFee: 29,
      minOrder: 200,
      estimatedMinutes: 30,
    },
    {
      name: "Zone 3 - Extended",
      postalCodes: ["123 60", "123 61"],
      deliveryFee: 49,
      minOrder: 250,
      estimatedMinutes: 45,
    },
  ],
  deliveryEnabled: true,
  pickupEnabled: true,
  minDeliveryOrder: 150,
  defaultPrepTime: 20,
  rushHourPrepTime: 35,
};

// Helper functions

export function isCurrentlyOpen(): boolean {
  const now = new Date();
  const dayIndex = now.getDay(); // 0 = Sunday
  const dayNames: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const today = dayNames[dayIndex];

  const hours = CHILLI_CONFIG.openingHours.find((h) => h.day === today);
  if (!hours || hours.closed) return false;

  const currentTime = now.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return currentTime >= hours.open && currentTime <= hours.close;
}

export function getTodaysHours(): OpeningHours | undefined {
  const now = new Date();
  const dayIndex = now.getDay();
  const dayNames: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const today = dayNames[dayIndex];
  return CHILLI_CONFIG.openingHours.find((h) => h.day === today);
}

export function getNextOpenTime(): { day: string; time: string } | null {
  const now = new Date();
  const dayIndex = now.getDay();
  const dayNames: DayOfWeek[] = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];

  for (let i = 0; i < 7; i++) {
    const checkDayIndex = (dayIndex + i) % 7;
    const dayName = dayNames[checkDayIndex];
    const hours = CHILLI_CONFIG.openingHours.find((h) => h.day === dayName);

    if (hours && !hours.closed) {
      const currentTime = now.toLocaleTimeString("sv-SE", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });

      if (i === 0 && currentTime < hours.open) {
        return { day: "Idag", time: hours.open };
      }
      if (i > 0) {
        return { day: hours.daySv, time: hours.open };
      }
    }
  }

  return null;
}

export function getDeliveryZoneByPostalCode(postalCode: string): DeliveryZone | undefined {
  const normalized = postalCode.replace(/\s/g, "").trim();
  return CHILLI_CONFIG.deliveryZones.find((zone) =>
    zone.postalCodes.some((pc) => pc.replace(/\s/g, "") === normalized)
  );
}

export function isRushHour(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const dayIndex = now.getDay();

  // Rush hours: 11:30-13:30 (lunch), 17:00-19:30 (dinner)
  const isLunchRush = hour >= 11 && hour < 14;
  const isDinnerRush = hour >= 17 && hour < 20;

  // Friday and Saturday evenings are busier
  const isWeekendEvening = (dayIndex === 5 || dayIndex === 6) && hour >= 17;

  return isLunchRush || isDinnerRush || isWeekendEvening;
}

export function getEstimatedPrepTime(): number {
  return isRushHour() ? CHILLI_CONFIG.rushHourPrepTime : CHILLI_CONFIG.defaultPrepTime;
}

export function formatOpeningHoursDisplay(): string[] {
  return CHILLI_CONFIG.openingHours.map((h) => {
    if (h.closed) {
      return `${h.daySv}: Stängt`;
    }
    return `${h.daySv}: ${h.open} - ${h.close}`;
  });
}
