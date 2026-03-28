/**
 * Chilli Restaurant Module
 * Re-exports all Chilli-specific functionality
 */

// Menu configuration and types
export {
  CHILLI_MENU,
  MENU_CATEGORIES,
  getMenuItemById,
  getMenuItemByName,
  getMenuItemsByCategory,
  getPopularItems,
  getVegetarianItems,
  getGlutenFreeItems,
  searchMenu,
  getMenuNamesForExtraction,
  calculateOrderTotal,
  type MenuItem,
  type MenuCategory,
  type CategoryInfo,
} from "./menu";

// Structured post-call order schema (Zod + OpenAI JSON Schema)
export {
  ChilliOrderSchema,
  PizzaSchema,
  DrinkSchema,
  FulfillmentSchema,
  OrderMetadataSchema,
  OPENAI_ORDER_SCHEMA,
  parseChilliOrder,
  safeParseChilliOrder,
  type ChilliOrder,
  type Pizza,
  type Drink,
  type Fulfillment,
  type OrderMetadata,
} from "./order-schema";

// Order normalizer (flat AI extraction → structured ChilliOrder)
export {
  normalizeToChilliOrder,
  normalizeSingleItemName,
  buildPizzaDescription,
  type RawExtractedItem,
} from "./normalize-order";

// Pizza name fuzzy matcher (STT → canonical menu name)
export {
  matchPizzaName,
  matchPizzaNameDebug,
  PIZZA_MENU_NAMES,
  type MatchMethod,
  type MatchResult,
} from "./match-pizza-name";

// Restaurant configuration
export {
  CHILLI_CONFIG,
  isCurrentlyOpen,
  getTodaysHours,
  getNextOpenTime,
  getDeliveryZoneByPostalCode,
  isRushHour,
  getEstimatedPrepTime,
  formatOpeningHoursDisplay,
  type DayOfWeek,
  type OpeningHours,
  type DeliveryZone,
  type ChilliConfig,
} from "./config";
