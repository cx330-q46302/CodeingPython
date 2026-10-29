/* ============================================================
   Codeing.js —— 所有功能
   目錄（搜尋 【區塊】 可快速跳轉）
   0. 【區塊】共用小工具與主題（淺色／深色）
   1. 【區塊】載入外部程式庫（Skulpt = Python、CodeMirror = 編輯器）
   2. 【區塊】程式碼編輯器（行號、語法上色）
   3. 【區塊】執行 Python
   4. 【區塊】顏色按鈕（線條／填色）
   5. 【區塊】無限畫布（平移、縮放、格線）
   6. 【區塊】表情貼紙
   7. 【區塊】拖曳調整分區大小
   8. 【區塊】範例選單（放在最後，因為範例程式碼很長）
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

/* ===================== 【區塊】5. 無限畫布（像 Desmos） ===================== */
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

/* ===================== 【區塊】6. 表情貼紙 ===================== */
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

/* ===================== 【區塊】7. 拖曳調整分區大小 ===================== */
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

/* ===================== 【區塊】8. 範例選單（放在最後） ===================== */
// 範例程式碼很長，所以放在檔案最後面，不影響上面功能的閱讀。
//
// 想新增一個範例：
//   1. 在下面的 EXAMPLES 裡加一組「名字: `Python 程式碼`,」
//   2. 到 Codeing.html 的 <select id="examples"> 加一行 <option value="名字">顯示文字</option>
// ⚠️ 程式碼裡面不能出現反引號 ` 和 ${ 這兩種寫法，否則 JavaScript 會誤判字串結束。
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

  // ---------- 圓形（基礎）：用迴圈把圓轉一圈，疊出花瓣狀的圖案 ----------
  circle: `import turtle

t = turtle.Turtle()
t.speed(6)
t.pensize(2)
t.color("orange")

petals = 8          # 圓的個數：改成 6、10、12 看看

for i in range(petals):
    t.circle(60)                 # 畫一個圓
    t.left(360 / petals)         # 轉一個角度，轉滿一圈剛好 360 度

print("共畫了", petals, "個圓")
`,

  // ---------- 花（基礎）：花蕊固定在中間，只改花瓣的瓣數 ----------
  flower: `import turtle

t = turtle.Turtle()
t.speed(6)
t.pensize(2)

# ===== 可以改的地方 =====
petals = 8                 # 花瓣數：改成 5、6、12 看看
petal_size = 90            # 花瓣大小（數字越大花瓣越長）
petal_color = "pink"       # 花瓣顏色（可以用上方「填色」按鈕插入）
center_color = "gold"      # 花蕊顏色
# =======================

# 1. 用迴圈畫花瓣，每一片都從正中間（花蕊的位置）長出來
t.pencolor("red")
t.fillcolor(petal_color)

for i in range(petals):
    t.begin_fill()
    for j in range(2):               # 一片花瓣 = 兩段圓弧
        t.circle(petal_size, 60)
        t.left(120)
    t.end_fill()
    t.left(360 / petals)             # 轉到下一片花瓣的方向

# 2. 花蕊：固定畫在正中間，不會因為瓣數改變而改變
t.penup()
t.goto(0, -25)
t.setheading(0)
t.pendown()
t.pencolor("orange")
t.fillcolor(center_color)
t.begin_fill()
t.circle(25)
t.end_fill()

t.hideturtle()
print("花有", petals, "片花瓣")
`,
  // ---------- 南瓜（來源檔案：halloween_1_pumpkin.py） ----------
  pumpkin: `import turtle
import math

# =====================================================================
#  範例 1：有臉的南瓜（Jack-o'-Lantern）
# ---------------------------------------------------------------------
#  畫法：
#   1. 南瓜身體 = 5 個橢圓「由外往內」疊起來，每個橢圓有深橘色外框，
#      重疊的外框線就自然變成南瓜的「瓣紋」。
#   2. 臉 = 黑色多邊形（三角眼睛、三角鼻子、彎彎的鋸齒嘴巴），
#      再在裡面蓋一層縮小的黃色，做出「裡面點了蠟燭」的發光感。
#   3. 牙齒 = 用南瓜的橘色，蓋在黑色嘴巴的上緣和下緣。
# =====================================================================

# ---------- 基本設定 ----------
S = 0.9                    # 整體縮放（想畫更大就調大，例如 1.1）
IMG_W = 640
IMG_H = 640

t = turtle.Turtle()
t.hideturtle()
t.speed(0)

# ---------- 工具函式 ----------
def T(x, y):
    # 設計座標（原點左上、y 往下） -> 海龜座標（原點中心、y 往上）
    return ((x - IMG_W / 2) * S, (IMG_H / 2 - y) * S)

def fill_poly(pts, color, line=None, width=1):
    # 畫實心多邊形：color 是填色，line 是外框顏色（不寫就跟填色一樣）
    if line is None:
        line = color
    x0, y0 = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x0, y0)
    t.pencolor(line)
    t.fillcolor(color)
    t.pensize(width)
    t.pendown()
    t.begin_fill()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.goto(x0, y0)
    t.end_fill()
    t.penup()

def polyline(pts, color, width):
    # 畫折線
    x, y = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x, y)
    t.pencolor(color)
    t.pensize(width)
    t.pendown()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.penup()

def ellipse_pts(cx, cy, rx, ry, n=24):
    # 橢圓上的 n 個點
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    return pts

def bez_pt(p0, p1, p2, p3, u):
    # 三次貝茲曲線上，位置 u（0~1）的那一點
    a = (1 - u) ** 3
    b = 3 * (1 - u) ** 2 * u
    c = 3 * (1 - u) * u ** 2
    d = u ** 3
    return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
            a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])

def bezier(p0, p1, p2, p3, n=14):
    # 把貝茲曲線切成 n 段，回傳一串點
    pts = []
    for i in range(n + 1):
        pts.append(bez_pt(p0, p1, p2, p3, i / n))
    return pts

def ribbon(pts, w0, w1, color):
    # 沿中心線畫出「粗細漸變」的筆畫（左右各偏移半個寬度，圍成多邊形）
    left = []
    right = []
    n = len(pts)
    for i in range(n):
        if i == 0:
            dx = pts[1][0] - pts[0][0]
            dy = pts[1][1] - pts[0][1]
        elif i == n - 1:
            dx = pts[i][0] - pts[i - 1][0]
            dy = pts[i][1] - pts[i - 1][1]
        else:
            dx = pts[i + 1][0] - pts[i - 1][0]
            dy = pts[i + 1][1] - pts[i - 1][1]
        length = math.sqrt(dx * dx + dy * dy)
        if length == 0:
            length = 1
        nx = -dy / length
        ny = dx / length
        half = (w0 + (w1 - w0) * i / (n - 1)) / 2
        left.append((pts[i][0] + nx * half, pts[i][1] + ny * half))
        right.append((pts[i][0] - nx * half, pts[i][1] - ny * half))
    right.reverse()
    fill_poly(left + right, color)

def shrink(pts, f):
    # 把多邊形以「重心」為中心縮小 f 倍（用來做裡面的發光層）
    sx = 0
    sy = 0
    for p in pts:
        sx = sx + p[0]
        sy = sy + p[1]
    cx = sx / len(pts)
    cy = sy / len(pts)
    out = []
    for p in pts:
        out.append((cx + (p[0] - cx) * f, cy + (p[1] - cy) * f))
    return out

# ---------- 顏色 ----------
ORANGE = "#ff8c1a"         # 南瓜橘
DARK = "#b84a00"           # 南瓜外框的深橘色
LIGHT = "#ffc266"          # 高光
FACE = "#1a1a1a"           # 臉的黑色
GLOW = "#ffd23f"           # 蠟燭光
GREEN = "#3f8a1f"
DGREEN = "#245512"

# ---------- 1. 地上的影子 ----------
fill_poly(ellipse_pts(320, 528, 215, 20, 36), "#e6e6e6")

# ---------- 2. 南瓜身體：5 瓣，由外往內畫 ----------
# 每一組 (中心 x, 寬的一半, 高的一半)
lobes = [(185, 105, 138), (455, 105, 138), (248, 100, 150), (392, 100, 150), (320, 95, 156)]
for (cx, rx, ry) in lobes:
    fill_poly(ellipse_pts(cx, 358, rx, ry, 40), ORANGE, DARK, 4)
    # 每瓣左側的高光弧線
    polyline(bezier((cx - 0.62 * rx, 358 - 0.55 * ry),
                    (cx - 0.80 * rx, 358 - 0.15 * ry),
                    (cx - 0.80 * rx, 358 + 0.20 * ry),
                    (cx - 0.60 * rx, 358 + 0.50 * ry)), LIGHT, 4)

# ---------- 3. 蒂頭與藤蔓 ----------
fill_poly([(298, 214), (302, 160), (318, 138), (346, 128), (352, 150), (340, 170), (338, 214)],
          GREEN, DGREEN, 3)
ribbon(bezier((338, 196), (398, 176), (432, 132), (410, 98)), 8, 2, GREEN)   # 捲曲的藤蔓

# ---------- 4. 臉：黑色的洞 ----------
left_eye = [(240, 332), (286, 284), (302, 338)]
right_eye = [(400, 332), (354, 284), (338, 338)]
nose = [(320, 352), (304, 384), (336, 384)]

# 嘴巴：上緣和下緣各一條曲線，合起來圍成嘴巴的形狀
top_p = [(226, 398), (270, 446), (370, 446), (414, 398)]
bot_p = [(234, 412), (280, 482), (360, 482), (406, 412)]
mouth_top = bezier(top_p[0], top_p[1], top_p[2], top_p[3], 16)
mouth_bot = bezier(bot_p[0], bot_p[1], bot_p[2], bot_p[3], 16)
back = mouth_bot[:]
back.reverse()
mouth = mouth_top + back

fill_poly(left_eye, FACE)
fill_poly(right_eye, FACE)
fill_poly(nose, FACE)
fill_poly(mouth, FACE)

# ---------- 5. 蠟燭光：每個洞裡面蓋一層縮小的黃色 ----------
fill_poly(shrink(left_eye, 0.55), GLOW)
fill_poly(shrink(right_eye, 0.55), GLOW)
fill_poly(shrink(nose, 0.55), GLOW)
fill_poly(shrink(mouth, 0.80), GLOW)

# ---------- 6. 牙齒：南瓜橘色的三角形 ----------
for u in [0.25, 0.5, 0.75]:                    # 上排牙齒（往下長）
    x, y = bez_pt(top_p[0], top_p[1], top_p[2], top_p[3], u)
    fill_poly([(x - 14, y - 5), (x + 14, y - 5), (x, y + 20)], ORANGE)
for u in [0.37, 0.63]:                         # 下排牙齒（往上長）
    x, y = bez_pt(bot_p[0], bot_p[1], bot_p[2], bot_p[3], u)
    fill_poly([(x - 12, y + 5), (x + 12, y + 5), (x, y - 18)], ORANGE)

t.hideturtle()
print("有臉的南瓜畫好了！")
`,
// ---------- （來源檔案：halloween_2_web.py） ----------
  web:`import turtle
import math

# =====================================================================
#  範例 2：蜘蛛網（附一隻小蜘蛛和露珠）
# ---------------------------------------------------------------------
#  畫法：
#   1. 輻射線（spokes）：從中心往外 12 條，每隔 30 度一條。
#   2. 圓周線（rings）：在每一圈的半徑上，把相鄰兩條輻射線連起來。
#      真的蜘蛛絲會「往中心垂下」，所以不畫直線，而是用
#      「二次貝茲曲線」，控制點放在比較靠近中心的位置，就會有下垂的弧度。
#   3. 固定絲：四個方向的輻射線尖端，各拉一條線到畫面角落，像是黏在樹枝上。
#   4. 露珠：在幾個圓周線的中點放上淺藍色的小水滴。
#   5. 小蜘蛛：用 place() 縮小、移到網上。
# =====================================================================

# ---------- 基本設定 ----------
S = 0.9
IMG_W = 640
IMG_H = 640

t = turtle.Turtle()
t.hideturtle()
t.speed(0)

# ---------- 工具函式 ----------
def T(x, y):
    return ((x - IMG_W / 2) * S, (IMG_H / 2 - y) * S)

def fill_poly(pts, color, line=None, width=1):
    if line is None:
        line = color
    x0, y0 = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x0, y0)
    t.pencolor(line)
    t.fillcolor(color)
    t.pensize(width)
    t.pendown()
    t.begin_fill()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.goto(x0, y0)
    t.end_fill()
    t.penup()

def polyline(pts, color, width):
    x, y = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x, y)
    t.pencolor(color)
    t.pensize(width)
    t.pendown()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.penup()

def ellipse_pts(cx, cy, rx, ry, n=24):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    return pts

def place(pts, cx, cy, k, rot):
    # 把一組以原點為中心的點：縮放 k 倍、旋轉 rot 度、移到 (cx, cy)
    r = math.radians(rot)
    c = math.cos(r)
    s = math.sin(r)
    out = []
    for p in pts:
        x = p[0] * k
        y = p[1] * k
        out.append((cx + x * c - y * s, cy + x * s + y * c))
    return out

def quad(p0, c, p1, n=10):
    # 二次貝茲曲線：起點 p0、控制點 c、終點 p1
    pts = []
    for i in range(n + 1):
        u = i / n
        a = (1 - u) ** 2
        b = 2 * (1 - u) * u
        d = u ** 2
        pts.append((a * p0[0] + b * c[0] + d * p1[0], a * p0[1] + b * c[1] + d * p1[1]))
    return pts

# ---------- 顏色 ----------
SILK = "#2b2b2b"          # 蜘蛛絲
ANCHOR = "#555555"        # 固定絲（比較粗、顏色淡一點）

# ---------- 網的參數 ----------
CX = 320                  # 網中心
CY = 330
SPOKES = 12               # 輻射線數量
TIP = 290                 # 輻射線長度
rings = [42, 80, 120, 162, 206, 252]      # 每一圈圓周線的半徑

# ---------- 1. 固定絲：從輻射線尖端拉到畫面角落 ----------
for (deg, corner) in [(330, (632, 12)), (210, (8, 12)), (150, (8, 640)), (30, (632, 640))]:
    a = math.radians(deg)
    tip = (CX + TIP * math.cos(a), CY + TIP * math.sin(a))
    mid = ((tip[0] + corner[0]) / 2, (tip[1] + corner[1]) / 2 + 12)   # 中間稍微下垂
    polyline(quad(tip, mid, corner, 12), ANCHOR, 4)

# ---------- 2. 輻射線 ----------
for i in range(SPOKES):
    a = math.radians(i * 30)
    polyline([(CX, CY), (CX + TIP * math.cos(a), CY + TIP * math.sin(a))], SILK, 3)

# ---------- 3. 圓周線：相鄰輻射線之間，用往中心下垂的曲線連起來 ----------
for r in rings:
    for i in range(SPOKES):
        a0 = math.radians(i * 30)
        a1 = math.radians(i * 30 + 30)
        mid = math.radians(i * 30 + 15)
        p0 = (CX + r * math.cos(a0), CY + r * math.sin(a0))
        p1 = (CX + r * math.cos(a1), CY + r * math.sin(a1))
        c = (CX + 0.83 * r * math.cos(mid), CY + 0.83 * r * math.sin(mid))   # 控制點靠近中心 -> 下垂
        polyline(quad(p0, c, p1, 10), SILK, 2)

# ---------- 4. 網中心的小結 ----------
fill_poly(ellipse_pts(CX, CY, 13, 13, 16), SILK)

# ---------- 5. 露珠：放在幾條圓周線的中點 ----------
# 每一組 (第幾圈, 第幾格)
drops = [(2, 1), (3, 4), (4, 7), (3, 9), (5, 2), (1, 10), (4, 0), (5, 6), (2, 5)]
for (j, i) in drops:
    r = rings[j]
    mid = math.radians(i * 30 + 15)
    x = CX + 0.9 * r * math.cos(mid)
    y = CY + 0.9 * r * math.sin(mid)
    fill_poly(ellipse_pts(x, y, 7, 8, 14), "#cfeaff", "#5b8fb0", 1)         # 水滴
    fill_poly(ellipse_pts(x - 2, y - 3, 2, 2.5, 8), "white")               # 高光

# ---------- 6. 網上的小蜘蛛 ----------
def mini_spider(cx, cy, k, rot):
    # 身體：大的腹部 + 小的頭
    fill_poly(place(ellipse_pts(0, 10, 13, 16, 16), cx, cy, k, rot), "#111111")
    fill_poly(place(ellipse_pts(0, -9, 8, 8, 12), cx, cy, k, rot), "#111111")
    # 腿：左邊 4 隻（每隻 3 個點），右邊左右翻轉
    legs = [[(-6, -6), (-26, -22), (-44, -12)],
            [(-8, -2), (-32, -6), (-50, 6)],
            [(-8, 4), (-30, 14), (-46, 30)],
            [(-6, 10), (-20, 28), (-30, 44)]]
    for leg in legs:
        polyline(place(leg, cx, cy, k, rot), "#111111", 2)
        mirror = [(-p[0], p[1]) for p in leg]
        polyline(place(mirror, cx, cy, k, rot), "#111111", 2)

mini_spider(437, 205, 1.5, 20)

t.hideturtle()
print("蜘蛛網畫好了！")
`,
// ---------- （來源檔案：halloween_3_bat.py） ----------
  bat:`import turtle
import math

# =====================================================================
#  範例 3：蝙蝠（大尺寸，前面有月亮）
# ---------------------------------------------------------------------
#  畫法：
#   1. 先畫一個淡黃色的大月亮當背景。
#   2. 蝙蝠用「以身體中心為原點的座標」設計，再用 place() 移到畫面中央。
#      只設計「左半邊」的翅膀，右半邊把 x 座標變負數（左右翻轉）就好。
#   3. 翅膀 = 12 個點圍成的多邊形。
#      手指尖端（F1~F4）和它們之間往內凹的點（V1~V4）交替排列，
#      就是蝙蝠翅膀那種「扇貝形」的下緣。
#   4. 翅膀上的骨頭 = 用「緞帶 ribbon」從手腕畫到每個指尖，越來越細。
#   5. 臉：尖耳朵、發紅光的眼睛、兩顆白色的尖牙。
# =====================================================================

# ---------- 基本設定 ----------
S = 0.95
IMG_W = 640
IMG_H = 640

t = turtle.Turtle()
t.hideturtle()
t.speed(0)

# ---------- 工具函式 ----------
def T(x, y):
    return ((x - IMG_W / 2) * S, (IMG_H / 2 - y) * S)

def fill_poly(pts, color, line=None, width=1):
    if line is None:
        line = color
    x0, y0 = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x0, y0)
    t.pencolor(line)
    t.fillcolor(color)
    t.pensize(width)
    t.pendown()
    t.begin_fill()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.goto(x0, y0)
    t.end_fill()
    t.penup()

def polyline(pts, color, width):
    x, y = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x, y)
    t.pencolor(color)
    t.pensize(width)
    t.pendown()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.penup()

def ellipse_pts(cx, cy, rx, ry, n=24):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    return pts

def place(pts, cx, cy, k, rot):
    r = math.radians(rot)
    c = math.cos(r)
    s = math.sin(r)
    out = []
    for p in pts:
        x = p[0] * k
        y = p[1] * k
        out.append((cx + x * c - y * s, cy + x * s + y * c))
    return out

def mirror(pts):
    # 左右翻轉：x 變負數
    return [(-p[0], p[1]) for p in pts]

def ribbon(pts, w0, w1, color):
    left = []
    right = []
    n = len(pts)
    for i in range(n):
        if i == 0:
            dx = pts[1][0] - pts[0][0]
            dy = pts[1][1] - pts[0][1]
        elif i == n - 1:
            dx = pts[i][0] - pts[i - 1][0]
            dy = pts[i][1] - pts[i - 1][1]
        else:
            dx = pts[i + 1][0] - pts[i - 1][0]
            dy = pts[i + 1][1] - pts[i - 1][1]
        length = math.sqrt(dx * dx + dy * dy)
        if length == 0:
            length = 1
        nx = -dy / length
        ny = dx / length
        half = (w0 + (w1 - w0) * i / (n - 1)) / 2
        left.append((pts[i][0] + nx * half, pts[i][1] + ny * half))
        right.append((pts[i][0] - nx * half, pts[i][1] - ny * half))
    right.reverse()
    fill_poly(left + right, color)

# ---------- 顏色 ----------
MEMBRANE = "#241a38"       # 翅膀的膜（深紫黑色）
EDGE = "#0b0712"           # 外框
BONE = "#6a54a0"           # 翅膀骨頭
FUR = "#15151c"            # 身體的毛
CHEST = "#2b2b3a"          # 胸口（稍微淺一點）

# ---------- 1. 背景：月亮 ----------
fill_poly(ellipse_pts(320, 300, 218, 218, 60), "#fff1b8")
for (mx, my, r) in [(220, 190, 24), (430, 230, 18), (390, 120, 12), (250, 400, 20)]:
    fill_poly(ellipse_pts(mx, my, r, r * 0.8, 14), "#f3dc96")       # 月球的坑洞

# ---------- 2. 蝙蝠（座標以身體中心為原點，之後整個搬到 (320, 330)） ----------
CX = 320
CY = 330

# 左邊翅膀的關鍵點
P0 = (-22, -18)        # 肩膀
P1 = (-85, -88)        # 手肘
P2 = (-170, -104)      # 手腕（所有手指都從這裡長出來）
F1 = (-285, -74)       # 第 1 根手指的尖端（翅膀最外面）
F2 = (-252, 30)
F3 = (-190, 72)
F4 = (-120, 62)
B = (-26, 40)          # 翅膀接到身體的位置
# 手指尖之間「往內凹」的點
V1 = (-242, -20)
V2 = (-206, 28)
V3 = (-152, 46)
V4 = (-72, 28)

wing = [P0, P1, P2, F1, V1, F2, V2, F3, V3, F4, V4, B]

# 翅膀的膜（左、右）
fill_poly(place(wing, CX, CY, 1, 0), MEMBRANE, EDGE, 3)
fill_poly(place(mirror(wing), CX, CY, 1, 0), MEMBRANE, EDGE, 3)

# 翅膀的骨頭：上臂 + 4 根手指
arm = [P0, P1, P2]
for side in [1, -1]:
    pts = arm
    if side == -1:
        pts = mirror(arm)
    ribbon(place(pts, CX, CY, 1, 0), 10, 7, BONE)
    for tip in [F1, F2, F3, F4]:
        finger = [P2, tip]
        if side == -1:
            finger = mirror(finger)
        ribbon(place(finger, CX, CY, 1, 0), 7, 2, BONE)

# 身體與胸口
fill_poly(place(ellipse_pts(0, 18, 40, 64, 28), CX, CY, 1, 0), FUR)
fill_poly(place(ellipse_pts(0, 26, 22, 42, 24), CX, CY, 1, 0), CHEST)

# 耳朵（外層深色 + 內層粉紫色）
ear = [(-36, -82), (-48, -158), (-8, -94)]
ear_in = [(-31, -90), (-42, -140), (-14, -96)]
fill_poly(place(ear, CX, CY, 1, 0), FUR)
fill_poly(place(mirror(ear), CX, CY, 1, 0), FUR)
fill_poly(place(ear_in, CX, CY, 1, 0), "#9b5a86")
fill_poly(place(mirror(ear_in), CX, CY, 1, 0), "#9b5a86")

# 頭與口鼻
fill_poly(place(ellipse_pts(0, -62, 42, 36, 28), CX, CY, 1, 0), FUR)
fill_poly(place(ellipse_pts(0, -48, 14, 9, 14), CX, CY, 1, 0), "#0a0a10")

# 發紅光的眼睛（外圈紅色 + 一點白色高光）
for ex in [-17, 17]:
    fill_poly(place(ellipse_pts(ex, -64, 9, 7, 14), CX, CY, 1, 0), "#ff3b3b")
    fill_poly(place(ellipse_pts(ex - 2, -66, 2.5, 2.5, 8), CX, CY, 1, 0), "white")

# 嘴巴與兩顆尖牙
polyline(place([(-16, -40), (0, -33), (16, -40)], CX, CY, 1, 0), "black", 2)
fang = [(-10, -38), (-4, -36), (-8, -24)]
fill_poly(place(fang, CX, CY, 1, 0), "white")
fill_poly(place(mirror(fang), CX, CY, 1, 0), "white")

t.hideturtle()
print("蝙蝠畫好了！")
`,
  // ---------- （來源檔案：halloween_4_spider.py） ----------
  spider:`import turtle
import math

# =====================================================================
#  範例 4：大蜘蛛（黑色，腹部有紅色沙漏紋）
# ---------------------------------------------------------------------
#  畫法：
#   1. 腳 = 每隻 4 個點（根部、膝蓋、關節、腳尖）連成一條「緞帶」，
#      從粗到細。蜘蛛的腳都有一個很明顯的「彎折膝蓋」，
#      所以每隻腳的點要讓它先往上、再往外、最後往下。
#   2. 左邊 4 隻腳設計好，右邊 4 隻把 x 變成 640 - x（左右翻轉）。
#   3. 身體 = 大的腹部橢圓 + 小一點的頭胸部橢圓，
#      腹部上有紅色沙漏形（6 個點的多邊形）和一道高光。
#   4. 臉 = 四顆發紅光的眼睛 + 兩根尖牙。
#   5. 最上面有一條蜘蛛絲，像是蜘蛛從天花板垂下來。
#  （這是自己設計的一般黑色蜘蛛，不是任何特定角色的圖案。）
# =====================================================================

# ---------- 基本設定 ----------
S = 0.95
IMG_W = 640
IMG_H = 640

t = turtle.Turtle()
t.hideturtle()
t.speed(0)

# ---------- 工具函式 ----------
def T(x, y):
    return ((x - IMG_W / 2) * S, (IMG_H / 2 - y) * S)

def fill_poly(pts, color, line=None, width=1):
    if line is None:
        line = color
    x0, y0 = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x0, y0)
    t.pencolor(line)
    t.fillcolor(color)
    t.pensize(width)
    t.pendown()
    t.begin_fill()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.goto(x0, y0)
    t.end_fill()
    t.penup()

def polyline(pts, color, width):
    x, y = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x, y)
    t.pencolor(color)
    t.pensize(width)
    t.pendown()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.penup()

def ellipse_pts(cx, cy, rx, ry, n=24):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    return pts

def bez_pt(p0, p1, p2, p3, u):
    a = (1 - u) ** 3
    b = 3 * (1 - u) ** 2 * u
    c = 3 * (1 - u) * u ** 2
    d = u ** 3
    return (a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
            a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1])

def bezier(p0, p1, p2, p3, n=14):
    pts = []
    for i in range(n + 1):
        pts.append(bez_pt(p0, p1, p2, p3, i / n))
    return pts

def ribbon(pts, w0, w1, color):
    left = []
    right = []
    n = len(pts)
    for i in range(n):
        if i == 0:
            dx = pts[1][0] - pts[0][0]
            dy = pts[1][1] - pts[0][1]
        elif i == n - 1:
            dx = pts[i][0] - pts[i - 1][0]
            dy = pts[i][1] - pts[i - 1][1]
        else:
            dx = pts[i + 1][0] - pts[i - 1][0]
            dy = pts[i + 1][1] - pts[i - 1][1]
        length = math.sqrt(dx * dx + dy * dy)
        if length == 0:
            length = 1
        nx = -dy / length
        ny = dx / length
        half = (w0 + (w1 - w0) * i / (n - 1)) / 2
        left.append((pts[i][0] + nx * half, pts[i][1] + ny * half))
        right.append((pts[i][0] - nx * half, pts[i][1] - ny * half))
    right.reverse()
    fill_poly(left + right, color)

# ---------- 顏色 ----------
BODY = "#0d0d0d"           # 身體的黑色
SHINE = "#6a6a78"          # 高光
RED = "#d11a1a"            # 沙漏紋

# ---------- 1. 蜘蛛絲（從最上面垂下來） ----------
polyline([(320, 0), (320, 218)], "#999999", 2)

# ---------- 2. 八隻腳 ----------
# 左邊 4 隻：每隻 [根部, 膝蓋, 關節, 腳尖]
legs = [
    [(284, 246), (226, 182), (176, 150), (104, 142)],     # 第 1 隻（最前面，往上翹）
    [(276, 266), (196, 238), (130, 222), (66, 244)],      # 第 2 隻
    [(276, 290), (190, 310), (128, 336), (78, 392)],      # 第 3 隻
    [(286, 314), (224, 380), (190, 436), (168, 506)],     # 第 4 隻（最後面，往下伸）
]
for leg in legs:
    ribbon(leg, 13, 3, BODY)                                         # 左腳
    right_leg = [(640 - p[0], p[1]) for p in leg]                    # 右腳 = x 翻轉
    ribbon(right_leg, 13, 3, BODY)
    # 膝蓋處補一個小圓，避免折角出現缺口
    fill_poly(ellipse_pts(leg[1][0], leg[1][1], 8, 8, 12), BODY)
    fill_poly(ellipse_pts(640 - leg[1][0], leg[1][1], 8, 8, 12), BODY)

# ---------- 3. 腹部（大）與頭胸部（小） ----------
fill_poly(ellipse_pts(320, 385, 80, 100, 36), BODY)                  # 腹部
fill_poly(ellipse_pts(320, 268, 46, 50, 28), BODY)                   # 頭胸部（蓋在腹部上面）

# 腹部上的紅色沙漏紋
fill_poly([(300, 356), (340, 356), (324, 386), (340, 416), (300, 416), (316, 386)], RED)
# 腹部左側的高光
polyline(bezier((270, 340), (262, 370), (266, 410), (285, 440)), SHINE, 4)
# 頭胸部的高光
polyline(bezier((290, 246), (284, 262), (286, 280), (296, 292)), SHINE, 3)

# ---------- 4. 臉：眼睛與尖牙 ----------
for ex in [305, 335]:                                                 # 兩顆大眼睛
    fill_poly(ellipse_pts(ex, 252, 9, 9, 14), "#ff2a2a")
    fill_poly(ellipse_pts(ex - 3, 249, 3, 3, 8), "white")
for ex in [293, 347]:                                                 # 旁邊兩顆小眼睛
    fill_poly(ellipse_pts(ex, 266, 6, 6, 12), "#ff2a2a")
for ex in [314, 326]:                                                 # 上方兩顆更小的眼睛
    fill_poly(ellipse_pts(ex, 238, 4.5, 4.5, 10), "#ff2a2a")
fill_poly([(305, 296), (314, 296), (309, 316)], "#555555")            # 左尖牙
fill_poly([(326, 296), (335, 296), (331, 316)], "#555555")            # 右尖牙

t.hideturtle()
print("大蜘蛛畫好了！")
`,
  // ---------- （來源檔案：halloween_5_castle.py） ----------
  castle:`import turtle
import math

# =====================================================================
#  範例 5：月夜城堡（深色剪影 + 亮著燈的窗戶）
# ---------------------------------------------------------------------
#  畫法（由後往前畫，後畫的蓋住先畫的）：
#   1. 夜空：整張畫面先填深藍色，再撒上星星、畫月亮和發光的光暈。
#   2. 城堡：每座塔 = 「長方形的塔身 + 三角形的圓錐尖頂」，
#      主堡的頂端再加上一排鋸齒狀的城垛（battlements）。
#   3. 窗戶：用函式 arch_window() 畫出「下面方、上面半圓」的拱形，
#      填上黃色，做出亮燈的感覺。
#   4. 前景：黑色的山丘遮住城堡的底部，再飛幾隻小蝙蝠。
# =====================================================================

# ---------- 基本設定 ----------
S = 0.95
IMG_W = 640
IMG_H = 640

t = turtle.Turtle()
t.hideturtle()
t.speed(0)

# ---------- 工具函式 ----------
def T(x, y):
    return ((x - IMG_W / 2) * S, (IMG_H / 2 - y) * S)

def fill_poly(pts, color, line=None, width=1):
    if line is None:
        line = color
    x0, y0 = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x0, y0)
    t.pencolor(line)
    t.fillcolor(color)
    t.pensize(width)
    t.pendown()
    t.begin_fill()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.goto(x0, y0)
    t.end_fill()
    t.penup()

def polyline(pts, color, width):
    x, y = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x, y)
    t.pencolor(color)
    t.pensize(width)
    t.pendown()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.penup()

def ellipse_pts(cx, cy, rx, ry, n=24):
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    return pts

def place(pts, cx, cy, k, rot):
    r = math.radians(rot)
    c = math.cos(r)
    s = math.sin(r)
    out = []
    for p in pts:
        x = p[0] * k
        y = p[1] * k
        out.append((cx + x * c - y * s, cy + x * s + y * c))
    return out

def rect(x0, y0, x1, y1):
    # 長方形的 4 個頂點
    return [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]

def arch_window(cx, top, w, h, color):
    # 拱形窗：下面是長方形，上面是半圓。cx = 中心 x，top = 最上緣 y，w = 寬，h = 高
    pts = [(cx - w / 2, top + h), (cx - w / 2, top + w / 2)]
    for i in range(1, 12):
        a = math.pi + math.pi * i / 12                 # 角度從 180 度轉到 360 度（上半圓）
        pts.append((cx + w / 2 * math.cos(a), top + w / 2 + w / 2 * math.sin(a)))
    pts.append((cx + w / 2, top + w / 2))
    pts.append((cx + w / 2, top + h))
    fill_poly(pts, color)
    # 窗框：中間一條直線
    polyline([(cx, top + 2), (cx, top + h)], "#8a5b00", 1)

def tower(x0, x1, top, base, roof_top, color, roof_color):
    # 一座塔：塔身 (x0~x1, top~base) + 圓錐尖頂（頂點在 roof_top）
    fill_poly(rect(x0, top, x1, base), color)
    fill_poly([(x0 - 9, top), ((x0 + x1) / 2, roof_top), (x1 + 9, top)], roof_color)

def flag(x, y, color):
    # 旗子：一根旗桿 + 一個三角旗
    polyline([(x, y), (x, y - 36)], "#05050a", 2)
    fill_poly([(x, y - 36), (x + 32, y - 27), (x, y - 18)], color)

def small_bat(cx, cy, k, rot):
    # 小蝙蝠（身體 + 兩片扇貝形翅膀）
    wing = [(-3, -4), (-20, -14), (-34, -10), (-30, 0), (-24, -2),
            (-22, 8), (-16, 2), (-12, 10), (-7, 4), (-3, 6)]
    wing_r = [(-p[0], p[1]) for p in wing]
    for shape in [wing, wing_r, ellipse_pts(0, 2, 5, 8, 10), ellipse_pts(0, -8, 4, 4, 8)]:
        fill_poly(place(shape, cx, cy, k, rot), "#05050a")

# ---------- 顏色 ----------
SKY = "#1b1b3a"
WALL = "#2a2a3d"           # 城牆
ROOF = "#161625"           # 屋頂（比牆更深）
LIGHT = "#ffcc33"          # 窗戶的燈光
GROUND = "#0e0e16"         # 前景山丘

# ---------- 1. 夜空 ----------
fill_poly(rect(0, 0, 640, 640), SKY)
for (sx, sy) in [(40, 60), (120, 120), (210, 58), (430, 48), (610, 215),
                 (70, 235), (255, 150), (380, 150), (565, 60), (20, 160)]:
    fill_poly(ellipse_pts(sx, sy, 3, 3, 8), "#fff3a0")                      # 星星

# ---------- 2. 月亮（先畫一圈大的光暈，再畫月亮本體與坑洞） ----------
fill_poly(ellipse_pts(560, 112, 72, 72, 40), "#26264d")
fill_poly(ellipse_pts(560, 112, 50, 50, 36), "#fff2b3")
fill_poly(ellipse_pts(546, 100, 9, 8, 10), "#f0dc98")
fill_poly(ellipse_pts(574, 126, 7, 6, 10), "#f0dc98")

# ---------- 3. 城堡（由後往前） ----------
# 最外側的兩座小塔
tower(90, 140, 340, 530, 270, WALL, ROOF)
tower(500, 555, 330, 530, 255, WALL, ROOF)

# 左右兩座主塔
tower(150, 230, 250, 530, 130, WALL, ROOF)
tower(410, 490, 230, 530, 100, WALL, ROOF)
flag(190, 130, "#d11a1a")
flag(450, 100, "#d11a1a")

# 中間的尖塔（在主堡後面，最高）
tower(290, 350, 200, 320, 90, WALL, ROOF)

# 中央主堡
fill_poly(rect(240, 300, 400, 530), WALL)
for x in [240, 272, 304, 336, 368]:                                         # 鋸齒狀城垛
    fill_poly(rect(x, 282, x + 20, 300), WALL)

# ---------- 4. 窗戶（亮著燈）與大門 ----------
arch_window(190, 290, 24, 52, LIGHT)          # 左主塔
arch_window(190, 400, 24, 52, LIGHT)
arch_window(450, 270, 24, 52, LIGHT)          # 右主塔
arch_window(450, 380, 24, 52, "#e8a317")      # 這一扇暗一點（光線比較弱）
arch_window(320, 228, 18, 36, LIGHT)          # 中間尖塔
arch_window(278, 350, 26, 56, LIGHT)          # 主堡左右兩扇
arch_window(362, 350, 26, 56, LIGHT)
arch_window(115, 385, 16, 34, LIGHT)          # 左外側小塔
arch_window(527, 375, 16, 34, LIGHT)          # 右外側小塔

# 大門：拱形的黑色入口，裡面透出一點橘色的光
arch_window(320, 440, 62, 92, "#05050a")
arch_window(320, 458, 30, 70, "#a85a10")

# ---------- 5. 前景山丘（蓋住城堡的底部） ----------
fill_poly([(0, 522), (120, 494), (240, 510), (320, 520), (420, 508), (540, 490), (640, 520),
           (640, 640), (0, 640)], GROUND)

# ---------- 6. 飛行的小蝙蝠 ----------
small_bat(470, 60, 1.1, -10)
small_bat(600, 205, 0.9, 15)
small_bat(95, 170, 1.0, 8)
small_bat(380, 120, 0.8, -5)

t.hideturtle()
print("月夜城堡畫好了！")
`,
  // ----------  () ----------
  halloween:`import turtle
import math

# =====================================================================
#  Happy Halloween 標題圖：用 turtle 一筆一畫重現
# ---------------------------------------------------------------------
#  做法說明（為什麼這樣寫）：
#   1. 先用「圖片座標」（640 x 640，y 往下）設計每個形狀，
#      再用 T() 轉成海龜座標（原點在中心，y 往上）。
#   2. 字母不是用一條線畫，而是用「緞帶 ribbon」：
#      沿著一條中心線，左右各偏移一半寬度，圍成一塊會「粗細漸變」的多邊形，
#      再填滿黑色。這樣才有哥德式字體那種筆畫尖端的感覺。
#   3. 字母頂端和底部的小捲鬚用「螺旋 curl」：半徑一路縮小的螺旋線，
#      也是做成緞帶（越捲越細）。
#   4. 骷髏頭、蝙蝠是「多邊形 + 橢圓」堆出來的，白色的眼睛牙齒最後再蓋上去。
#   5. 橘色的 HAPPY 是一個一個字母，沿著一條小拱形排列並且稍微旋轉。
# =====================================================================

# ---------- 1. 基本設定 ----------
S = 0.6                    # 整體縮放（想畫大一點就調大，例如 0.8）
IMG_W = 640                # 設計圖的寬
IMG_H = 640                # 設計圖的高
BLACK = "#111111"          # 字的黑色
ORANGE = "#ff8a00"         # HAPPY 的橘色
WHITE = "white"            # 蓋在黑色上面的白色細節

t = turtle.Turtle()
t.hideturtle()
t.speed(0)                 # 0 = 最快（想看到一筆一畫，可以改成 10）


# ---------- 2. 基本工具 ----------

def T(x, y):
    # 設計座標（原點在左上、y 往下） -> 海龜座標（原點在中心、y 往上）
    return ((x - IMG_W / 2) * S, (IMG_H / 2 - y) * S)


def fill_poly(pts, color):
    # 畫一個實心多邊形：pts 是 [(x, y), (x, y), ...]
    x0, y0 = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x0, y0)
    t.pencolor(color)
    t.fillcolor(color)
    t.pensize(1)
    t.pendown()
    t.begin_fill()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.goto(x0, y0)
    t.end_fill()
    t.penup()


def polyline(pts, color, width):
    # 畫一條折線（不填色）
    x, y = T(pts[0][0], pts[0][1])
    t.penup()
    t.goto(x, y)
    t.pencolor(color)
    t.pensize(width)
    t.pendown()
    for i in range(1, len(pts)):
        x, y = T(pts[i][0], pts[i][1])
        t.goto(x, y)
    t.penup()


def ellipse_pts(cx, cy, rx, ry, n=20):
    # 橢圓上的 n 個點（用來畫圓形、橢圓形的多邊形）
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    return pts


def place(pts, cx, cy, k, rot):
    # 把一組「以原點為中心」的點：先縮放 k 倍、旋轉 rot 度、再移到 (cx, cy)
    r = math.radians(rot)
    c = math.cos(r)
    s = math.sin(r)
    out = []
    for p in pts:
        x = p[0] * k
        y = p[1] * k
        out.append((cx + x * c - y * s, cy + x * s + y * c))
    return out


# ---------- 3. 緞帶：粗細漸變的筆畫（字母的核心） ----------

def ribbon(pts, w0, w1, color=BLACK):
    # pts：中心線上的點；w0、w1：起點與終點的寬度（中間均勻漸變）
    left = []
    right = []
    n = len(pts)
    for i in range(n):
        # 1) 算出這一點的「前進方向」
        if i == 0:
            dx = pts[1][0] - pts[0][0]
            dy = pts[1][1] - pts[0][1]
        elif i == n - 1:
            dx = pts[i][0] - pts[i - 1][0]
            dy = pts[i][1] - pts[i - 1][1]
        else:
            dx = pts[i + 1][0] - pts[i - 1][0]
            dy = pts[i + 1][1] - pts[i - 1][1]
        length = math.sqrt(dx * dx + dy * dy)
        if length == 0:
            length = 1
        # 2) 法線（垂直於前進方向）
        nx = -dy / length
        ny = dx / length
        # 3) 這一點的半寬
        half = (w0 + (w1 - w0) * i / (n - 1)) / 2
        left.append((pts[i][0] + nx * half, pts[i][1] + ny * half))
        right.append((pts[i][0] - nx * half, pts[i][1] - ny * half))
    right.reverse()
    fill_poly(left + right, color)


def stroke(p0, p1, w0, w1):
    # 一條直的緞帶筆畫（字母的豎線）
    ribbon([p0, p1], w0, w1)


def arc(cx, cy, rx, ry, a0, a1, w0, w1):
    # 橢圓弧形緞帶：角度 a0 -> a1（度；0 = 右、90 = 下、180 = 左、270 = 上）
    pts = []
    n = 18
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        pts.append((cx + rx * math.cos(a), cy + ry * math.sin(a)))
    ribbon(pts, w0, w1)


def curl(x, y, ang, r0, turns, spin, w0, w1):
    # 捲鬚：從 (x, y) 出發，朝 ang 度的方向，捲成越來越小的螺旋
    #   r0    起始半徑      turns 捲幾圈（1.0 = 一整圈）
    #   spin  +1 = 順時針捲，-1 = 逆時針捲
    #   w0, w1 起點與尖端的粗細
    phi0 = ang - 90 * spin
    cx = x - r0 * math.cos(math.radians(phi0))
    cy = y - r0 * math.sin(math.radians(phi0))
    pts = []
    n = 16
    for i in range(n + 1):
        s = i / n
        r = r0 * (1 - 0.78 * s)                       # 半徑越來越小
        phi = math.radians(phi0 + spin * turns * 360 * s)
        pts.append((cx + r * math.cos(phi), cy + r * math.sin(phi)))
    ribbon(pts, w0, w1)


# ---------- 4. 蝙蝠 ----------

def bat(cx, cy, k, rot):
    # 以蝙蝠身體中心為原點的形狀，總寬約 96 單位
    wing = [(-6, -6), (-30, -20), (-48, -16), (-44, -2), (-36, -4),
            (-34, 8), (-26, 2), (-22, 14), (-14, 6), (-10, 14), (-5, 8)]
    wing_r = [(-x, y) for (x, y) in wing]              # 右翅膀 = 左翅膀左右翻轉
    body = ellipse_pts(0, 4, 8, 13, 14)
    head = ellipse_pts(0, -9, 6, 6, 12)
    ear_l = [(-6, -12), (-5, -25), (-1, -13)]
    ear_r = [(6, -12), (5, -25), (1, -13)]
    for shape in [wing, wing_r, body, head, ear_l, ear_r]:
        fill_poly(place(shape, cx, cy, k, rot), BLACK)
    # 翅膀上的白色骨架線
    ribs = [(-40, -8), (-34, 4), (-24, 9), (-14, 10)]
    for (rx, ry) in ribs:
        polyline(place([(-8, -5), (rx, ry)], cx, cy, k, rot), WHITE, 1)
        polyline(place([(8, -5), (-rx, ry)], cx, cy, k, rot), WHITE, 1)


bat(246, 200, 0.45, 0)         # 左上的小蝙蝠（在兩個 l 的上方）
bat(609, 240, 0.6, -15)        # 右邊的大蝙蝠（稍微傾斜）


# ---------- 5. 字母：H ----------
stroke((56, 196), (58, 348), 22, 18)            # 左豎
stroke((120, 200), (122, 342), 20, 17)          # 右豎
stroke((58, 270), (122, 258), 14, 14)           # 中間橫槓（微微傾斜）
fill_poly([(44, 200), (54, 180), (70, 200)], BLACK)   # 左豎頂端的尖角
curl(56, 196, 200, 14, 1.1, -1, 12, 3)          # 左上的大捲鬚（向左捲）
curl(122, 200, 330, 10, 0.9, 1, 10, 3)          # 右豎頂端的小捲鬚
curl(58, 348, 170, 12, 1.0, 1, 12, 3)           # 左下的腳
curl(122, 342, 10, 11, 0.9, -1, 11, 3)          # 右下的腳

# ---------- 6. 字母：a ----------
arc(168, 308, 20, 30, 300, 60, 13, 13)          # 圓肚（從右上繞過左邊到右下）
stroke((191, 268), (193, 346), 18, 16)          # 右邊的豎線
curl(168, 278, 190, 9, 0.9, -1, 8, 2)           # 頂端的小捲
curl(193, 346, 10, 9, 0.8, -1, 9, 2)            # 右下的小勾

# ---------- 7. 字母：l（第一個） ----------
stroke((224, 240), (223, 346), 21, 18)
fill_poly([(212, 244), (224, 228), (238, 244)], BLACK)
curl(224, 240, 205, 12, 1.1, -1, 12, 3)
curl(223, 346, 10, 10, 0.8, -1, 10, 2)

# ---------- 8. 字母：l（第二個） ----------
stroke((266, 236), (266, 344), 21, 18)
fill_poly([(254, 240), (266, 224), (280, 240)], BLACK)
curl(266, 236, 200, 13, 1.1, -1, 12, 3)
curl(266, 344, 170, 10, 0.8, 1, 10, 2)

# ---------- 9. 骷髏頭（取代字母 o） ----------
SX = 316                                        # 骷髏中心的 x
SY = 296                                        # 骷髏中心的 y
fill_poly(ellipse_pts(SX, SY, 34, 33, 28), BLACK)                       # 頭殼
fill_poly([(292, 308), (340, 308), (334, 338), (298, 338)], BLACK)      # 下巴
# --- 白色細節 ---
fill_poly([(298, 282), (312, 289), (310, 302), (296, 298)], WHITE)      # 左眼（斜斜的凶眼）
fill_poly([(334, 282), (320, 289), (322, 302), (336, 298)], WHITE)      # 右眼
fill_poly([(316, 306), (311, 318), (321, 318)], WHITE)                  # 鼻孔
for dx in [-12, -4, 4, 12]:                                             # 牙齒的縫隙
    fill_poly([(SX + dx - 2, 326), (SX + dx + 2, 326),
               (SX + dx + 2, 338), (SX + dx - 2, 338)], WHITE)
polyline([(330, 264), (334, 274), (327, 281)], WHITE, 1)                # 頭殼上的裂痕

# ---------- 10. 字母：w ----------
stroke((362, 250), (378, 340), 18, 14)          # 第 1 劃：往下
stroke((378, 340), (396, 278), 14, 12)          # 第 2 劃：往上
stroke((396, 278), (410, 340), 12, 14)          # 第 3 劃：往下
stroke((410, 340), (430, 250), 14, 16)          # 第 4 劃：往上
fill_poly(ellipse_pts(378, 338, 8, 8, 12), BLACK)      # 補上轉角，避免出現缺口
fill_poly(ellipse_pts(396, 280, 6, 6, 12), BLACK)
fill_poly(ellipse_pts(410, 338, 8, 8, 12), BLACK)
curl(362, 250, 235, 9, 0.9, -1, 9, 2)           # 左上的捲鬚（向上）
curl(430, 250, 330, 11, 1.0, 1, 11, 3)          # 右上的捲鬚（向右捲）

# ---------- 11. 字母：e（第一個） ----------
arc(472, 306, 21, 32, 0, -320, 13, 11)          # 從右邊逆時針繞一圈
stroke((451, 306), (493, 301), 12, 10)          # 中間的橫線

# ---------- 12. 字母：e（第二個，位置略低，像手寫的跳動感） ----------
arc(530, 309, 21, 32, 0, -320, 13, 11)
stroke((509, 309), (551, 304), 12, 10)

# ---------- 13. 字母：n ----------
stroke((582, 270), (583, 348), 18, 16)          # 左豎
arc(606, 300, 24, 28, 180, 360, 15, 15)         # 上方的拱形（從左經過頂端到右）
stroke((630, 300), (631, 346), 18, 15)          # 右豎
curl(582, 270, 200, 9, 1.0, -1, 9, 2)           # 左上的捲鬚
curl(631, 346, 20, 10, 0.9, -1, 10, 2)          # 右下的收尾

# ---------- 14. 橘色的 HAPPY（沿著拱形排列，每個字母稍微旋轉） ----------
# 每個字母用「幾條折線」組成，座標範圍 x 0~10、y 0~14
LETTERS = {
    "H": [[(0, 0), (0, 14)], [(10, 0), (10, 14)], [(0, 7), (10, 7)]],
    "A": [[(0, 14), (5, 0), (10, 14)], [(2, 9), (8, 9)]],
    "P": [[(0, 14), (0, 0), (7, 0), (10, 3), (7, 7), (0, 7)]],
    "Y": [[(0, 0), (5, 7), (10, 0)], [(5, 7), (5, 14)]],
}
word = "HAPPY"
for i in range(len(word)):
    u = (i - 2) / 2                 # -1、-0.5、0、0.5、1：越靠兩邊，u 越大
    cx = 498 + u * 68               # 字母的水平位置
    cy = 209 + 10 * u * u           # 中間最高、兩邊往下（拱形）
    rot = u * 14                    # 越靠兩邊，傾斜越多
    for line in LETTERS[word[i]]:
        local = [(px - 5, py - 7) for (px, py) in line]     # 讓字母以中心為原點
        polyline(place(local, cx, cy, 1.7, rot), ORANGE, 2)

t.hideturtle()
print("Happy Halloween 畫好了！")
`
};

$('examples').onchange = e => {
  if (EXAMPLES[e.target.value]) setCode(EXAMPLES[e.target.value]);
  e.target.value = '';
};
