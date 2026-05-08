import time
import threading
import urllib.request
import os
from flask import Flask, render_template, jsonify, request
import psutil

app = Flask(__name__)

# ── Shared delta-calculation state ─────────────────────────────
_lock = threading.Lock()
_state: dict = {
    'prev_disk':           None,
    'prev_net':            None,
    'prev_time':           None,
    'cpu_percent':         0.0,
    'cpu_percent_percpu':  [],
    'cpu_temp':            None,
}
_tick = 0


# ── CPU background sampler ─────────────────────────────────────

def _cpu_sampler():
    global _tick
    # Prime both counters so the first real sample has a valid baseline.
    psutil.cpu_percent(interval=None)
    psutil.cpu_percent(interval=None, percpu=True)
    while True:
        time.sleep(1.0)
        pct      = psutil.cpu_percent(interval=None)
        per_core = psutil.cpu_percent(interval=None, percpu=True)
        temp     = _get_cpu_temp()
        _tick   += 1
        if _tick % 5 == 0:
            print(f'[PALLAS] tick={_tick} cpu={pct:.1f}% temp={temp}')
        with _lock:
            _state['cpu_percent']        = pct
            _state['cpu_percent_percpu'] = per_core
            _state['cpu_temp']           = temp


# ── CPU ────────────────────────────────────────────────────────

def _get_cpu():
    freq = psutil.cpu_freq()
    with _lock:
        pct      = _state['cpu_percent']
        per_core = list(_state['cpu_percent_percpu'])
        temp     = _state['cpu_temp']
    return {
        'percent':       pct,
        'per_core':      per_core,
        'freq_ghz':      round(freq.current / 1000, 2) if freq else None,
        'freq_max_ghz':  round(freq.max     / 1000, 2) if freq else None,
        'temperature':   temp,
        'temp_c':        temp,
        'count':         psutil.cpu_count(logical=False),
        'count_logical': psutil.cpu_count(logical=True),
    }


def _get_cpu_temp():
    # SOURCE 1: psutil (works on Linux/Mac, rarely Windows)
    try:
        temps = psutil.sensors_temperatures()
        if temps:
            for key in ('coretemp', 'cpu_thermal', 'k10temp', 'zenpower', 'acpitz'):
                if key in temps and temps[key]:
                    val = round(sum(r.current for r in temps[key]) / len(temps[key]), 1)
                    print(f'[PALLAS] cpu_temp via psutil/{key}: {val}°C')
                    return val
    except Exception as e:
        print(f'[PALLAS] cpu_temp psutil failed: {e}')

    # SOURCE 2: LibreHardwareMonitor WMI
    try:
        import wmi
        w = wmi.WMI(namespace=r'root\LibreHardwareMonitor')
        vals = [float(s.Value) for s in w.Sensor()
                if s.SensorType == 'Temperature' and 'CPU' in s.Name
                and 'Package' in s.Name]
        if not vals:
            vals = [float(s.Value) for s in w.Sensor()
                    if s.SensorType == 'Temperature' and 'CPU' in s.Name]
        if vals:
            val = round(sum(vals) / len(vals), 1)
            print(f'[PALLAS] cpu_temp via LibreHardwareMonitor: {val}°C')
            return val
    except Exception as e:
        print(f'[PALLAS] cpu_temp LibreHardwareMonitor failed: {e}')

    # SOURCE 3: OpenHardwareMonitor WMI
    try:
        import wmi
        w = wmi.WMI(namespace=r'root\OpenHardwareMonitor')
        vals = [float(s.Value) for s in w.Sensor()
                if s.SensorType == 'Temperature' and 'CPU' in s.Name]
        if vals:
            val = round(sum(vals) / len(vals), 1)
            print(f'[PALLAS] cpu_temp via OpenHardwareMonitor: {val}°C')
            return val
    except Exception as e:
        print(f'[PALLAS] cpu_temp OpenHardwareMonitor failed: {e}')

    # SOURCE 4: PowerShell MSAcpi_ThermalZoneTemperature (works on most Windows 11 machines)
    try:
        import subprocess
        cmd = (
            'Get-CimInstance -Namespace root/WMI '
            '-ClassName MSAcpi_ThermalZoneTemperature '
            '| Select-Object -ExpandProperty CurrentTemperature'
        )
        result = subprocess.run(
            ['powershell', '-NoProfile', '-NonInteractive', '-Command', cmd],
            capture_output=True, text=True, timeout=5,
        )
        lines = [l.strip() for l in result.stdout.strip().splitlines()
                 if l.strip().lstrip('-').isdigit()]
        if lines:
            val = round(max(float(x) for x in lines) / 10.0 - 273.15, 1)
            if 0 < val < 120:
                print(f'[PALLAS] cpu_temp via MSAcpi PowerShell: {val}°C')
                return val
        print(f'[PALLAS] cpu_temp MSAcpi stdout: {repr(result.stdout)} stderr: {repr(result.stderr)}')
    except Exception as e:
        print(f'[PALLAS] cpu_temp MSAcpi PowerShell failed: {e}')

    # SOURCE 5: Win32_PerfFormattedData_Counters_ThermalZoneInformation
    try:
        import subprocess
        cmd = (
            'Get-CimInstance -ClassName Win32_PerfFormattedData_Counters_ThermalZoneInformation '
            '| Select-Object -ExpandProperty Temperature'
        )
        result = subprocess.run(
            ['powershell', '-NoProfile', '-NonInteractive', '-Command', cmd],
            capture_output=True, text=True, timeout=5,
        )
        lines = [l.strip() for l in result.stdout.strip().splitlines()
                 if l.strip().isdigit()]
        if lines:
            val = round(max(float(x) for x in lines) - 273.15, 1)
            if 0 < val < 120:
                print(f'[PALLAS] cpu_temp via ThermalZoneInformation: {val}°C')
                return val
    except Exception as e:
        print(f'[PALLAS] cpu_temp ThermalZoneInformation failed: {e}')

    # SOURCE 6: Windows Registry thermal data (last-ditch)
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,
            r'SYSTEM\CurrentControlSet\Services\nvlddmkm\Parameters\Thermal')
        val, _ = winreg.QueryValueEx(key, 'CPUTemperature')
        if val and 0 < val < 120:
            print(f'[PALLAS] cpu_temp via registry: {val}°C')
            return float(val)
    except Exception:
        pass

    print('[PALLAS] cpu_temp: ALL SOURCES FAILED — returning None')
    return None


# ── RAM ────────────────────────────────────────────────────────

def _get_ram():
    vm = psutil.virtual_memory()
    return {
        'percent':      vm.percent,
        'used_gb':      round(vm.used      / 1024 ** 3, 2),
        'total_gb':     round(vm.total     / 1024 ** 3, 2),
        'available_gb': round(vm.available / 1024 ** 3, 2),
    }


# ── GPU ────────────────────────────────────────────────────────

def _get_gpu():
    try:
        import pynvml
        pynvml.nvmlInit()
        gpus = []
        for i in range(pynvml.nvmlDeviceGetCount()):
            h    = pynvml.nvmlDeviceGetHandleByIndex(i)
            name = pynvml.nvmlDeviceGetName(h)
            if isinstance(name, bytes):
                name = name.decode()
            util = pynvml.nvmlDeviceGetUtilizationRates(h)
            mem  = pynvml.nvmlDeviceGetMemoryInfo(h)
            temp = pynvml.nvmlDeviceGetTemperature(h, pynvml.NVML_TEMPERATURE_GPU)
            try:
                g_clock = pynvml.nvmlDeviceGetClockInfo(h, pynvml.NVML_CLOCK_GRAPHICS)
            except Exception:
                g_clock = None
            try:
                m_clock = pynvml.nvmlDeviceGetClockInfo(h, pynvml.NVML_CLOCK_MEM)
            except Exception:
                m_clock = None
            gpus.append({
                'name':          name,
                'load':          util.gpu,
                'vram_used_mb':  round(mem.used  / 1024 ** 2),
                'vram_total_mb': round(mem.total / 1024 ** 2),
                'temperature':   temp,
                'clock_mhz':     g_clock,
                'mem_clock_mhz': m_clock,
            })
        return gpus
    except Exception:
        pass

    try:
        import GPUtil
        return [{
            'name':          g.name,
            'load':          round(g.load * 100, 1),
            'vram_used_mb':  round(g.memoryUsed),
            'vram_total_mb': round(g.memoryTotal),
            'temperature':   g.temperature,
            'clock_mhz':     None,
            'mem_clock_mhz': None,
        } for g in GPUtil.getGPUs()]
    except Exception:
        pass

    return []


# ── Fans ───────────────────────────────────────────────────────

def _get_fans():
    fans = []
    try:
        fan_data = psutil.sensors_fans()
        if fan_data:
            for name, entries in fan_data.items():
                for e in entries:
                    fans.append({'name': e.label or name, 'rpm': e.current})
    except (AttributeError, Exception):
        pass

    if fans:
        return fans

    for ns in (r'root\OpenHardwareMonitor', r'root\LibreHardwareMonitor'):
        try:
            import wmi
            w = wmi.WMI(namespace=ns)
            for s in w.Sensor():
                if s.SensorType == 'Fan':
                    fans.append({'name': s.Name, 'rpm': round(float(s.Value))})
            if fans:
                return fans
        except Exception:
            continue

    return fans


# ── Disk ───────────────────────────────────────────────────────

def _get_disk(prev_disk, prev_time, now):
    partitions = []
    for part in psutil.disk_partitions(all=False):
        if 'cdrom' in part.opts or part.fstype == '':
            continue
        try:
            usage = psutil.disk_usage(part.mountpoint)
            partitions.append({
                'device':     part.device,
                'mountpoint': part.mountpoint,
                'percent':    usage.percent,
                'used_gb':    round(usage.used  / 1024 ** 3, 1),
                'total_gb':   round(usage.total / 1024 ** 3, 1),
            })
        except Exception:
            pass

    curr = psutil.disk_io_counters()
    read_mbps = write_mbps = 0.0
    if prev_disk and prev_time:
        dt = now - prev_time
        if dt > 0:
            read_mbps  = max(0.0, (curr.read_bytes  - prev_disk.read_bytes)  / dt / 1024 ** 2)
            write_mbps = max(0.0, (curr.write_bytes - prev_disk.write_bytes) / dt / 1024 ** 2)

    return {
        'read_mbps':  round(read_mbps,  2),
        'write_mbps': round(write_mbps, 2),
        'partitions': partitions,
    }, curr


# ── Network ────────────────────────────────────────────────────

def _get_network(prev_net, prev_time, now):
    curr = psutil.net_io_counters()
    up_mbps = down_mbps = 0.0
    if prev_net and prev_time:
        dt = now - prev_time
        if dt > 0:
            up_mbps   = max(0.0, (curr.bytes_sent - prev_net.bytes_sent) / dt / 1024 ** 2)
            down_mbps = max(0.0, (curr.bytes_recv - prev_net.bytes_recv) / dt / 1024 ** 2)
    return {
        'upload_mbps':   round(up_mbps,   3),
        'download_mbps': round(down_mbps, 3),
    }, curr


# ── Routes ─────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/create_shortcut', methods=['POST'])
def api_create_shortcut():
    try:
        data    = request.get_json(force=True) or {}
        version = str(data.get('version', '1.0')).strip() or '1.0'
        app_dir = os.path.dirname(os.path.abspath(__file__))
        bat     = os.path.join(app_dir, 'Launch PALLAS Monitor.bat')
        desktop = os.path.join(os.path.expanduser('~'), 'Desktop')
        lnk     = os.path.join(desktop, f'PALLAS Monitor v{version}.lnk')
        ps = (
            f'$ws = New-Object -ComObject WScript.Shell; '
            f'$s = $ws.CreateShortcut("{lnk}"); '
            f'$s.TargetPath = "{bat}"; '
            f'$s.WorkingDirectory = "{app_dir}"; '
            f'$s.WindowStyle = 7; '
            f'$s.Save()'
        )
        import subprocess
        subprocess.run(
            ['powershell', '-NoProfile', '-NonInteractive', '-Command', ps],
            check=True, capture_output=True, timeout=10,
        )
        return jsonify({'ok': True, 'path': lnk})
    except Exception as exc:
        return jsonify({'ok': False, 'error': str(exc)})


@app.route('/api/temp_debug')
def temp_debug():
    """Hit in browser to run all temp sources and see console output."""
    temp = _get_cpu_temp()
    return jsonify({'temp_c': temp, 'message': 'check console for source details'})


@app.route('/api/stats')
def api_stats():
    now = time.time()
    with _lock:
        prev_disk = _state['prev_disk']
        prev_net  = _state['prev_net']
        prev_time = _state['prev_time']

    disk,    curr_disk = _get_disk(prev_disk, prev_time, now)
    network, curr_net  = _get_network(prev_net, prev_time, now)

    with _lock:
        _state['prev_disk'] = curr_disk
        _state['prev_net']  = curr_net
        _state['prev_time'] = now

    return jsonify({
        'cpu':     _get_cpu(),
        'ram':     _get_ram(),
        'gpu':     _get_gpu(),
        'fans':    _get_fans(),
        'disk':    disk,
        'network': network,
    })


# ── Entry point ────────────────────────────────────────────────

if __name__ == '__main__':
    threading.Thread(target=_cpu_sampler, daemon=True).start()

    with _lock:
        _state['prev_disk'] = psutil.disk_io_counters()
        _state['prev_net']  = psutil.net_io_counters()
        _state['prev_time'] = time.time()

    print('\n   P A L L A S   M O N I T O R')
    print('   ──────────────────────────────')

    flask_thread = threading.Thread(
        target=lambda: app.run(host='localhost', port=5000, debug=False, use_reloader=False),
        daemon=True,
    )
    flask_thread.start()

    # Wait for Flask to be ready (up to 5 s)
    for _ in range(20):
        try:
            urllib.request.urlopen('http://localhost:5000', timeout=0.3)
            break
        except Exception:
            time.sleep(0.25)

    try:
        import webview

        class _WindowAPI:
            def __init__(self):
                self._maximized = False

            def minimize(self):
                _win.minimize()

            def toggle_maximize(self):
                self._maximized = not self._maximized
                if self._maximized:
                    _win.maximize()
                else:
                    _win.restore()

            def close(self):
                _win.destroy()

        _api = _WindowAPI()
        _win = webview.create_window(
            'PALLAS Monitor',
            'http://localhost:5000',
            width=1400,
            height=900,
            resizable=True,
            frameless=True,
            easy_drag=True,
            js_api=_api,
        )
        print('   Launching desktop window...\n')
        webview.start()

    except ImportError:
        import webbrowser
        print('   pywebview not installed — falling back to browser.')
        print('   Install with:  pip install pywebview')
        print('   http://localhost:5000')
        print('   Press Ctrl+C to stop.\n')
        webbrowser.open('http://localhost:5000')
        try:
            flask_thread.join()
        except KeyboardInterrupt:
            pass
