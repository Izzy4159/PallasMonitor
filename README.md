# PALLAS Monitor

A real-time system monitor for Windows — CPU, RAM, GPU, cooling, storage, and network — running as a native desktop window built on Flask + pywebview. No Node.js. No Electron. No browser tab.

---

## Quick Start

1. Double-click **`PALLAS_Setup.py`** — installs everything and creates your Desktop shortcut
2. Double-click **PALLAS Monitor** on your Desktop to launch
3. That's it. No Node.js, no npm, no Electron required.

---

## Features

| Section       | Color  | What it shows |
|---------------|--------|---------------|
| PROCESSOR     | Red    | Usage %, per-core bars, clock frequency, **CPU temperature**, sparkline |
| MEMORY        | Blue   | Usage %, used/free GB, progress bar, sparkline |
| GPU           | Purple | Load %, VRAM used/total, temperature, core/mem clocks, sparkline |
| COOLING       | Yellow | Fan RPM per sensor |
| STORAGE       | Orange | Read/Write MB/s, per-drive usage bars |
| NETWORK       | Cyan   | Upload/Download MB/s, sparkline |

**Customization** — In-app ⚙ settings panel:
- Font size slider (10–22 px, live preview)
- Per-card graph type (Line / Area / Bar / Step)
- 5 color themes (Default, Ice, Fire, Mono, Neon)
- Per-card accent color pickers
- Drag-to-reorder dashboard cards
- One-click Desktop shortcut creator (versioned .lnk)

**Native window** — pywebview frameless OS window, minimize/maximize/close  
**Live polling** — updates every 1.5 seconds  
**Accurate CPU sampling** — background thread samples at 1 s intervals, first-call zero avoided  
**Zoom** — Ctrl+= / Ctrl+− or +/− buttons, 75–200%, saved to localStorage

---

## Graph Types

Each sparkline card has its own graph type setting, saved per-session:

| Type | Description |
|------|-------------|
| **Line** | Clean stroke line, no fill |
| **Area** | Stroke line with semi-transparent fill below |
| **Bar**  | Vertical bar per sample point |
| **Step** | Staircase (horizontal then vertical segments) |

---

## Customization

Click **⚙** in the title bar to open the settings panel:

| Control | Effect |
|---------|--------|
| Font Size slider | Scales the entire UI (10–22 px), stored in `localStorage` |
| Graph Types | Per-card selector — Processor, Memory, GPU, Storage, Network |
| Theme | Default / Ice / Fire / Mono / Neon — changes all background and accent colors |
| Card Colors | Individual color pickers for each card accent |
| Card Order | Drag list to reorder dashboard cards |
| Desktop Shortcut | Creates a versioned `.lnk` on your Desktop |

All preferences are stored in browser `localStorage` and restored on next launch.

---

## CPU Temperature

Temperature is auto-detected by trying six sources in order. Every attempt prints its result to the console so you can see exactly which source is working.

| # | Source | When it works |
|---|--------|--------------|
| 1 | `psutil.sensors_temperatures()` | Linux / Mac natively |
| 2 | WMI `root\LibreHardwareMonitor` | Windows with LHM running |
| 3 | WMI `root\OpenHardwareMonitor` | Windows with OHM running |
| 4 | PowerShell `MSAcpi_ThermalZoneTemperature` | Most Windows 11 machines (no extra software) |
| 5 | PowerShell `Win32_PerfFormattedData_Counters_ThermalZoneInformation` | Alternative Windows path |
| 6 | Windows Registry thermal data | Last-ditch fallback |

All sources run in the background sampler thread — they never block the UI or the API response.

**Debug endpoint:** visit `http://localhost:5000/api/temp_debug` while the app is running to trigger all sources in sequence and see the results in the console.

**Best results on Windows:** run [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) in the background. PALLAS picks up its WMI sensor data automatically.

Temperature colors: white (≤70°C) → orange (#f07030, >70°C) → red (#e84040, >85°C).

---

## Typography & Visual Design

The dashboard is designed for instant at-a-glance readability:

**Bold high-contrast values**
- Primary metric numbers (CPU %, RAM %, GPU %) are rendered at 4rem / weight 900 with `letter-spacing: -1px` and `text-shadow: 0 0 24px currentColor` — they glow in their card's accent color
- Stat row values (GHz, GB, MHz) use weight 700 and `--text-bright` (#f0f4ff) to stand out clearly against the dark background
- Stat labels (FREQ, TEMP, USED) use weight 600 and tracked uppercase lettering in `--text-dim`

**Per-card accent borders**  
Each card has a 3 px left border in its unique accent color, making cards instantly identifiable at a glance even at peripheral vision.

**Per-card glow colors**

| Card | Accent | Glow |
|------|--------|------|
| PROCESSOR | `#ff4444` | Red |
| MEMORY | `#4488ff` | Blue |
| GPU | `#aa44ff` | Purple |
| COOLING | `#ffcc00` | Yellow |
| STORAGE | `#ff8800` | Orange |
| NETWORK | `#00cccc` | Cyan |

**Base font size:** 14 px default (was 12 px). Adjustable via the font-size slider (10–22 px).

**Active settings buttons** (graph type, theme) use amber `#c8860a` to stand out clearly against the dark settings panel.

---

## Desktop Shortcut

**`PALLAS_Setup.py`** — run it once (or whenever you update):

- Checks Python version (3.10+ required)
- Installs / upgrades required packages: `flask`, `psutil`, `pywebview`
- Installs optional packages: `nvidia-ml-py`, `GPUtil`, `wmi`, `pywin32`
- Creates / overwrites `PALLAS Monitor.lnk` on your Desktop pointing to `pythonw.exe app.py`
- Optionally launches the app immediately

**Versioned shortcuts** via the in-app shortcut creator (⚙ → Desktop Shortcut):  
Type a version string and click **Create .lnk** to put `PALLAS Monitor v1.2.lnk` on your Desktop.

---

## Dependencies

### Required

| Package | Purpose |
|---------|---------|
| `flask` | Local web server (port 5000) |
| `psutil` | CPU, RAM, disk, network metrics |
| `pywebview` | Native OS desktop window |

### Optional (installed by PALLAS_Setup.py, graceful fallback if missing)

| Package | Purpose |
|---------|---------|
| `nvidia-ml-py` | NVIDIA GPU metrics via pynvml |
| `GPUtil` | GPU fallback |
| `wmi` | Windows sensor data (fans, CPU temp via LHM) |
| `pywin32` | Required by `wmi` on Windows |

### Not required

Node.js / npm / Electron have been **removed**. The app is pure Python + pywebview.

---

## How It Works

```
Double-click PALLAS Monitor (Desktop shortcut)
  └─ pythonw.exe app.py
       ├─ Background thread: samples CPU % + temperature every 1 s
       ├─ Flask starts on localhost:5000
       └─ pywebview creates native OS window → http://localhost:5000
            └─ Frontend polls /api/stats every 1.5 s
                 └─ JSON: { cpu, ram, gpu, fans, disk, network }
```

pywebview closes the window and terminates Flask when the user closes.  
Browser fallback: if pywebview is not installed, `webbrowser.open()` opens the dashboard in the default browser instead.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.10+, Flask |
| Metrics | psutil, pynvml (NVIDIA), WMI |
| Desktop window | pywebview 4.4+ |
| Frontend | Vanilla JS, HTML5 Canvas (sparklines), CSS custom properties |

---

## File Inventory

```
PallasMonitor/
├── app.py                       # Flask server + all metric collection
├── PALLAS_Setup.py              # One-click setup + Desktop shortcut creator
├── Launch PALLAS Monitor.bat    # Minimal launcher (pip install pywebview, then pythonw app.py)
├── requirements.txt             # Python dependencies
├── templates/
│   └── index.html               # Dashboard HTML + settings panel
└── static/
    ├── css/style.css            # Dark theme + themes + settings panel styles
    └── js/app.js                # Polling, rendering, sparklines, settings logic
```

---

## Window Controls

```
◈  PALLAS MONITOR                          ⚙  ─  □  ✕
                                      settings  min max close
```

Drag the title bar to move the window (pywebview `easy_drag=True`).

---

## Manual Launch

```bash
python app.py
# or, no console window:
pythonw app.py
```

Then open http://localhost:5000 in a browser if pywebview is not installed.
