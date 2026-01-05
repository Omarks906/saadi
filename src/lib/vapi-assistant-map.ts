export type BusinessType = "restaurant" | "car" | "router";

const MAP: Record<string, BusinessType> = {
  "2d8b7f46-3f1b-4b9f-bc08-6ceb4bd44996": "restaurant",
};

export function getBusinessTypeFromAssistantId(
  assistantId?: string
): BusinessType | null {
  if (!assistantId) return null;
  return MAP[assistantId] ?? null;
}
