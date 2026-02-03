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
