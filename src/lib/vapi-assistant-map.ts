export type BusinessType = "restaurant" | "car" | "router" | "other";

const MAP: Record<string, BusinessType> = {
  "2d8b7f46-3f1b-4b9f-bc08-6ceb4bd44996": "restaurant",
  "52d3f3f0-6dc6-45ab-9280-925e11503688": "restaurant",
  "4253cd09-7d49-42c5-9485-553524529be6": "router", // canada-usa: SolutionOps Main Squad
};

export function getBusinessTypeFromAssistantId(
  assistantId?: string
): BusinessType | null {
  if (!assistantId) return null;
  return MAP[assistantId] ?? null;
}
