#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

const APP_BASE_URL = process.env.APP_BASE_URL;
const PRINT_AGENT_TOKEN = process.env.PRINT_AGENT_TOKEN;
const PRINTER_NAME = process.env.PRINTER_NAME || "";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 2000);
const STATE_FILE_PATH = process.env.AGENT_STATE_FILE || path.join(process.cwd(), ".print-agent-state.json");
const TEMP_DIR = process.env.AGENT_TEMP_DIR || path.join(os.tmpdir(), "saadi-print-agent");

let stopping = false;
let busy = false;
let printedJobs = new Set();

function log(level, message, extra = undefined) {
  const stamp = new Date().toISOString();
  if (extra !== undefined) {
    console.log(`[${stamp}] [${level}] ${message}`, extra);
  } else {
    console.log(`[${stamp}] [${level}] ${message}`);
  }
}

function ensureRequiredEnv() {
  if (!APP_BASE_URL) throw new Error("APP_BASE_URL is required");
  if (!PRINT_AGENT_TOKEN) throw new Error("PRINT_AGENT_TOKEN is required");
}

function loadState() {
  try {
    if (!fs.existsSync(STATE_FILE_PATH)) return;
    const raw = fs.readFileSync(STATE_FILE_PATH, "utf8");
    const data = JSON.parse(raw);
    const list = Array.isArray(data.printedJobIds) ? data.printedJobIds : [];
    printedJobs = new Set(list.slice(-5000));
  } catch (error) {
    log("WARN", "Failed to load state file; starting fresh", String(error?.message || error));
  }
}

function persistState() {
  const data = {
    printedJobIds: Array.from(printedJobs).slice(-5000),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(data, null, 2));
}

async function apiGetNext() {
  const response = await fetch(`${APP_BASE_URL.replace(/\/$/, "")}/api/print/next`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${PRINT_AGENT_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (response.status === 204) return null;

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GET /api/print/next failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  if (!payload?.printJobId) return null;
  return payload;
}

async function apiUpdate(jobId, status, error) {
  const response = await fetch(`${APP_BASE_URL.replace(/\/$/, "")}/api/print/update`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PRINT_AGENT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ printJobId: jobId, status, error }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`POST /api/print/update failed: ${response.status} ${text}`);
  }
}

async function printTicketText(ticketText, jobId) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  const filePath = path.join(TEMP_DIR, `${jobId}.txt`);
  fs.writeFileSync(filePath, `${ticketText}\n`, "utf8");

  const escapedPath = filePath.replace(/\\/g, "\\\\");
  const printerArg = PRINTER_NAME
    ? ` -Name "${PRINTER_NAME.replace(/"/g, '\\"')}"`
    : "";
  const script = `
$ErrorActionPreference = "Stop"
Get-Content -Raw -Path "${escapedPath}" | Out-Printer${printerArg}
`;

  await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });

  return `win-${PRINTER_NAME || "default"}:${jobId}`;
}

async function processOne() {
  if (busy || stopping) return;
  busy = true;
  try {
    const job = await apiGetNext();
    if (!job) return;

    const jobId = String(job.printJobId);
    const orderId = String(job.orderId || "unknown");
    const ticketText = String(job.content || "");

    if (!ticketText.trim()) {
      log("ERROR", `Job ${jobId} has empty ticket text; marking failed`);
      await apiUpdate(jobId, "failed", "empty_ticket_text");
      return;
    }

    if (printedJobs.has(jobId)) {
      log("WARN", `Job ${jobId} already printed locally; sending idempotent sent update`);
      await apiUpdate(jobId, "sent", null);
      return;
    }

    log("INFO", `Printing job=${jobId} order=${orderId}`);
    let printError = null;
    try {
      await printTicketText(ticketText, jobId);
    } catch (printErr) {
      printError = printErr;
    }

    if (printError) {
      const msg = String(printError?.message || printError);
      log("ERROR", `Print failed job=${jobId}`, msg);
      try {
        await apiUpdate(jobId, "failed", msg);
      } catch (updateErr) {
        log("ERROR", `Failed to report failure for job=${jobId}`, String(updateErr?.message || updateErr));
      }
      return;
    }

    printedJobs.add(jobId);
    persistState();
    await apiUpdate(jobId, "sent", null);
    log("INFO", `Printed successfully job=${jobId}`);
  } catch (error) {
    log("ERROR", "Processing cycle failed", String(error?.message || error));
  } finally {
    busy = false;
  }
}

async function runLoop() {
  ensureRequiredEnv();
  loadState();
  log("INFO", `Starting print agent. polling=${POLL_INTERVAL_MS}ms state=${STATE_FILE_PATH} printer=${PRINTER_NAME || "(windows default)"}`);

  while (!stopping) {
    await processOne();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  log("INFO", "Print agent stopped cleanly.");
}

function requestStop(signal) {
  if (stopping) return;
  stopping = true;
  log("INFO", `Received ${signal}, shutting down...`);
}

process.on("SIGINT", () => requestStop("SIGINT"));
process.on("SIGTERM", () => requestStop("SIGTERM"));

runLoop().catch((error) => {
  log("ERROR", "Fatal error", String(error?.message || error));
  process.exit(1);
});
