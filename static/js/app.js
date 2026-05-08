/* ================================================================
   PALLAS Monitor — Frontend
   ================================================================ */

const POLL_MS  = 1500;
const HIST_LEN = 60;

// ── History buffers ────────────────────────────────────────────
const hist = {
  cpu:     [],
  ram:     [],
  gpu:     [],
  netUp:   [],
  netDown: [],
};

let maxNet = 0.5;

// ── CSS variable helpers ───────────────────────────────────────
function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setCSSVar(name, value) {
  document.documentElement.style.setProperty(name, value);
}

// ── Settings: restore from localStorage on load ────────────────
(function restoreSettings() {
  // Theme
  const theme = localStorage.getItem('pallasTheme') || 'default';
  if (theme !== 'default') {
    document.documentElement.setAttribute('data-theme', theme);
  }
  document.querySelectorAll('#theme-btns .seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  // Font size
  const fontSize = localStorage.getItem('pallasFontSize');
  if (fontSize) {
    setCSSVar('--font-size', fontSize + 'px');
    const slider  = document.getElementById('font-size-slider');
    const display = document.getElementById('font-size-value');
    if (slider)  slider.value        = fontSize;
    if (display) display.textContent = fontSize + 'px';
  }

  // Card order
  const cardOrder = JSON.parse(localStorage.getItem('pallasCardOrder') || 'null');
  if (cardOrder) {
    const dashboard = document.querySelector('.dashboard');
    const orderList = document.getElementById('card-order-list');
    cardOrder.forEach(id => {
      const card = document.getElementById(id);
      if (card && dashboard) dashboard.appendChild(card);
      const li = orderList && orderList.querySelector(`[data-card="${id}"]`);
      if (li) orderList.appendChild(li);
    });
  }

  // Card accent colors
  ['cpu', 'ram', 'gpu', 'fans', 'disk', 'network'].forEach(card => {
    const color = localStorage.getItem('pallasColor_' + card);
    if (color) {
      setCSSVar('--accent-' + card, color);
      const picker = document.querySelector(`.color-pick[data-card="${card}"]`);
      if (picker) picker.value = color;
    }
  });

  // Per-card graph type active buttons
  document.querySelectorAll('.btn-group[data-graph-target]').forEach(group => {
    const key   = 'pallasGraphType_' + group.dataset.graphTarget;
    const saved = localStorage.getItem(key) || 'line';
    group.querySelectorAll('.graph-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === saved);
    });
  });
})();

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

document.getElementById('zoom-in').addEventListener('click',  () => applyZoom(currentZoom + ZOOM_STEP));
document.getElementById('zoom-out').addEventListener('click', () => applyZoom(currentZoom - ZOOM_STEP));

document.addEventListener('keydown', e => {
  if (e.ctrlKey && (e.key === '=' || e.key === '+')) { e.preventDefault(); applyZoom(currentZoom + ZOOM_STEP); }
  if (e.ctrlKey && e.key === '-')                    { e.preventDefault(); applyZoom(currentZoom - ZOOM_STEP); }
});

applyZoom(currentZoom);

// ── Window Controls ────────────────────────────────────────────
function tbMinimize() {
  if (window.pywebview) window.pywebview.api.minimize();
}
function tbMaximize() {
  if (window.pywebview) window.pywebview.api.toggle_maximize();
}
function tbClose() {
  if (window.pywebview) window.pywebview.api.close();
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
  if (val >= crit)      el.classList.add('c-crit');
  else if (val >= warn) el.classList.add('c-warn');
}

function hexToRgba(hex, alpha) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return `rgba(128,128,128,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── CPU Temperature ────────────────────────────────────────────
function updateCpuTemp(temp) {
  const el = document.getElementById('cpu-temp');
  if (!el) {
    console.warn('[PALLAS] #cpu-temp element not found in DOM');
    return;
  }
  if (temp == null) {
    el.textContent = '—';
    el.style.color = '';
  } else {
    el.textContent = Math.round(temp);
    if (temp > 85)      el.style.color = '#e84040';
    else if (temp > 70) el.style.color = '#f07030';
    else                el.style.color = '';
  }
}

// ── Sparkline renderer ─────────────────────────────────────────
// cardKey: 'cpu' | 'memory' | 'gpu' | 'storage' | 'network'
function drawSparkline(id, data, maxVal, strokeColor, cardKey) {
  const canvas = document.getElementById(id);
  if (!canvas || data.length < 2) return;

  canvas.width  = canvas.offsetWidth  || canvas.clientWidth  || 280;
  canvas.height = canvas.offsetHeight || canvas.clientHeight || 90;

  const ctx   = canvas.getContext('2d');
  const W     = canvas.width;
  const H     = canvas.height;
  const PAD   = 4;
  const gtype = localStorage.getItem('pallasGraphType_' + cardKey) || 'line';

  ctx.clearRect(0, 0, W, H);

  const max      = Math.max(maxVal || 100, ...data, 1);
  const stroke   = strokeColor || 'rgba(200,170,132,0.6)';
  const fillRgba = hexToRgba(stroke, 0.2);

  const pts = data.map((v, i) => ({
    x: (i / (HIST_LEN - 1)) * W,
    y: H - PAD - ((v / max) * (H - PAD * 2)),
  }));

  if (gtype === 'bar') {
    const barW = Math.max(1, (W / HIST_LEN) * 0.7);
    ctx.fillStyle = stroke;
    pts.forEach(p => ctx.fillRect(p.x - barW / 2, p.y, barW, H - PAD - p.y));
    return;
  }

  // Build line / area / step path
  ctx.beginPath();
  if (gtype === 'step') {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
    }
  } else {
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  }

  if (gtype === 'area') {
    ctx.lineTo(pts[pts.length - 1].x, H - PAD);
    ctx.lineTo(pts[0].x, H - PAD);
    ctx.closePath();
    ctx.fillStyle = fillRgba;
    ctx.fill();
    // Redraw stroke path on top
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  }

  ctx.strokeStyle = stroke;
  ctx.lineWidth   = 1.5;
  ctx.lineJoin    = 'round';
  ctx.lineCap     = 'round';
  ctx.stroke();
}

// ── CPU ────────────────────────────────────────────────────────
function updateCPU(cpu) {
  const pct = Math.round(cpu.percent);
  push(hist.cpu, pct);

  const el = document.getElementById('cpu-percent');
  el.textContent = pct;
  recolor(el, pct);

  document.getElementById('cpu-freq').textContent = cpu.freq_ghz ? f(cpu.freq_ghz, 2) : '—';

  updateCpuTemp(cpu.temperature);

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
    if (v >= 90)      fill.classList.add('crit');
    else if (v >= 75) fill.classList.add('warn');
    if (label) label.textContent = Math.round(v);
  });

  const col = getCSSVar('--accent-cpu') || '#ff4444';
  drawSparkline('spark-cpu', hist.cpu, 100, col, 'cpu');
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

  document.getElementById('ram-bar').style.width = `${pct}%`;

  const col = getCSSVar('--accent-ram') || '#4488ff';
  drawSparkline('spark-ram', hist.ram, 100, col, 'memory');
}

// ── GPU ────────────────────────────────────────────────────────
function updateGPU(gpus) {
  const col = getCSSVar('--accent-gpu') || '#aa44ff';
  if (!gpus || gpus.length === 0) {
    document.getElementById('gpu-load').textContent = '—';
    document.getElementById('gpu-name').textContent = 'No GPU detected';
    push(hist.gpu, 0);
    drawSparkline('spark-gpu', hist.gpu, 100, col, 'gpu');
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

  drawSparkline('spark-gpu', hist.gpu, 100, col, 'gpu');
}

// ── Fans ───────────────────────────────────────────────────────
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
  const col = getCSSVar('--accent-network') || '#00cccc';
  drawSparkline('spark-net', combined, maxNet * 2, col, 'network');
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

    console.log('[PALLAS] CPU temp:', data.cpu.temperature, '°C  (temp_c:', data.cpu.temp_c, ')');

    const now = new Date();
    document.getElementById('last-update').textContent =
      now.toLocaleTimeString('en-US', { hour12: false });
  } catch (err) {
    console.warn('[PALLAS] poll error:', err);
  }
}

poll();
setInterval(poll, POLL_MS);

// ── Settings Panel toggle ──────────────────────────────────────
document.getElementById('btn-settings').addEventListener('click', () => {
  document.getElementById('settings-panel').classList.toggle('hidden');
});

document.getElementById('btn-settings-close').addEventListener('click', () => {
  document.getElementById('settings-panel').classList.add('hidden');
});

// ── Font size slider (input fires on drag; change fires on release) ──
const fontSlider  = document.getElementById('font-size-slider');
const fontDisplay = document.getElementById('font-size-value');

fontSlider.addEventListener('input', function () {
  const val = this.value;
  setCSSVar('--font-size', val + 'px');
  fontDisplay.textContent = val + 'px';
  localStorage.setItem('pallasFontSize', val);
});

fontSlider.addEventListener('change', function () {
  localStorage.setItem('pallasFontSize', this.value);
});

// ── Theme buttons ──────────────────────────────────────────────
document.querySelectorAll('#theme-btns .seg-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    if (theme === 'default') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('pallasTheme', theme);
    document.querySelectorAll('#theme-btns .seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Per-card graph type buttons ────────────────────────────────
document.querySelectorAll('.btn-group[data-graph-target]').forEach(group => {
  const target     = group.dataset.graphTarget;
  const storageKey = 'pallasGraphType_' + target;

  group.querySelectorAll('.graph-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      localStorage.setItem(storageKey, btn.dataset.type);
      group.querySelectorAll('.graph-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
});

// ── Card color pickers ─────────────────────────────────────────
document.querySelectorAll('.color-pick').forEach(picker => {
  picker.addEventListener('input', () => {
    const card  = picker.dataset.card;
    const color = picker.value;
    setCSSVar('--accent-' + card, color);
    localStorage.setItem('pallasColor_' + card, color);
  });
});

// ── Card order drag-and-drop ───────────────────────────────────
(function initCardOrder() {
  const list      = document.getElementById('card-order-list');
  const dashboard = document.querySelector('.dashboard');
  let dragging    = null;

  list.querySelectorAll('.order-item').forEach(item => {
    item.addEventListener('dragstart', () => {
      dragging = item;
      item.style.opacity = '0.4';
    });
    item.addEventListener('dragend', () => {
      dragging = null;
      item.style.opacity = '';
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragging || dragging === item) return;
      const rect  = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      list.insertBefore(dragging, after ? item.nextSibling : item);
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      const order = [];
      list.querySelectorAll('.order-item').forEach(li => {
        const id   = li.dataset.card;
        order.push(id);
        const card = document.getElementById(id);
        if (card) dashboard.appendChild(card);
      });
      localStorage.setItem('pallasCardOrder', JSON.stringify(order));
    });
  });
})();

// ── Shortcut creator ───────────────────────────────────────────
document.getElementById('btn-make-shortcut').addEventListener('click', async () => {
  const version = document.getElementById('shortcut-version').value.trim() || '1.0';
  const status  = document.getElementById('shortcut-status');
  status.textContent = 'Creating…';
  status.style.color = '';

  try {
    const res  = await fetch('/api/create_shortcut', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ version }),
    });
    const data = await res.json();
    if (data.ok) {
      status.textContent = '✓ ' + data.path;
      status.style.color = '#00cc88';
    } else {
      status.textContent = '✗ ' + data.error;
      status.style.color = '#ff4444';
    }
  } catch (err) {
    status.textContent = '✗ ' + err.message;
    status.style.color = '#ff4444';
  }
});
