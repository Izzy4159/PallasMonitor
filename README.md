# PALLAS Monitor

A real-time system monitor for Windows — CPU, RAM, GPU, cooling, storage, and network — running as a standalone native desktop window built on Flask + Electron.

---

## Quick Start

Double-click **`Launch PALLAS Monitor.bat`**

It will install Node dependencies automatically on first run, then open the app as a frameless desktop window.

> **Prerequisites:** [Python 3.10+](https://www.python.org/downloads/) and [Node.js 18+](https://nodejs.org) must be in PATH.

---

## First-Time Setup

Install Python dependencies once:

```bash
pip install -r requirements.txt
```

Node dependencies (Electron) are installed automatically by the launcher on first run, or manually:

```bash
npm install
```

---

## Desktop Shortcut

Run **once** to put a shortcut on your Desktop:

```powershell
powershell -ExecutionPolicy Bypass -File .\CreateShortcut.ps1
```

Or right-click `CreateShortcut.ps1` → *Run with PowerShell*.

After that, double-click **PALLAS Monitor** on your Desktop to launch.

---

## Features

| Section   | Color  | What it shows |
|-----------|--------|---------------|
| PROCESSOR | Red    | Usage %, per-core bars, frequency, temperature, sparkline |
| MEMORY    | Blue   | Usage %, used/free GB, progress bar, sparkline |
| GPU       | Purple | Load %, VRAM, temperature, core/mem clocks, sparkline |
| COOLING   | Yellow | Fan RPM for each sensor |
| STORAGE   | Orange | Read/Write MB/s, per-drive usage bars |
| NETWORK   | Cyan   | Upload/Download MB/s, sparkline |

- **Native window** — frameless Electron window, no browser tab
- **Custom title bar** — minimize, maximize/restore, close
- **Zoom controls** — `Ctrl+=` / `Ctrl+-` or the +/− buttons; saved between sessions
- **Live polling** — updates every 1.5 seconds
- **Accurate CPU sampling** — background thread samples at 1 s intervals, no first-call zero reads

---

## Zoom

| Action | Effect |
|--------|--------|
| `Ctrl+=` or `+` button | Zoom in (+10%) |
| `Ctrl+-` or `−` button | Zoom out (−10%) |

Range: 75% – 200%. Default: 125%. Preference saved to `localStorage`.

---

## Window Controls

The app runs frameless with a custom title bar:

```
◈  PALLAS MONITOR                              ─   □   ✕
                                           min max close
```

Drag the title bar to move the window.

---

## Dependencies

### Python

| Package | Purpose |
|---------|---------|
| `flask` | Local web server (port 5000) |
| `psutil` | CPU, RAM, disk, network metrics |
| `nvidia-ml-py` | NVIDIA GPU metrics *(optional)* |
| `GPUtil` | GPU fallback *(optional)* |
| `wmi` / `pywin32` | Windows sensor access *(optional)* |

### Node

| Package | Purpose |
|---------|---------|
| `electron` | Native frameless desktop window |

**For fan speeds and CPU temperatures on Windows**, run [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) in the background. PALLAS will pick up its WMI sensor data automatically.

---

## How It Works

```
Launch PALLAS Monitor.bat
  └─ npm start
       └─ Electron (main.js)
            ├─ spawns: python app.py   ← Flask on port 5000
            ├─ polls localhost:5000 until ready
            └─ opens frameless BrowserWindow → http://localhost:5000
```

Electron kills the Flask process when the window is closed.

---

## Manual Launch (dev)

```bash
# Terminal 1 — Flask only
python app.py

# Terminal 2 — Electron window
npm start
```

Or use `run.bat` which installs Python deps, starts Flask, and keeps a visible console for debugging.

---

## Files

```
PallasMonitor/
├── app.py                      # Flask server + psutil data collection
├── main.js                     # Electron main process (spawns Flask, creates window)
├── preload.js                  # Electron preload (exposes window controls to renderer)
├── package.json                # Node manifest — "npm start" runs "electron ."
├── requirements.txt            # Python dependencies
├── run.bat                     # Dev launcher (console visible, installs Python deps)
├── Launch PALLAS Monitor.bat   # Silent launcher (used by Desktop shortcut)
├── CreateShortcut.ps1          # Creates a Desktop .lnk pointing to the bat
├── templates/
│   └── index.html
└── static/
    ├── css/style.css
    └── js/app.js
```
