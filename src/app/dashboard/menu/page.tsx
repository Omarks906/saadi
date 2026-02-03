import Link from "next/link";
import { getSessionOrgSlugFromCookies } from "@/lib/auth-session";
import {
  CHILLI_MENU,
  MENU_CATEGORIES,
  getMenuItemsByCategory,
  type MenuItem,
  type MenuCategory,
} from "@/lib/chilli/menu";
import { CHILLI_CONFIG, isCurrentlyOpen, getTodaysHours } from "@/lib/chilli/config";

export const dynamic = "force-dynamic";

function formatPrice(price: number): string {
  return `${price} kr`;
}

function MenuItemCard({ item }: { item: MenuItem }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            {item.name}
            {item.popular && (
              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                Popular
              </span>
            )}
            {item.vegetarian && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                Veg
              </span>
            )}
            {item.spicy && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                Spicy
              </span>
            )}
          </h3>
          {item.description && (
            <p className="text-sm text-gray-500 mt-1">{item.description}</p>
          )}
        </div>
        <div className="text-right ml-4">
          <p className="font-semibold text-gray-900">
            {formatPrice(item.priceOrdinarie)}
          </p>
          {item.priceFamilj && (
            <p className="text-xs text-gray-500">
              Familj: {formatPrice(item.priceFamilj)}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {item.glutenFreeAvailable && (
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
            Glutenfri tillgänglig
          </span>
        )}
        {item.allergens?.map((allergen) => (
          <span
            key={allergen}
            className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded"
          >
            {allergen}
          </span>
        ))}
      </div>
    </div>
  );
}

function CategorySection({ category }: { category: typeof MENU_CATEGORIES[number] }) {
  const items = getMenuItemsByCategory(category.id);
  if (items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{category.nameSv}</h2>
          {category.description && (
            <p className="text-sm text-gray-500">{category.description}</p>
          )}
        </div>
        <span className="text-sm text-gray-400">{items.length} items</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <MenuItemCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

export default async function MenuPage({
  searchParams,
}: {
  searchParams?: { orgSlug?: string; category?: string };
}) {
  const orgSlug =
    searchParams?.orgSlug?.trim() ||
    (await getSessionOrgSlugFromCookies()) ||
    null;
  const selectedCategory = searchParams?.category as MenuCategory | undefined;
  const isChilli = orgSlug === "chilli";
  const dashboardHref = orgSlug
    ? `/dashboard?orgSlug=${encodeURIComponent(orgSlug)}`
    : "/dashboard";

  if (!isChilli) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href={dashboardHref}
          className="text-blue-600 hover:text-blue-800 underline mb-4 inline-block"
        >
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold mb-2">Menu</h1>
        <p className="text-sm text-gray-500">
          The menu view is only available for the Chilli pilot org.
        </p>
      </div>
    );
  }

  const open = isCurrentlyOpen();
  const todaysHours = getTodaysHours();
  const categoriesToShow = selectedCategory
    ? MENU_CATEGORIES.filter((c) => c.id === selectedCategory)
    : MENU_CATEGORIES;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{CHILLI_CONFIG.name}</h1>
          <p className="text-sm text-gray-500">
            {CHILLI_CONFIG.address}, {CHILLI_CONFIG.postalCode} {CHILLI_CONFIG.city}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                open ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className="text-sm text-gray-600">
              {open ? "Open now" : "Closed"}
              {todaysHours && !todaysHours.closed && (
                <span className="text-gray-400">
                  {" "}
                  ({todaysHours.open} - {todaysHours.close})
                </span>
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={dashboardHref}
            className="px-4 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Category Filter */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 pb-2">
          <Link
            href={`/dashboard/menu?orgSlug=${encodeURIComponent(orgSlug)}`}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              !selectedCategory
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Alla ({CHILLI_MENU.length})
          </Link>
          {MENU_CATEGORIES.map((cat) => {
            const count = getMenuItemsByCategory(cat.id).length;
            return (
              <Link
                key={cat.id}
                href={`/dashboard/menu?orgSlug=${encodeURIComponent(orgSlug)}&category=${cat.id}`}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {cat.nameSv} ({count})
              </Link>
            );
          })}
        </div>
      </div>

      {/* Menu Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Total Items
          </p>
          <p className="text-2xl font-bold text-gray-900">{CHILLI_MENU.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Categories
          </p>
          <p className="text-2xl font-bold text-gray-900">{MENU_CATEGORIES.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Vegetarian
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {CHILLI_MENU.filter((i) => i.vegetarian).length}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Gluten-Free
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {CHILLI_MENU.filter((i) => i.glutenFreeAvailable).length}
          </p>
        </div>
      </div>

      {/* Menu Items */}
      {categoriesToShow.map((category) => (
        <CategorySection key={category.id} category={category} />
      ))}
    </div>
  );
}
