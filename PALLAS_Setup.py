"""
PALLAS Monitor — Setup & Launcher
Double-click from Explorer, or run from any terminal.
"""

import sys
import os
import subprocess

APP_DIR  = os.path.dirname(os.path.abspath(__file__))
APP_PY   = os.path.join(APP_DIR, 'app.py')
DESKTOP  = os.path.join(os.path.expanduser('~'), 'Desktop')
LNK_NAME = 'PALLAS Monitor.lnk'
LNK_PATH = os.path.join(DESKTOP, LNK_NAME)

_had_error = False


def banner():
    print()
    print('  +-----------------------------------------+')
    print('  |   PALLAS MONITOR -- Setup & Launcher    |')
    print('  +-----------------------------------------+')
    print()


def check_python():
    if sys.version_info < (3, 10):
        print(f'  ✗  Python 3.10+ is required. You have {sys.version}')
        print('     Download from https://www.python.org/downloads/')
        input('\n  Press Enter to close...')
        sys.exit(1)
    print(f'  ✓  Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')


def install_required():
    print('\n  Installing required packages...')
    try:
        subprocess.check_call(
            [sys.executable, '-m', 'pip', 'install', '--upgrade',
             'flask', 'psutil', 'pywebview'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        print('  ✓  flask, psutil, pywebview installed.')
    except subprocess.CalledProcessError as exc:
        global _had_error
        _had_error = True
        print(f'  ✗  Required package install failed: {exc}')
        print('     Run:  pip install flask psutil pywebview')


def install_optional():
    optional = ['nvidia-ml-py', 'GPUtil', 'wmi', 'pywin32']
    print('\n  Installing optional packages (non-fatal if unavailable)...')
    for pkg in optional:
        try:
            subprocess.check_call(
                [sys.executable, '-m', 'pip', 'install', pkg],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            print(f'  ✓  {pkg}')
        except Exception:
            print(f'  ○  {pkg} — skipped (not available on this platform)')


def create_shortcut():
    # Resolve pythonw.exe next to the current python.exe
    pythonw = sys.executable
    if os.path.basename(pythonw).lower() == 'python.exe':
        candidate = os.path.join(os.path.dirname(pythonw), 'pythonw.exe')
        if os.path.isfile(candidate):
            pythonw = candidate

    icon = pythonw  # use pythonw icon as fallback; swap if a .ico is ever added

    ps = (
        f'$ws = New-Object -ComObject WScript.Shell; '
        f'$s = $ws.CreateShortcut("{LNK_PATH}"); '
        f'$s.TargetPath = "{pythonw}"; '
        f'$s.Arguments = "\\"{APP_PY}\\""; '
        f'$s.WorkingDirectory = "{APP_DIR}"; '
        f'$s.IconLocation = "{icon}"; '
        f'$s.WindowStyle = 7; '
        f'$s.Save()'
    )
    try:
        subprocess.run(
            ['powershell', '-NoProfile', '-NonInteractive', '-Command', ps],
            check=True, capture_output=True, timeout=15,
        )
        print(f'\n  ✓  Desktop shortcut created: {LNK_NAME}')
    except Exception as exc:
        global _had_error
        _had_error = True
        print(f'\n  ✗  Could not create shortcut: {exc}')


def ask_launch():
    print()
    try:
        answer = input('  Launch PALLAS Monitor now? (y/n): ').strip().lower()
    except (EOFError, KeyboardInterrupt):
        answer = 'n'

    if answer == 'y':
        print('  Starting...\n')
        os.execv(sys.executable, [sys.executable, APP_PY])
    else:
        print('  You can launch anytime from your Desktop shortcut.')
        print()


if __name__ == '__main__':
    banner()
    check_python()
    install_required()
    install_optional()
    create_shortcut()
    ask_launch()

    if _had_error:
        input('\n  Press Enter to close...')
