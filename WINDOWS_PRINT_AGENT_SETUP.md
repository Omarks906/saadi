# Windows Pull Print Agent (Surface Go 3 + Epson TM-T20III)

This pilot uses **pull mode**:
- Railway queues print jobs.
- Surface agent polls Railway every 2s.
- Surface prints to **Windows default printer**.
- Surface updates job status back to Railway.

## 1) Railway environment variables
Set these in Railway service variables:

- `PRINT_PROVIDER=windows_agent`
- `PRINT_AGENT_TOKEN=<strong-random-token>`
- `PILOT_ORG_SLUG=chilli`
- Keep `PRINT_TEST_MODE` unset (or not `1`)

## 2) Windows prerequisites
On Surface Go 3:
1. Install Epson TM-T20III driver.
2. Print a Windows test page.
3. Set Epson TM-T20III as the **default printer**.
4. Install Node.js 18+.

## 3) Agent environment variables (PowerShell)
On Surface, in the folder containing `scripts/windows-print-agent.js`:

```powershell
$env:APP_BASE_URL = "https://YOUR-RAILWAY-APP.up.railway.app"
$env:PRINT_AGENT_TOKEN = "<same token as Railway PRINT_AGENT_TOKEN>"
$env:POLL_INTERVAL_MS = "2000"
$env:AGENT_STATE_FILE = "C:\\saadi-print-agent\\state.json"
$env:AGENT_TEMP_DIR = "C:\\saadi-print-agent\\tmp"
node .\scripts\windows-print-agent.js
```

Expected logs:
- startup line with polling interval
- `Printing job=...`
- `Printed successfully job=...`

## 4) Install as startup task (Task Scheduler)
Create a task that starts at user logon.

```powershell
$taskName = "SaadiPrintAgent"
$nodePath = (Get-Command node.exe).Source
$scriptPath = "C:\\path\\to\\repo\\scripts\\windows-print-agent.js"

$action = New-ScheduledTaskAction -Execute $nodePath -Argument $scriptPath
$trigger = New-ScheduledTaskTrigger -AtLogOn

$envVars = @(
  "APP_BASE_URL=https://YOUR-RAILWAY-APP.up.railway.app",
  "PRINT_AGENT_TOKEN=<same token>",
  "POLL_INTERVAL_MS=2000",
  "AGENT_STATE_FILE=C:\\saadi-print-agent\\state.json",
  "AGENT_TEMP_DIR=C:\\saadi-print-agent\\tmp"
) -join "`0"

# cmd.exe wrapper to inject env and launch node
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c set `"$envVars`" && `"$nodePath`" `"$scriptPath`""

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Description "Saadi pull print agent"
```

## 5) Reliability notes
- Idempotency: agent keeps a local state file of printed `jobId`s and never intentionally prints same `jobId` twice.
- API idempotency: sending `sent` for an already sent job returns success.
- Graceful stop: SIGINT/SIGTERM stop loop safely.
- If poll/update fails due to network, agent logs error and retries next cycle.
