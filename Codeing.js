/* ============================================================
   Codeing.js —— 所有功能
   目錄（搜尋 【區塊】 可快速跳轉）
   0. 【區塊】共用小工具與主題（淺色／深色）
   1. 【區塊】載入外部程式庫（Skulpt = Python、CodeMirror = 編輯器）
   2. 【區塊】程式碼編輯器（行號、語法上色）
   3. 【區塊】執行 Python
   4. 【區塊】顏色按鈕（線條／填色）
   5. 【區塊】範例選單
   6. 【區塊】無限畫布（平移、縮放、格線）
   7. 【區塊】表情貼紙
   8. 【區塊】拖曳調整分區大小
============================================================ */

/* ===================== 【區塊】0. 共用小工具與主題 ===================== */
const $ = id => document.getElementById(id);
const out = $('out'), graph = $('graph'), codeBox = $('code');
const runBtn = $('runBtn'), statusEl = $('status');
let skulptReady = false, running = false;
let cm = null;                       // CodeMirror 編輯器（載入失敗時維持 null，改用普通文字框）

// 淺色／深色：第一次打開預設淺色，之後記住選擇
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  $('themeBtn').textContent = t === 'dark' ? '☀️ 淺色' : '🌙 深色';
  try { localStorage.setItem('theme', t); } catch (e) { /* 部分瀏覽器不允許，忽略 */ }
}
let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
setTheme(savedTheme === 'dark' ? 'dark' : 'light');
$('themeBtn').onclick = () =>
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

/* ===================== 【區塊】1. 載入外部程式庫 ===================== */
// 依序嘗試網址清單，第一個失敗就換下一個（備用來源）
function loadScript(urls) {
  return new Promise((resolve, reject) => {
    let i = 0;
    (function next() {
      if (i >= urls.length) return reject(new Error('載入失敗'));
      const s = document.createElement('script');
      s.src = urls[i++];
      s.onload = resolve;
      s.onerror = () => { s.remove(); next(); };
      document.head.appendChild(s);
    })();
  });
}
function loadCss(urls) {
  return new Promise((resolve, reject) => {
    let i = 0;
    (function next() {
      if (i >= urls.length) return reject(new Error('載入失敗'));
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = urls[i++];
      l.onload = resolve;
      l.onerror = () => { l.remove(); next(); };
      document.head.appendChild(l);
    })();
  });
}

// Skulpt：在瀏覽器裡執行 Python
(async function initSkulpt() {
  try {
    await loadScript([
      'https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/skulpt/1.2.0/skulpt.min.js'
    ]);
    await loadScript([
      'https://cdn.jsdelivr.net/npm/skulpt@1.2.0/dist/skulpt-stdlib.js',
      'https://cdnjs.cloudflare.com/ajax/libs/skulpt/1.2.0/skulpt-stdlib.js'
    ]);
    skulptReady = true;
    runBtn.disabled = false;
    statusEl.textContent = '✅ 準備好了';
  } catch (e) {
    statusEl.textContent = '❌ Python 載入失敗';
    addOut('無法載入 Python 引擎，請確認電腦有連上網路後重新整理頁面。\n', true);
  }
})();

/* ===================== 【區塊】2. 程式碼編輯器 ===================== */
// CodeMirror 5：提供行號、Python 語法上色。載入失敗就保留原本的文字框。
(async function initEditor() {
  try {
    await loadCss([
      'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.css',
      'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.css'
    ]);
    await loadScript([
      'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/codemirror.min.js',
      'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/lib/codemirror.js'
    ]);
    await loadScript([
      'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/mode/python/python.min.js',
      'https://cdn.jsdelivr.net/npm/codemirror@5.65.16/mode/python/python.js'
    ]);
    cm = CodeMirror.fromTextArea(codeBox, {
      mode: 'python',
      theme: 'vscode',              // 對應 CSS 的 .cm-s-vscode
      lineNumbers: true,            // 左邊顯示行號
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      extraKeys: {
        Tab: c => c.somethingSelected() ? c.indentSelection('add') : c.replaceSelection('    ', 'end'),
        'Shift-Tab': c => c.indentSelection('subtract'),
        'Ctrl-Enter': () => runCode(),
        'Cmd-Enter': () => runCode()
      }
    });
    // 編輯區大小改變（拖曳分隔線）時，讓 CodeMirror 重新計算
    new ResizeObserver(() => cm.refresh()).observe($('editorHost'));
  } catch (e) {
    cm = null;                      // 退回普通文字框
  }
})();

// 文字框備用方案的快捷鍵（CodeMirror 載入成功後不會用到）
codeBox.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = codeBox.selectionStart, en = codeBox.selectionEnd;
    codeBox.value = codeBox.value.slice(0, s) + '    ' + codeBox.value.slice(en);
    codeBox.selectionStart = codeBox.selectionEnd = s + 4;
  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    runCode();
  }
});

// 讀取／寫入／在游標處插入文字（不管有沒有 CodeMirror 都能用）
function getCode() { return cm ? cm.getValue() : codeBox.value; }
function setCode(text) { if (cm) cm.setValue(text); else codeBox.value = text; }
function insertAtCursor(text) {
  if (cm) {
    cm.replaceSelection(text, 'end');
    cm.focus();
  } else {
    const s = codeBox.selectionStart, en = codeBox.selectionEnd;
    codeBox.value = codeBox.value.slice(0, s) + text + codeBox.value.slice(en);
    codeBox.selectionStart = codeBox.selectionEnd = s + text.length;
    codeBox.focus();
  }
}

/* ===================== 【區塊】3. 執行 Python ===================== */
function addOut(text, isErr) {
  if (isErr) {
    const span = document.createElement('span');
    span.className = 'err';
    span.textContent = text;
    out.appendChild(span);
  } else {
    out.appendChild(document.createTextNode(text));
  }
  out.scrollTop = out.scrollHeight;
}

function builtinRead(x) {
  if (Sk.builtinFiles === undefined || Sk.builtinFiles['files'][x] === undefined)
    throw "File not found: '" + x + "'";
  return Sk.builtinFiles['files'][x];
}

async function runCode() {
  if (!skulptReady || running) return;
  running = true;
  runBtn.disabled = true;
  statusEl.textContent = '執行中…';
  out.textContent = '';
  graph.innerHTML = '';                       // 清掉上一次的圖（貼紙保留）

  Sk.configure({
    output: t => addOut(t, false),
    read: builtinRead,
    __future__: Sk.python3,
    inputfun: p => { const v = prompt(p || ''); return v === null ? '' : v; },
    inputfunTakesPrompt: true,
    yieldLimit: 100,                          // 讓畫面可以即時更新、也能按「停止」
    execLimit: Number.POSITIVE_INFINITY
  });
  Sk.TurtleGraphics = { target: 'graph', width: WORLD, height: WORLD };

  try {
    await Sk.misceval.asyncToPromise(() =>
      Sk.importMainWithBody('<stdin>', false, getCode(), true));
  } catch (e) {
    if (e.toString().includes('TimeLimitError')) {
      addOut('\n⏹ 已停止執行\n', true);       // 按「停止」時顯示的友善訊息
    } else {
      addOut('\n' + e.toString() + '\n', true);
    }
  }
  running = false;
  runBtn.disabled = false;
  statusEl.textContent = '✅ 準備好了';
}

runBtn.onclick = runCode;
$('stopBtn').onclick = () => { if (running && window.Sk) Sk.execLimit = 1; };
$('clearBtn').onclick = () => {
  out.textContent = '';
  graph.innerHTML = '';
  $('stickers').innerHTML = '';
};

/* ===================== 【區塊】4. 顏色按鈕 ===================== */
// 點一下按鈕，就把「"顏色名稱"」（含引號）插入程式碼游標處，
// 學生自己決定要放進變數或 t.pencolor(...)／t.fillcolor(...) 裡。
const COLORS = [
  ['red', '紅'], ['orange', '橘'], ['gold', '金'], ['yellow', '黃'],
  ['green', '綠'], ['blue', '藍'], ['purple', '紫'], ['pink', '粉'],
  ['brown', '棕'], ['black', '黑'], ['gray', '灰'], ['white', '白']
];
function makePalette(rowId, kind, hint) {
  const row = $(rowId);
  COLORS.forEach(([name, zh]) => {
    const b = document.createElement('button');
    b.className = 'sw ' + kind;
    b.title = zh + '  "' + name + '"';
    if (kind === 'line') b.style.borderColor = name;   // 線條：圓環
    else b.style.background = name;                    // 填色：實心方塊
    b.addEventListener('mousedown', e => e.preventDefault());   // 不要搶走編輯器的游標
    b.addEventListener('click', () => insertAtCursor('"' + name + '"'));
    row.appendChild(b);
  });
  const h = document.createElement('span');
  h.className = 'pal-hint';
  h.textContent = hint;
  row.appendChild(h);
}
makePalette('lineColors', 'line', '→ 用在 t.pencolor(…)');
makePalette('fillColors', 'fill', '→ 用在 t.fillcolor(…)，要搭配 begin_fill() / end_fill()');

/* ===================== 【區塊】5. 範例選單 ===================== */
const EXAMPLES = {
  square: `import turtle

t = turtle.Turtle()
t.color("orange")      # 改改看：red、blue、green、purple…
t.pensize(3)

# 用迴圈畫一個正方形
for i in range(4):
    t.forward(100)
    t.left(90)

print("畫好囉！")
`,
  pumpkin: `import turtle

t = turtle.Turtle()
t.speed(6)
t.pensize(2)
t.color("orange")

petals = 8          # 南瓜的瓣數：改成 6、10、12 看看

for i in range(petals):
    t.circle(60)
    t.left(360 / petals)

print("南瓜有", petals, "瓣")
`
};
$('examples').onchange = e => {
  if (EXAMPLES[e.target.value]) setCode(EXAMPLES[e.target.value]);
  e.target.value = '';
};

/* ===================== 【區塊】6. 無限畫布（像 Desmos） ===================== */
const WORLD = 2400;            // 海龜畫布大小：原點在中心，上下左右各約 1200 格
const K_MIN = 0.1, K_MAX = 8;  // 縮放範圍
const box = $('graphBox'), world = $('world'), layer = $('stickers'), gridCv = $('gridCv');
graph.style.width = WORLD + 'px';
graph.style.height = WORLD + 'px';
graph.style.left = (-WORLD / 2) + 'px';
graph.style.top = (-WORLD / 2) + 'px';

const view = { x: 0, y: 0, k: 1 };   // x,y：原點在畫面上的位置；k：縮放倍率

function applyView() {
  const tf = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.k + ')';
  world.style.transform = tf;        // 海龜圖形
  layer.style.transform = tf;        // 貼紙跟著一起動
  drawGrid();
}
function resetView() {
  view.x = box.clientWidth / 2;
  view.y = box.clientHeight / 2;
  view.k = 1;
  applyView();
}
// 螢幕座標 → 世界座標（貼紙用）
function toWorld(cx, cy) {
  const r = box.getBoundingClientRect();
  return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k };
}
function zoomAt(cx, cy, factor) {
  const r = box.getBoundingClientRect();
  const px = cx - r.left, py = cy - r.top;
  const nk = Math.max(K_MIN, Math.min(K_MAX, view.k * factor));
  const f = nk / view.k;
  view.x = px - (px - view.x) * f;      // 以滑鼠位置為中心縮放
  view.y = py - (py - view.y) * f;
  view.k = nk;
  applyView();
}

// 滾輪縮放
box.addEventListener('wheel', e => {
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
}, { passive: false });

// 拖曳平移
box.addEventListener('pointerdown', e => {
  if (e.target.closest('#viewBtns')) return;
  e.preventDefault();
  box.setPointerCapture(e.pointerId);
  box.classList.add('panning');
  let lx = e.clientX, ly = e.clientY;
  const move = ev => {
    view.x += ev.clientX - lx;
    view.y += ev.clientY - ly;
    lx = ev.clientX; ly = ev.clientY;
    applyView();
  };
  const up = () => {
    box.classList.remove('panning');
    box.removeEventListener('pointermove', move);
    box.removeEventListener('pointerup', up);
    box.removeEventListener('pointercancel', up);
  };
  box.addEventListener('pointermove', move);
  box.addEventListener('pointerup', up);
  box.addEventListener('pointercancel', up);
});

// 右上角按鈕
function boxCenter() {
  const r = box.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
$('zoomIn').onclick = () => { const c = boxCenter(); zoomAt(c.x, c.y, 1.3); };
$('zoomOut').onclick = () => { const c = boxCenter(); zoomAt(c.x, c.y, 1 / 1.3); };
$('homeBtn').onclick = resetView;

// 格線與座標軸（每次平移、縮放都重畫，所以是「無限」的）
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
function fmt(v) { return String(parseFloat(v.toPrecision(10))); }

function drawGrid() {
  const dpr = window.devicePixelRatio || 1;
  const w = box.clientWidth, h = box.clientHeight;
  if (!w || !h) return;
  if (gridCv.width !== Math.round(w * dpr) || gridCv.height !== Math.round(h * dpr)) {
    gridCv.width = Math.round(w * dpr);
    gridCv.height = Math.round(h * dpr);
    gridCv.style.width = w + 'px';
    gridCv.style.height = h + 'px';
  }
  const c = gridCv.getContext('2d');
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);

  const step = niceStep(80 / view.k), minor = step / 5;
  // 畫面目前看到的「海龜座標」範圍（y 向上為正）
  const xMin = -view.x / view.k, xMax = (w - view.x) / view.k;
  const yMax = view.y / view.k, yMin = (view.y - h) / view.k;
  const sx = x => Math.round(view.x + x * view.k) + 0.5;
  const sy = y => Math.round(view.y - y * view.k) + 0.5;

  function lines(s, color) {
    c.strokeStyle = color; c.lineWidth = 1; c.beginPath();
    for (let i = Math.ceil(xMin / s); i <= Math.floor(xMax / s); i++) { c.moveTo(sx(i * s), 0); c.lineTo(sx(i * s), h); }
    for (let i = Math.ceil(yMin / s); i <= Math.floor(yMax / s); i++) { c.moveTo(0, sy(i * s)); c.lineTo(w, sy(i * s)); }
    c.stroke();
  }
  lines(minor, 'rgba(0,0,0,0.06)');
  lines(step, 'rgba(0,0,0,0.18)');

  // 座標軸
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.beginPath();
  if (view.x >= 0 && view.x <= w) { c.moveTo(Math.round(view.x) + 0.5, 0); c.lineTo(Math.round(view.x) + 0.5, h); }
  if (view.y >= 0 && view.y <= h) { c.moveTo(0, Math.round(view.y) + 0.5); c.lineTo(w, Math.round(view.y) + 0.5); }
  c.stroke();

  // 數字標籤
  c.fillStyle = '#555'; c.font = '11px sans-serif';
  const labelY = Math.min(Math.max(view.y + 13, 12), h - 4);
  const labelX = Math.min(Math.max(view.x - 5, 24), w - 4);
  c.textAlign = 'center';
  for (let i = Math.ceil(xMin / step); i <= Math.floor(xMax / step); i++) {
    if (i !== 0) c.fillText(fmt(i * step), sx(i * step), labelY);
  }
  c.textAlign = 'right';
  for (let i = Math.ceil(yMin / step); i <= Math.floor(yMax / step); i++) {
    if (i !== 0) c.fillText(fmt(i * step), labelX, sy(i * step) + 4);
  }
  if (view.x >= 0 && view.x <= w && view.y >= 0 && view.y <= h) {
    c.textAlign = 'right'; c.fillText('0', view.x - 5, view.y + 13);
  }
}

// 畫面大小改變（拖曳分隔線、視窗縮放）時重畫格線
let viewInit = false;
new ResizeObserver(() => {
  if (!viewInit && box.clientWidth) { viewInit = true; resetView(); }
  else applyView();
}).observe(box);

/* ===================== 【區塊】7. 表情貼紙 ===================== */
// 從托盤拖到畫面；貼紙在最上層，可再拖動、雙擊刪除
const EMOJIS = ['', '🤙', '☝️', '🤌', '👁️', '👄', '👅', '👃', '🫵', '✌️', '💪'].filter(Boolean);

EMOJIS.forEach(ch => {
  const s = document.createElement('span');
  s.className = 'tray-emoji';
  s.textContent = ch;
  s.addEventListener('pointerdown', e => dragNew(ch, e));
  $('tray').appendChild(s);
});

function dragNew(ch, e) {
  e.preventDefault();
  const ghost = document.createElement('span');
  ghost.className = 'ghost';
  ghost.textContent = ch;
  document.body.appendChild(ghost);
  document.body.classList.add('dragging');
  const place = ev => { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; };
  place(e);
  const up = ev => {
    window.removeEventListener('pointermove', place);
    window.removeEventListener('pointerup', up);
    ghost.remove();
    document.body.classList.remove('dragging');
    const r = box.getBoundingClientRect();
    if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
      const p = toWorld(ev.clientX, ev.clientY);
      addSticker(ch, p.x, p.y);
    }
  };
  window.addEventListener('pointermove', place);
  window.addEventListener('pointerup', up);
}

function addSticker(ch, x, y) {
  const s = document.createElement('span');
  s.className = 'sticker';
  s.textContent = ch;
  s.style.left = x + 'px';
  s.style.top = y + 'px';
  s.addEventListener('dblclick', () => s.remove());
  s.addEventListener('pointerdown', e => {
    e.preventDefault();
    e.stopPropagation();          // 不要讓畫布跟著被拖走
    document.body.classList.add('dragging');
    const move = ev => {
      const p = toWorld(ev.clientX, ev.clientY);
      s.style.left = p.x + 'px';
      s.style.top = p.y + 'px';
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.classList.remove('dragging');
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  layer.appendChild(s);
}

/* ===================== 【區塊】8. 拖曳調整分區大小 ===================== */
function makeDraggable(handle, onMove) {
  handle.addEventListener('pointerdown', e => {
    e.preventDefault();
    document.body.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
    const move = ev => onMove(ev);
    const up = () => {
      document.body.classList.remove('dragging');
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  });
}
// 左右：調整「左半部」寬度
makeDraggable($('vsplit'), ev => {
  const w = ev.clientX - $('main').getBoundingClientRect().left;
  const max = $('main').clientWidth - 246;
  $('left').style.width = Math.max(160, Math.min(w, max)) + 'px';
});
// 上下：調整「圖形顯示」高度
makeDraggable($('hsplit'), ev => {
  const lb = $('left').getBoundingClientRect();
  const h = ev.clientY - lb.top;
  $('graphWrap').style.flex = '0 0 ' + Math.max(80, Math.min(h, lb.height - 66)) + 'px';
});
