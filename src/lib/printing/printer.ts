export type PrintResult =
  | { ok: true; jobId?: string; deferred?: boolean }
  | { ok: false; error: string };

export interface PrinterProvider {
  send(
    ticketText: string,
    meta: {
      organization_id: string;
      order_id: string;
      printer_target?: string;
      created_at: string;
    }
  ): Promise<PrintResult>;
}
