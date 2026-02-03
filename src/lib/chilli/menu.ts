/**
 * Chilli Menu Configuration
 * Complete menu for Restaurang & Pizzeria Chilli with categories and pricing
 */

export type MenuItem = {
  id: string;
  name: string;
  description?: string;
  priceOrdinarie: number; // Regular size price in SEK
  priceFamilj?: number; // Family size price in SEK (optional)
  category: MenuCategory;
  popular?: boolean;
  vegetarian?: boolean;
  glutenFreeAvailable?: boolean;
  spicy?: boolean;
  allergens?: string[];
};

export type MenuCategory =
  | "pizza"
  | "kebab"
  | "pasta"
  | "sallad"
  | "grill"
  | "barn" // Kids menu
  | "tillbehor" // Sides
  | "dryck"; // Drinks

export type CategoryInfo = {
  id: MenuCategory;
  name: string;
  nameSv: string; // Swedish name
  description?: string;
};

export const MENU_CATEGORIES: CategoryInfo[] = [
  { id: "pizza", name: "Pizza", nameSv: "Pizza", description: "Klassiska och specialpizzor" },
  { id: "kebab", name: "Kebab", nameSv: "Kebab", description: "Kebab i bröd, rulle eller tallrik" },
  { id: "pasta", name: "Pasta", nameSv: "Pasta", description: "Pasta med olika såser" },
  { id: "sallad", name: "Salads", nameSv: "Sallader", description: "Fräscha sallader" },
  { id: "grill", name: "Grill", nameSv: "Grillrätter", description: "Grillat kött och fisk" },
  { id: "barn", name: "Kids", nameSv: "Barnmeny", description: "Rätter för de små" },
  { id: "tillbehor", name: "Sides", nameSv: "Tillbehör", description: "Pommes, sås, bröd" },
  { id: "dryck", name: "Drinks", nameSv: "Drycker", description: "Läsk och vatten" },
];

export const CHILLI_MENU: MenuItem[] = [
  // ========== PIZZAS ==========
  {
    id: "pizza-margherita",
    name: "Margherita",
    description: "Tomatsås, ost",
    priceOrdinarie: 95,
    priceFamilj: 195,
    category: "pizza",
    vegetarian: true,
    glutenFreeAvailable: true,
    popular: true,
  },
  {
    id: "pizza-vesuvio",
    name: "Vesuvio",
    description: "Tomatsås, ost, skinka",
    priceOrdinarie: 105,
    priceFamilj: 215,
    category: "pizza",
    glutenFreeAvailable: true,
    popular: true,
  },
  {
    id: "pizza-capricciosa",
    name: "Capricciosa",
    description: "Tomatsås, ost, skinka, champinjoner",
    priceOrdinarie: 115,
    priceFamilj: 235,
    category: "pizza",
    glutenFreeAvailable: true,
    popular: true,
  },
  {
    id: "pizza-hawaii",
    name: "Hawaii",
    description: "Tomatsås, ost, skinka, ananas",
    priceOrdinarie: 115,
    priceFamilj: 235,
    category: "pizza",
    glutenFreeAvailable: true,
  },
  {
    id: "pizza-calzone",
    name: "Calzone",
    description: "Inbakad pizza med skinka, champinjoner",
    priceOrdinarie: 125,
    priceFamilj: 255,
    category: "pizza",
    glutenFreeAvailable: true,
  },
  {
    id: "pizza-bussola",
    name: "Bussola",
    description: "Tomatsås, ost, skinka, räkor",
    priceOrdinarie: 125,
    priceFamilj: 255,
    category: "pizza",
    glutenFreeAvailable: true,
    allergens: ["skaldjur"],
  },
  {
    id: "pizza-al-tonno",
    name: "Al Tonno",
    description: "Tomatsås, ost, tonfisk, lök",
    priceOrdinarie: 120,
    priceFamilj: 245,
    category: "pizza",
    glutenFreeAvailable: true,
    allergens: ["fisk"],
  },
  {
    id: "pizza-opera",
    name: "Opera",
    description: "Tomatsås, ost, skinka, räkor, champinjoner",
    priceOrdinarie: 130,
    priceFamilj: 265,
    category: "pizza",
    glutenFreeAvailable: true,
    allergens: ["skaldjur"],
  },
  {
    id: "pizza-pompei",
    name: "Pompei",
    description: "Tomatsås, ost, bacon, lök, ägg",
    priceOrdinarie: 120,
    priceFamilj: 245,
    category: "pizza",
    glutenFreeAvailable: true,
    allergens: ["ägg"],
  },
  {
    id: "pizza-chicko-banana",
    name: "Chicko Banana",
    description: "Tomatsås, ost, kyckling, banan, curry",
    priceOrdinarie: 125,
    priceFamilj: 255,
    category: "pizza",
    glutenFreeAvailable: true,
  },
  {
    id: "pizza-gudfadern",
    name: "Gudfadern",
    description: "Tomatsås, ost, oxfilé, lök, bearnaisesås",
    priceOrdinarie: 145,
    priceFamilj: 295,
    category: "pizza",
    glutenFreeAvailable: true,
    popular: true,
  },
  {
    id: "pizza-salami",
    name: "Salami",
    description: "Tomatsås, ost, salami",
    priceOrdinarie: 110,
    priceFamilj: 225,
    category: "pizza",
    glutenFreeAvailable: true,
  },
  {
    id: "pizza-bolognese",
    name: "Bolognese",
    description: "Tomatsås, ost, köttfärssås",
    priceOrdinarie: 115,
    priceFamilj: 235,
    category: "pizza",
    glutenFreeAvailable: true,
  },
  {
    id: "pizza-vegetarisk",
    name: "Vegetarisk",
    description: "Tomatsås, ost, champinjoner, paprika, lök, oliver",
    priceOrdinarie: 115,
    priceFamilj: 235,
    category: "pizza",
    vegetarian: true,
    glutenFreeAvailable: true,
  },
  {
    id: "pizza-funge",
    name: "Funge",
    description: "Tomatsås, ost, champinjoner",
    priceOrdinarie: 105,
    priceFamilj: 215,
    category: "pizza",
    vegetarian: true,
    glutenFreeAvailable: true,
  },
  {
    id: "pizza-kebab",
    name: "Kebabpizza",
    description: "Tomatsås, ost, kebabkött, lök, tomat, kebabsås",
    priceOrdinarie: 135,
    priceFamilj: 275,
    category: "pizza",
    glutenFreeAvailable: true,
    popular: true,
    spicy: true,
  },
  {
    id: "pizza-mexicana",
    name: "Mexicana",
    description: "Tomatsås, ost, köttfärs, jalapeno, lök, tacosås",
    priceOrdinarie: 130,
    priceFamilj: 265,
    category: "pizza",
    glutenFreeAvailable: true,
    spicy: true,
  },
  {
    id: "pizza-quattro-stagioni",
    name: "Quattro Stagioni",
    description: "Tomatsås, ost, skinka, räkor, musslor, champinjoner",
    priceOrdinarie: 140,
    priceFamilj: 285,
    category: "pizza",
    glutenFreeAvailable: true,
    allergens: ["skaldjur"],
  },
  {
    id: "pizza-chilli-special",
    name: "Chilli Special",
    description: "Tomatsås, ost, oxfilé, bacon, lök, champinjoner, bearnaisesås",
    priceOrdinarie: 155,
    priceFamilj: 315,
    category: "pizza",
    glutenFreeAvailable: true,
    popular: true,
  },
  {
    id: "pizza-kyckling",
    name: "Kycklingpizza",
    description: "Tomatsås, ost, kyckling, champinjoner, paprika",
    priceOrdinarie: 125,
    priceFamilj: 255,
    category: "pizza",
    glutenFreeAvailable: true,
  },

  // ========== KEBAB ==========
  {
    id: "kebab-rulle",
    name: "Kebab Rulle",
    description: "Tunnbrödsrulle med kebabkött, sallad, sås",
    priceOrdinarie: 95,
    category: "kebab",
    popular: true,
  },
  {
    id: "kebab-tallrik",
    name: "Kebabtallrik",
    description: "Kebabkött, pommes frites, sallad, sås",
    priceOrdinarie: 125,
    category: "kebab",
    popular: true,
  },
  {
    id: "kebab-pitabrod",
    name: "Kebab i Pitabröd",
    description: "Pitabröd med kebabkött, sallad, sås",
    priceOrdinarie: 95,
    category: "kebab",
  },
  {
    id: "falafel-rulle",
    name: "Falafel Rulle",
    description: "Tunnbrödsrulle med falafel, sallad, sås",
    priceOrdinarie: 95,
    category: "kebab",
    vegetarian: true,
  },
  {
    id: "falafel-tallrik",
    name: "Falafeltallrik",
    description: "Falafel, pommes frites, sallad, hummus",
    priceOrdinarie: 125,
    category: "kebab",
    vegetarian: true,
  },
  {
    id: "kyckling-rulle",
    name: "Kyckling Rulle",
    description: "Tunnbrödsrulle med grillad kyckling, sallad, sås",
    priceOrdinarie: 105,
    category: "kebab",
  },

  // ========== PASTA ==========
  {
    id: "pasta-bolognese",
    name: "Pasta Bolognese",
    description: "Spaghetti med köttfärssås",
    priceOrdinarie: 115,
    category: "pasta",
  },
  {
    id: "pasta-carbonara",
    name: "Pasta Carbonara",
    description: "Spaghetti med bacon, grädde, ägg, parmesan",
    priceOrdinarie: 125,
    category: "pasta",
    allergens: ["ägg"],
    popular: true,
  },
  {
    id: "pasta-alfredo",
    name: "Pasta Alfredo",
    description: "Penne med kyckling, gräddsås, parmesan",
    priceOrdinarie: 135,
    category: "pasta",
  },
  {
    id: "pasta-pesto",
    name: "Pasta Pesto",
    description: "Penne med pestosås, soltorkade tomater",
    priceOrdinarie: 115,
    category: "pasta",
    vegetarian: true,
  },
  {
    id: "pasta-raksallad",
    name: "Pasta Räksallad",
    description: "Spaghetti med räkor, grädde, vitlök",
    priceOrdinarie: 145,
    category: "pasta",
    allergens: ["skaldjur"],
  },

  // ========== SALLADER ==========
  {
    id: "sallad-kebab",
    name: "Kebabsallad",
    description: "Kebabkött, sallad, tomat, gurka, lök, sås",
    priceOrdinarie: 115,
    category: "sallad",
  },
  {
    id: "sallad-kyckling",
    name: "Kycklingsallad",
    description: "Grillad kyckling, sallad, tomat, gurka, majs",
    priceOrdinarie: 115,
    category: "sallad",
  },
  {
    id: "sallad-raksallad",
    name: "Räksallad",
    description: "Räkor, sallad, tomat, gurka, ägg, dressing",
    priceOrdinarie: 125,
    category: "sallad",
    allergens: ["skaldjur", "ägg"],
  },
  {
    id: "sallad-grekisk",
    name: "Grekisk Sallad",
    description: "Sallad, tomat, gurka, fetaost, oliver, lök",
    priceOrdinarie: 105,
    category: "sallad",
    vegetarian: true,
    allergens: ["mjölk"],
  },
  {
    id: "sallad-tonfisk",
    name: "Tonfisksallad",
    description: "Tonfisk, sallad, tomat, gurka, lök, majs",
    priceOrdinarie: 115,
    category: "sallad",
    allergens: ["fisk"],
  },

  // ========== GRILL ==========
  {
    id: "grill-schnitzel",
    name: "Schnitzel",
    description: "Panerad schnitzel med pommes frites, sallad",
    priceOrdinarie: 145,
    category: "grill",
  },
  {
    id: "grill-biff",
    name: "Biff med Pommes",
    description: "Grillad biff med pommes frites, bearnaisesås",
    priceOrdinarie: 165,
    category: "grill",
    popular: true,
  },
  {
    id: "grill-kyckling",
    name: "Grillad Kyckling",
    description: "Grillad kycklingfilé med pommes frites, sås",
    priceOrdinarie: 145,
    category: "grill",
  },
  {
    id: "grill-lax",
    name: "Grillad Lax",
    description: "Grillad laxfilé med pommes frites, citron, dill",
    priceOrdinarie: 165,
    category: "grill",
    allergens: ["fisk"],
  },

  // ========== BARNMENY ==========
  {
    id: "barn-pizza",
    name: "Barnpizza",
    description: "Liten pizza med valfri topping",
    priceOrdinarie: 75,
    category: "barn",
    glutenFreeAvailable: true,
  },
  {
    id: "barn-nuggets",
    name: "Chicken Nuggets",
    description: "Kycklingnuggets med pommes frites",
    priceOrdinarie: 85,
    category: "barn",
  },
  {
    id: "barn-korv",
    name: "Korv med Pommes",
    description: "Grillad korv med pommes frites",
    priceOrdinarie: 75,
    category: "barn",
  },
  {
    id: "barn-pasta",
    name: "Barnpasta",
    description: "Pasta med tomatsås",
    priceOrdinarie: 75,
    category: "barn",
    vegetarian: true,
  },

  // ========== TILLBEHÖR ==========
  {
    id: "tillbehor-pommes",
    name: "Pommes Frites",
    description: "Portion pommes frites",
    priceOrdinarie: 35,
    category: "tillbehor",
    vegetarian: true,
  },
  {
    id: "tillbehor-vitloksbrod",
    name: "Vitlöksbröd",
    description: "Bröd med vitlökssmör",
    priceOrdinarie: 30,
    category: "tillbehor",
    vegetarian: true,
  },
  {
    id: "tillbehor-extra-sas",
    name: "Extra Sås",
    description: "Kebabsås, vitlökssås, eller bearnaise",
    priceOrdinarie: 15,
    category: "tillbehor",
  },
  {
    id: "tillbehor-extra-ost",
    name: "Extra Ost",
    description: "Extra mozzarella på pizza",
    priceOrdinarie: 20,
    category: "tillbehor",
    vegetarian: true,
  },

  // ========== DRYCKER ==========
  {
    id: "dryck-coca-cola",
    name: "Coca-Cola",
    description: "33cl",
    priceOrdinarie: 25,
    category: "dryck",
    vegetarian: true,
  },
  {
    id: "dryck-fanta",
    name: "Fanta",
    description: "33cl",
    priceOrdinarie: 25,
    category: "dryck",
    vegetarian: true,
  },
  {
    id: "dryck-sprite",
    name: "Sprite",
    description: "33cl",
    priceOrdinarie: 25,
    category: "dryck",
    vegetarian: true,
  },
  {
    id: "dryck-vatten",
    name: "Vatten",
    description: "50cl",
    priceOrdinarie: 20,
    category: "dryck",
    vegetarian: true,
  },
  {
    id: "dryck-stor-lask",
    name: "Stor Läsk",
    description: "1.5L (Coca-Cola, Fanta, eller Sprite)",
    priceOrdinarie: 45,
    category: "dryck",
    vegetarian: true,
  },
];

// Helper functions
export function getMenuItemById(id: string): MenuItem | undefined {
  return CHILLI_MENU.find((item) => item.id === id);
}

export function getMenuItemByName(name: string): MenuItem | undefined {
  const normalized = name.toLowerCase().trim();
  return CHILLI_MENU.find(
    (item) =>
      item.name.toLowerCase() === normalized ||
      item.id.toLowerCase().includes(normalized)
  );
}

export function getMenuItemsByCategory(category: MenuCategory): MenuItem[] {
  return CHILLI_MENU.filter((item) => item.category === category);
}

export function getPopularItems(): MenuItem[] {
  return CHILLI_MENU.filter((item) => item.popular);
}

export function getVegetarianItems(): MenuItem[] {
  return CHILLI_MENU.filter((item) => item.vegetarian);
}

export function getGlutenFreeItems(): MenuItem[] {
  return CHILLI_MENU.filter((item) => item.glutenFreeAvailable);
}

export function searchMenu(query: string): MenuItem[] {
  const normalized = query.toLowerCase().trim();
  return CHILLI_MENU.filter(
    (item) =>
      item.name.toLowerCase().includes(normalized) ||
      item.description?.toLowerCase().includes(normalized)
  );
}

// Export menu names for order extraction
export function getMenuNamesForExtraction(): string[] {
  return CHILLI_MENU.map((item) => item.name.toLowerCase());
}

// Calculate order total
export function calculateOrderTotal(
  items: Array<{ id?: string; name: string; quantity: number; size?: "ordinarie" | "familj" }>
): number {
  let total = 0;
  for (const orderItem of items) {
    const menuItem = orderItem.id
      ? getMenuItemById(orderItem.id)
      : getMenuItemByName(orderItem.name);
    if (menuItem) {
      const price =
        orderItem.size === "familj" && menuItem.priceFamilj
          ? menuItem.priceFamilj
          : menuItem.priceOrdinarie;
      total += price * orderItem.quantity;
    }
  }
  return total;
}
