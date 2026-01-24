import { PrinterProvider } from "./printer";
import { MockPrinterProvider } from "./providers/mock";
import { WindowsAgentPrinterProvider } from "./providers/windows-agent";

export function getPrinterProvider(): PrinterProvider {
  const provider = (process.env.PRINT_PROVIDER || "mock").toLowerCase();

  if (provider === "windows_agent") {
    return new WindowsAgentPrinterProvider();
  }

  return new MockPrinterProvider();
}
