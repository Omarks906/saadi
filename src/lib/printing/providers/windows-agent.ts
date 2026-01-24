import { PrinterProvider, PrintResult } from "../printer";

type AgentResponse =
  | { ok: true; jobId?: string }
  | { ok: false; error?: string };

export class WindowsAgentPrinterProvider implements PrinterProvider {
  async send(
    ticketText: string,
    meta: {
      organization_id: string;
      order_id: string;
      printer_target?: string;
      created_at: string;
    }
  ): Promise<PrintResult> {
    const baseUrl = process.env.PRINT_AGENT_URL;
    const apiKey = process.env.PRINT_AGENT_API_KEY;

    if (!baseUrl || !apiKey) {
      return { ok: false, error: "agent_unreachable" };
    }

    const url = `${baseUrl.replace(/\/$/, "")}/print`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ticketText,
          meta,
        }),
      });

      if (!response.ok) {
        let error = `agent_error_${response.status}`;
        try {
          const data = (await response.json()) as AgentResponse;
          if (data && data.ok === false && data.error) {
            error = data.error;
          }
        } catch {
          // ignore JSON parse errors
        }
        return { ok: false, error };
      }

      const data = (await response.json()) as AgentResponse;
      if (data && data.ok) {
        return { ok: true, jobId: data.jobId };
      }

      return { ok: false, error: data?.error || "agent_error" };
    } catch {
      return { ok: false, error: "agent_unreachable" };
    }
  }
}
