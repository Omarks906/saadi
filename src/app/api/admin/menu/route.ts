import { NextRequest, NextResponse } from "next/server";
import {
  CHILLI_MENU,
  MENU_CATEGORIES,
  getMenuItemsByCategory,
  getPopularItems,
  getVegetarianItems,
  searchMenu,
  type MenuItem,
  type MenuCategory,
} from "@/lib/chilli/menu";

/**
 * GET /api/admin/menu
 * Returns the Chilli menu, optionally filtered by category or search query
 *
 * Query params:
 *   - orgSlug: Organization slug (required, must be "chilli")
 *   - category: Filter by category
 *   - search: Search query
 *   - popular: If "true", return only popular items
 *   - vegetarian: If "true", return only vegetarian items
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orgSlug = searchParams.get("orgSlug");
  const category = searchParams.get("category") as MenuCategory | null;
  const search = searchParams.get("search");
  const popular = searchParams.get("popular") === "true";
  const vegetarian = searchParams.get("vegetarian") === "true";

  // Only Chilli has a menu for now
  if (orgSlug !== "chilli") {
    return NextResponse.json(
      { error: "Menu only available for Chilli organization" },
      { status: 400 }
    );
  }

  let items: MenuItem[] = CHILLI_MENU;

  // Apply filters
  if (category) {
    items = getMenuItemsByCategory(category);
  } else if (search) {
    items = searchMenu(search);
  } else if (popular) {
    items = getPopularItems();
  } else if (vegetarian) {
    items = getVegetarianItems();
  }

  return NextResponse.json({
    categories: MENU_CATEGORIES,
    items,
    totalItems: CHILLI_MENU.length,
    filteredCount: items.length,
  });
}
