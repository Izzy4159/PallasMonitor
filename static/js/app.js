/* ================================================================
   PALLAS Monitor — Frontend
   ================================================================ */

const POLL_MS    = 1500;
const HIST_LEN   = 60;

const COLORS = {
  cpu:     '#ff4444',
  ram:     '#4488ff',
  gpu:     '#aa44ff',
  netUp:   '#00cccc',
  netDown: 'rgba(0,204,204,0.45)',
};

// ── History buffers ────────────────────────────────────────────
const hist = {
  cpu:     [],
  ram:     [],
  gpu:     [],
  netUp:   [],
  netDown: [],
};

let maxNet = 0.5;

// ── Zoom ───────────────────────────────────────────────────────

const ZOOM_KEY     = 'pallas_zoom';
const ZOOM_MIN     = 75;
const ZOOM_MAX     = 200;
const ZOOM_STEP    = 10;
const ZOOM_DEFAULT = 125;

let currentZoom = parseInt(localStorage.getItem(ZOOM_KEY) || ZOOM_DEFAULT, 10);

function applyZoom(z) {
  currentZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
  document.documentElement.style.zoom = `${currentZoom}%`;
  document.getElementById('zoom-level').textContent = `${currentZoom}%`;
  localStorage.setItem(ZOOM_KEY, currentZoom);
}

document.getElementById('zoom-in').addEventListener('click', () => applyZoom(currentZoom + ZOOM_STEP));
document.getElementById('zoom-out').addEventListener('click', () => applyZoom(currentZoom - ZOOM_STEP));

document.addEventListener('keydown', e => {
  if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); applyZoom(currentZoom + ZOOM_STEP); }
  if (e.ctrlKey && e.key === '-')                    { e.preventDefault(); applyZoom(currentZoom - ZOOM_STEP); }
});

applyZoom(currentZoom);

// ── Window Controls ────────────────────────────────────────────

function tbMinimize() {
  if (window.electronAPI) window.electronAPI.minimize();
  else if (window.pywebview) window.pywebview.api.minimize();
}
function tbMaximize() {
  if (window.electronAPI) window.electronAPI.toggleMaximize();
  else if (window.pywebview) window.pywebview.api.toggle_maximize();
}
function tbClose() {
  if (window.electronAPI) window.electronAPI.close();
  else if (window.pywebview) window.pywebview.api.close();
}

// ── Utility helpers ────────────────────────────────────────────

function f(val, dec = 1) {
  if (val === null || val === undefined) return '—';
  return Number(val).toFixed(dec);
}

function push(arr, val) {
  arr.push(val ?? 0);
  if (arr.length > HIST_LEN) arr.shift();
}

function recolor(el, val, warn = 75, crit = 90) {
  el.classList.remove('c-warn', 'c-crit');
  if (val >= crit) el.classList.add('c-crit');
  else if (val >= warn) el.classList.add('c-warn');
}

// ── Sparkline renderer ─────────────────────────────────────────

function drawSparkline(id, data, maxVal, strokeColor, fillColor) {
  const canvas = document.getElementById(id);
  if (!canvas || data.length < 2) return;

  const r = canvas.getBoundingClientRect();
  canvas.width  = r.width  || 280;
  canvas.height = r.height || 48;

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const max = Math.max(maxVal || 100, ...data, 1);
  const PAD = 4;

  const pts = data.map((v, i) => ({
    x: (i / (HIST_LEN - 1)) * W,
    y: H - PAD - ((v / max) * (H - PAD * 2)),
  }));

  // Area fill
  ctx.beginPath();
  ctx.moveTo(pts[0].x, H);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, H);
  ctx.closePath();
  ctx.fillStyle = fillColor || 'rgba(200,170,132,0.05)';
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = strokeColor || 'rgba(200,170,132,0.6)';
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.stroke();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── CPU ────────────────────────────────────────────────────────

function updateCPU(cpu) {
  const pct = Math.round(cpu.percent);
  push(hist.cpu, pct);

  const el = document.getElementById('cpu-percent');
  el.textContent = pct;
  recolor(el, pct);

  const freqEl = document.getElementById('cpu-freq');
  freqEl.textContent = cpu.freq_ghz ? f(cpu.freq_ghz, 2) : '—';

  const tempEl = document.getElementById('cpu-temp');
  if (cpu.temperature != null) {
    tempEl.textContent = Math.round(cpu.temperature);
    recolor(tempEl, cpu.temperature, 75, 90);
  } else {
    tempEl.textContent = '—';
  }

  const metaEl = document.getElementById('cpu-meta');
  if (cpu.count) metaEl.textContent = `${cpu.count}C / ${cpu.count_logical}T`;

  const grid  = document.getElementById('cpu-cores');
  const cores = cpu.per_core || [];
  if (cores.length && grid.children.length !== cores.length) {
    grid.innerHTML = '';
    cores.forEach((_, i) => {
      const cell = document.createElement('div');
      cell.className = 'core-cell';
      cell.innerHTML = `
        <div class="core-track">
          <div class="core-fill" id="cf-${i}"></div>
        </div>
        <span class="core-pct" id="cp-${i}">0</span>`;
      grid.appendChild(cell);
    });
  }
  cores.forEach((v, i) => {
    const fill  = document.getElementById(`cf-${i}`);
    const label = document.getElementById(`cp-${i}`);
    if (!fill) return;
    fill.style.height = `${v}%`;
    fill.classList.remove('warn', 'crit');
    if (v >= 90) fill.classList.add('crit');
    else if (v >= 75) fill.classList.add('warn');
    if (label) label.textContent = Math.round(v);
  });

  drawSparkline('spark-cpu', hist.cpu, 100,
    COLORS.cpu, hexToRgba(COLORS.cpu, 0.08));
}

// ── RAM ────────────────────────────────────────────────────────

function updateRAM(ram) {
  const pct = Math.round(ram.percent);
  push(hist.ram, pct);

  const el = document.getElementById('ram-percent');
  el.textContent = pct;
  recolor(el, pct, 80, 92);

  document.getElementById('ram-used').textContent = f(ram.used_gb, 1);
  document.getElementById('ram-free').textContent = f(ram.available_gb, 1);
  document.getElementById('ram-meta').textContent = `${f(ram.total_gb, 0)} GB TOTAL`;

  const bar = document.getElementById('ram-bar');
  bar.style.width = `${pct}%`;

  drawSparkline('spark-ram', hist.ram, 100,
    COLORS.ram, hexToRgba(COLORS.ram, 0.08));
}

// ── GPU ────────────────────────────────────────────────────────

function updateGPU(gpus) {
  if (!gpus || gpus.length === 0) {
    document.getElementById('gpu-load').textContent = '—';
    document.getElementById('gpu-name').textContent = 'No GPU detected';
    push(hist.gpu, 0);
    drawSparkline('spark-gpu', hist.gpu, 100,
      COLORS.gpu, hexToRgba(COLORS.gpu, 0.08));
    return;
  }

  const g    = gpus[0];
  const load = Math.round(g.load);
  push(hist.gpu, load);

  const el = document.getElementById('gpu-load');
  el.textContent = load;
  recolor(el, load);

  document.getElementById('gpu-name').textContent = g.name || '—';

  const usedGB  = (g.vram_used_mb  / 1024).toFixed(1);
  const totalGB = (g.vram_total_mb / 1024).toFixed(1);
  document.getElementById('gpu-vram').textContent = `${usedGB} / ${totalGB}`;

  const tempEl = document.getElementById('gpu-temp');
  if (g.temperature != null) {
    tempEl.textContent = Math.round(g.temperature);
    recolor(tempEl, g.temperature, 75, 90);
  } else {
    tempEl.textContent = '—';
  }

  document.getElementById('gpu-clock').textContent  = g.clock_mhz    ?? '—';
  document.getElementById('gpu-mclock').textContent = g.mem_clock_mhz ?? '—';

  drawSparkline('spark-gpu', hist.gpu, 100,
    COLORS.gpu, hexToRgba(COLORS.gpu, 0.08));
}

// ── Fans ────────────────────────────────────────────────────────

function updateFans(fans) {
  const list = document.getElementById('fan-list');
  if (!fans || fans.length === 0) {
    list.innerHTML = `
      <div class="no-data">
        No fan sensors detected.<br>
        <small>Run LibreHardwareMonitor for fan &amp; temp data.</small>
      </div>`;
    document.getElementById('fans-meta').textContent = '';
    return;
  }

  document.getElementById('fans-meta').textContent = `${fans.length} SENSOR${fans.length > 1 ? 'S' : ''}`;
  list.innerHTML = fans.map(fan => `
    <div class="fan-item">
      <span class="fan-name">${fan.name.toUpperCase()}</span>
      <div class="fan-rpm-wrap">
        <span class="fan-rpm">${Math.round(fan.rpm).toLocaleString()}</span>
        <span class="fan-rpm-unit">RPM</span>
      </div>
    </div>`).join('');
}

// ── Disk ───────────────────────────────────────────────────────

function updateDisk(disk) {
  document.getElementById('disk-read').textContent  = f(disk.read_mbps,  2);
  document.getElementById('disk-write').textContent = f(disk.write_mbps, 2);

  const dl = document.getElementById('drive-list');
  dl.innerHTML = (disk.partitions || []).map(p => {
    const cls = p.percent >= 90 ? 'crit' : p.percent >= 75 ? 'warn' : '';
    return `
      <div class="drive-item">
        <div class="drive-info">
          <span class="drive-mp">${p.mountpoint || p.device}</span>
          <span class="drive-sz">${p.used_gb} / ${p.total_gb} GB &nbsp;·&nbsp; ${p.percent}%</span>
        </div>
        <div class="drive-track">
          <div class="drive-fill ${cls}" style="width:${p.percent}%"></div>
        </div>
      </div>`;
  }).join('');
}

// ── Network ────────────────────────────────────────────────────

function updateNetwork(net) {
  const up   = net.upload_mbps;
  const down = net.download_mbps;

  push(hist.netUp,   up);
  push(hist.netDown, down);

  maxNet = Math.max(maxNet, up, down, 0.5);

  document.getElementById('net-up').textContent   = f(up,   3);
  document.getElementById('net-down').textContent = f(down, 3);

  const combined = hist.netUp.map((v, i) => v + (hist.netDown[i] || 0));
  drawSparkline('spark-net', combined, maxNet * 2,
    COLORS.netUp, hexToRgba('#00cccc', 0.08));
}

// ── Main poll loop ─────────────────────────────────────────────

async function poll() {
  try {
    const res  = await fetch('/api/stats');
    if (!res.ok) return;
    const data = await res.json();

    updateCPU(data.cpu);
    updateRAM(data.ram);
    updateGPU(data.gpu);
    updateFans(data.fans);
    updateDisk(data.disk);
    updateNetwork(data.network);

    const now = new Date();
    document.getElementById('last-update').textContent =
      now.toLocaleTimeString('en-US', { hour12: false });

  } catch (err) {
    console.warn('[PALLAS] poll error:', err);
  }
}

poll();
setInterval(poll, POLL_MS);
