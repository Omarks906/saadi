type Modifier = {
  name: string;
  quantity?: number;
};

export type TicketItem = {
  name: string;
  quantity?: number;
  price?: number;
  modifiers?: Array<string | Modifier>;
  notes?: string;
};

export type TicketCustomer = {
  name?: string;
  phone?: string;
  address?: string;
};

export type TicketOrder = {
  restaurantName?: string;
  restaurantPhone?: string;
  orderNumber?: string;
  confirmedAt?: string;
  fulfillment?: "pickup" | "delivery" | string;
  items?: TicketItem[];
  notes?: string;
  allergies?: string;
  customer?: TicketCustomer;
  totalAmount?: number;
  currency?: string;
};

const MAX_LINE_LENGTH = 48;

function toPrintableLine(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const needsSpace = current.length > 0 ? 1 : 0;
    if (current.length + needsSpace + word.length <= MAX_LINE_LENGTH) {
      current = current.length ? `${current} ${word}` : word;
      continue;
    }

    if (current.length) {
      lines.push(current);
      current = "";
    }

    if (word.length <= MAX_LINE_LENGTH) {
      current = word;
      continue;
    }

    let remaining = word;
    while (remaining.length > MAX_LINE_LENGTH) {
      lines.push(remaining.slice(0, MAX_LINE_LENGTH));
      remaining = remaining.slice(MAX_LINE_LENGTH);
    }
    current = remaining;
  }

  if (current.length) lines.push(current);
  return lines;
}

function formatQuantity(quantity?: number): string {
  if (!quantity || quantity <= 1) return "";
  return `${quantity}x `;
}

function formatMoney(amount?: number, currency?: string): string | null {
  if (amount === undefined || amount === null) return null;
  const value = Number.isFinite(amount) ? amount : Number(amount);
  if (!Number.isFinite(value)) return null;
  const formatted = value.toFixed(2);
  return currency ? `${formatted} ${currency}` : formatted;
}

function normalizeFulfillment(value?: string): string | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized.includes("deliver")) return "DELIVERY";
  if (normalized.includes("pickup") || normalized.includes("pick up")) return "PICKUP";
  return value.toUpperCase();
}

function formatTime(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatModifier(modifier: string | Modifier): string {
  if (typeof modifier === "string") return modifier;
  const qty = modifier.quantity && modifier.quantity > 1 ? `${modifier.quantity}x ` : "";
  return `${qty}${modifier.name}`.trim();
}

function formatTwoColumnLine(left: string, right: string): string {
  const leftTrimmed = left.trim();
  const rightTrimmed = right.trim();
  if (!rightTrimmed) return leftTrimmed.slice(0, MAX_LINE_LENGTH);
  const available = MAX_LINE_LENGTH - rightTrimmed.length;
  if (available <= 1) {
    return `${leftTrimmed} ${rightTrimmed}`.slice(0, MAX_LINE_LENGTH);
  }
  const leftColumn = leftTrimmed.slice(0, available - 1);
  return `${leftColumn} ${rightTrimmed}`.padEnd(MAX_LINE_LENGTH, " ");
}

export function renderTicket(order: TicketOrder): string {
  const lines: string[] = [];
  const divider = "-".repeat(MAX_LINE_LENGTH);

  // --- ITEMS (top — kitchen reads this first) ---
  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      const name = item.name || "Item";
      const itemLine = `${formatQuantity(item.quantity)}${name}`.trim();
      lines.push(...toPrintableLine(itemLine));

      if (item.modifiers && item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          const modifierText = formatModifier(modifier);
          if (modifierText) {
            lines.push(...toPrintableLine(`  - ${modifierText}`));
          }
        }
      }

      if (item.notes) {
        lines.push(...toPrintableLine(`  * ${item.notes}`));
      }
    }
  }

  lines.push(divider);

  // --- ORDER INFO (bottom) ---
  if (order.orderNumber) {
    // Shorten long UUIDs to first 8 chars to fit on one line
    const num = order.orderNumber.length > 12
      ? order.orderNumber.replace(/-/g, "").slice(0, 8).toUpperCase()
      : order.orderNumber;
    lines.push(`ORDER #${num}`.slice(0, MAX_LINE_LENGTH));
  }

  const fulfillment = normalizeFulfillment(order.fulfillment);
  if (fulfillment) {
    lines.push(fulfillment.slice(0, MAX_LINE_LENGTH));
  }

  if (order.customer?.name?.trim()) {
    lines.push(...toPrintableLine(`Customer: ${order.customer.name}`));
  }

  if (order.customer?.phone?.trim()) {
    lines.push(...toPrintableLine(order.customer.phone));
  }

  if (order.allergies) {
    lines.push(...toPrintableLine(`!! ALLERGIES: ${order.allergies}`));
  }

  if (order.notes) {
    lines.push(...toPrintableLine(`Notes: ${order.notes}`));
  }

  return lines.join("\n");
}
