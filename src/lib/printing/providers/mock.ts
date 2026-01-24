import { writeFileSync } from "fs";
import { PrinterProvider, PrintResult } from "../printer";

export class MockPrinterProvider implements PrinterProvider {
  async send(
    ticketText: string,
    meta: {
      organization_id: string;
      order_id: string;
      printer_target?: string;
      created_at: string;
    }
  ): Promise<PrintResult> {
    console.log("[MockPrinter] Ticket meta:", meta);
    console.log("[MockPrinter] Ticket text:\n" + ticketText);

    if (process.env.NODE_ENV === "development") {
      try {
        writeFileSync("/tmp/printed-ticket.txt", ticketText, "utf-8");
      } catch (error) {
        console.warn("[MockPrinter] Failed to write /tmp/printed-ticket.txt", error);
      }
    }

    return { ok: true, jobId: "mock-job-123" };
  }
}
