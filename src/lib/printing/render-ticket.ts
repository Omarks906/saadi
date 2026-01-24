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

const MAX_LINE_LENGTH = 42;

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

export function renderTicket(order: TicketOrder): string {
  const lines: string[] = [];

  if (order.restaurantName) {
    lines.push(...toPrintableLine(order.restaurantName));
  }

  if (order.restaurantPhone) {
    lines.push(...toPrintableLine(order.restaurantPhone));
  }

  if (order.orderNumber) {
    lines.push(`ORDER #${order.orderNumber}`.slice(0, MAX_LINE_LENGTH));
  }

  lines.push("CONFIRMED BY PHONE");

  const timeValue = formatTime(order.confirmedAt);
  if (timeValue) {
    lines.push(...toPrintableLine(`Time: ${timeValue}`));
  }

  const fulfillment = normalizeFulfillment(order.fulfillment);
  if (fulfillment) {
    lines.push(fulfillment.slice(0, MAX_LINE_LENGTH));
  }

  if (order.items && order.items.length > 0) {
    for (const item of order.items) {
      const name = item.name || "Item";
      const itemLine = `${formatQuantity(item.quantity)}${name}`.trim();
      lines.push(...toPrintableLine(itemLine));

      if (item.modifiers && item.modifiers.length > 0) {
        for (const modifier of item.modifiers) {
          const modifierText = formatModifier(modifier);
          if (modifierText) {
            lines.push(...toPrintableLine(`- ${modifierText}`));
          }
        }
      }

      if (item.notes) {
        lines.push(...toPrintableLine(`Notes: ${item.notes}`));
      }
    }
  }

  if (order.notes) {
    lines.push(...toPrintableLine(`Notes: ${order.notes}`));
  }

  if (order.allergies) {
    lines.push(...toPrintableLine(`Allergies: ${order.allergies}`));
  }

  if (order.customer) {
    if (order.customer.name) {
      lines.push(...toPrintableLine(`Customer: ${order.customer.name}`));
    }
    if (order.customer.phone) {
      lines.push(...toPrintableLine(`Phone: ${order.customer.phone}`));
    }
    if (order.customer.address) {
      lines.push(...toPrintableLine(`Address: ${order.customer.address}`));
    }
  }

  const total = formatMoney(order.totalAmount, order.currency);
  if (total) {
    lines.push(...toPrintableLine(`TOTAL: ${total}`));
  }

  lines.push("Printed automatically via Phone Assistant");

  return lines.join("\n");
}
