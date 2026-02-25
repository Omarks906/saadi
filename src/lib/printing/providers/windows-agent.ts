import { PrinterProvider, PrintResult } from "../printer";

/**
 * Pull mode provider.
 *
 * In pilot mode, the Windows Surface agent polls Railway for queued jobs.
 * The app enqueues jobs and returns deferred success instead of pushing to
 * a machine-local endpoint.
 */
export class WindowsAgentPrinterProvider implements PrinterProvider {
  async send(
    _ticketText: string,
    _meta: {
      organization_id: string;
      order_id: string;
      printer_target?: string;
      created_at: string;
    }
  ): Promise<PrintResult> {
    void _ticketText;
    void _meta;
    return { ok: true, deferred: true, jobId: "queued_for_agent" };
  }
}
