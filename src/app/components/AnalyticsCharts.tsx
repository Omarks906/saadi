"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

type HourlyDataPoint = {
  hour: number;
  label: string;
  calls: number;
  orders: number;
  revenue: number;
};

type DailyDataPoint = {
  date: string;
  calls: number;
  orders: number;
  revenue: number;
};

type TopItem = {
  name: string;
  count: number;
  revenue: number;
};

type PeakHour = {
  hour: number;
  label: string;
  calls: number;
};

// ── Peak Hours Heatmap ────────────────────────────────────────────────────────

export function PeakHoursChart({ data }: { data: HourlyDataPoint[] }) {
  const maxCalls = Math.max(...data.map((d) => d.calls), 1);
  return (
    <div className="w-full overflow-x-auto">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            interval={2}
            angle={-45}
            textAnchor="end"
          />
          <YAxis tick={{ fontSize: 11 }} width={28} />
          <Tooltip
            formatter={(val: any, name: any) => [
              val,
              name === "calls" ? "Calls" : "Orders",
            ]}
            labelFormatter={(label) => `Hour: ${label}`}
          />
          <Bar dataKey="calls" name="calls" radius={[3, 3, 0, 0]}>
            {data.map((entry) => {
              const intensity = entry.calls / maxCalls;
              const r = Math.round(59 + intensity * (239 - 59));
              const g = Math.round(130 + intensity * (68 - 130));
              const b = Math.round(246 + intensity * (68 - 246));
              return (
                <Cell
                  key={`cell-${entry.hour}`}
                  fill={`rgb(${r},${g},${b})`}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Daily Trend Chart ────────────────────────────────────────────────────────

export function DailyTrendChart({ data }: { data: DailyDataPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: d.date.slice(5), // "MM-DD"
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={formatted}
        margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={32} />
        <Tooltip
          formatter={(val: any, name: any) => [
            val,
            name === "calls" ? "Calls" : name === "orders" ? "Orders" : "Revenue (kr)",
          ]}
        />
        <Line
          type="monotone"
          dataKey="calls"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          name="calls"
        />
        <Line
          type="monotone"
          dataKey="orders"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          name="orders"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Revenue Trend Chart ──────────────────────────────────────────────────────

export function RevenueTrendChart({ data }: { data: DailyDataPoint[] }) {
  const formatted = data.map((d) => ({
    ...d,
    dateLabel: d.date.slice(5),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={formatted}
        margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={45} />
        <Tooltip
          formatter={(val: any) => [`${val} kr`, "Revenue"]}
          labelFormatter={(label) => `Date: ${label}`}
        />
        <Bar dataKey="revenue" fill="#10b981" radius={[3, 3, 0, 0]} name="revenue" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Conversion Funnel ────────────────────────────────────────────────────────

type FunnelProps = {
  funnel: {
    calls: number;
    callsWithOrders: number;
    confirmedOrders: number;
    completedOrders: number;
  };
};

export function ConversionFunnel({ funnel }: FunnelProps) {
  const steps = [
    { label: "Total Calls", value: funnel.calls, color: "bg-indigo-500" },
    { label: "Calls → Orders", value: funnel.callsWithOrders, color: "bg-blue-500" },
    { label: "Orders Placed", value: funnel.confirmedOrders, color: "bg-emerald-500" },
    { label: "Completed", value: funnel.completedOrders, color: "bg-green-600" },
  ];

  const max = Math.max(funnel.calls, 1);

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const pct = Math.round((step.value / max) * 100);
        const convPct =
          i > 0 && steps[i - 1].value > 0
            ? Math.round((step.value / steps[i - 1].value) * 100)
            : null;
        return (
          <div key={step.label}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700">
                {step.label}
              </span>
              <div className="flex items-center gap-2">
                {convPct !== null && (
                  <span className="text-xs text-gray-400">{convPct}%</span>
                )}
                <span className="text-sm font-bold text-gray-900">
                  {step.value}
                </span>
              </div>
            </div>
            <div className="h-7 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${step.color} rounded-full transition-all duration-500 flex items-center justify-end pr-2`}
                style={{ width: `${Math.max(pct, 4)}%` }}
              >
                {pct > 15 && (
                  <span className="text-xs font-semibold text-white">
                    {pct}%
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Top Items Chart ──────────────────────────────────────────────────────────

export function TopItemsChart({ items }: { items: TopItem[] }) {
  const top = items.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={top}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          dataKey="name"
          type="category"
          tick={{ fontSize: 11 }}
          width={100}
        />
        <Tooltip
          formatter={(val: any) => [val, "Orders"]}
        />
        <Bar dataKey="count" fill="#6366f1" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Order Status Donut (CSS-based, no recharts Pie) ──────────────────────────

type StatusBreakdownProps = {
  orderStatus: Record<string, number>;
  fulfillmentBreakdown: { delivery: number; pickup: number };
};

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-blue-500",
  preparing: "bg-yellow-500",
  ready: "bg-green-500",
  out_for_delivery: "bg-purple-500",
  completed: "bg-gray-400",
  cancelled: "bg-red-500",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for Delivery",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function OrderStatusBreakdown({
  orderStatus,
  fulfillmentBreakdown,
}: StatusBreakdownProps) {
  const total = Object.values(orderStatus).reduce((s, v) => s + v, 0);
  const entries = Object.entries(orderStatus).filter(([, v]) => v > 0);

  return (
    <div className="space-y-4">
      {/* Status breakdown */}
      <div className="space-y-2">
        {entries.map(([key, val]) => (
          <div key={key} className="flex items-center gap-3">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${STATUS_COLORS[key] || "bg-gray-300"}`}
            />
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className={`h-full ${STATUS_COLORS[key] || "bg-gray-400"} transition-all duration-500`}
                style={{ width: total > 0 ? `${(val / total) * 100}%` : "0%" }}
              />
            </div>
            <span className="text-sm text-gray-700 w-24 text-right">
              {STATUS_LABELS[key] || key}: <strong>{val}</strong>
            </span>
          </div>
        ))}
      </div>

      {/* Fulfillment split */}
      {(fulfillmentBreakdown.delivery + fulfillmentBreakdown.pickup) > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Fulfillment Type
          </p>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm text-gray-600">
                Delivery: <strong>{fulfillmentBreakdown.delivery}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-sm text-gray-600">
                Pickup: <strong>{fulfillmentBreakdown.pickup}</strong>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
