<<<<<<< HEAD
# PALLAS Monitor

A real-time system monitor for Windows — CPU, RAM, GPU, cooling, storage, and network — running as a standalone native desktop window built on Flask + pywebview.

---

## Quick Start

Double-click **`run.bat`**

It will install all dependencies automatically and launch the app in a native desktop window.

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

| Section    | Color  | What it shows |
|------------|--------|---------------|
| PROCESSOR  | Red    | Usage %, per-core bars, frequency, temperature, sparkline |
| MEMORY     | Blue   | Usage %, used/free GB, progress bar, sparkline |
| GPU        | Purple | Load %, VRAM, temperature, core/mem clocks, sparkline |
| COOLING    | Yellow | Fan RPM for each sensor |
| STORAGE    | Orange | Read/Write MB/s, per-drive usage bars |
| NETWORK    | Cyan   | Upload/Download MB/s, sparkline |

- **Native window** — frameless pywebview window, no browser required
- **Custom title bar** — minimize, maximize/restore, close
- **Zoom controls** — `Ctrl+=` / `Ctrl+-` or the +/− buttons; saved between sessions
- **Live polling** — updates every 1.5 seconds

---

## Zoom

| Action | Effect |
|--------|--------|
| `Ctrl+=` or `+` button | Zoom in (+10%) |
| `Ctrl+-` or `−` button | Zoom out (−10%) |

Range: 75% – 200%. Default: 125%. Preference is saved to `localStorage`.

---

## Window Controls

The app runs frameless with a custom title bar across the top:

```
◈  PALLAS MONITOR                              ─   □   ✕
                                           min max close
```

Drag the title bar (or any empty area of the window) to move it.

---

## Dependencies

Installed automatically by `run.bat`:

| Package | Purpose |
|---------|---------|
| `flask` | Local web server (port 5000) |
| `psutil` | CPU, RAM, disk, network metrics |
| `pywebview` | Native desktop window |
| `nvidia-ml-py` | NVIDIA GPU metrics *(optional)* |
| `GPUtil` | GPU fallback *(optional)* |
| `wmi` / `pywin32` | Windows sensor access *(optional)* |

**For fan speeds and CPU temperatures on Windows**, run [LibreHardwareMonitor](https://github.com/LibreHardwareMonitor/LibreHardwareMonitor) in the background. PALLAS will pick up its WMI sensor data automatically.

---

## Manual Launch

```bash
pip install -r requirements.txt
python app.py
```

If `pywebview` is not installed the app falls back to opening in the default browser.

---

## Files

```
PallasMonitor/
├── app.py                      # Flask server + pywebview launcher
├── run.bat                     # One-click launch (installs deps, starts app)
├── Launch PALLAS Monitor.bat   # Silent launcher (used by the Desktop shortcut)
├── CreateShortcut.ps1          # Creates a Desktop .lnk pointing to the bat
├── requirements.txt
├── templates/
│   └── index.html
└── static/
    ├── css/style.css
    └── js/app.js
```
=======
# PallasMonitor
Desktop system monitor — CPU, GPU, RAM, fans, disk, network
>>>>>>> ed6e6051ef0210a004834a7a3315cff9f21b4e8e
