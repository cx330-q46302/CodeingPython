
# 社長碎碎念：
那些關於網頁設計的事情......
如果同學對設計前端網頁有興趣的話，歡迎閱讀本篇
不適用0基礎的同學自行練習喔!!!
(可以配飯慢慢看)
---

# 01.整體設計

| 想做到的事        | 用的方法                                   | 語言              |
| ------------ | -------------------------------------- | --------------- |
| 左右、上下分區      | Flexbox 排版                             | CSS             |
| 左 1/3、右 2/3  | `width: 33.333%` 加 `flex: 1`（右邊吃掉剩下空間） | CSS             |
| 可拖曳調整大小      | 分隔線 + 指標事件（pointer events）             | HTML + CSS + JS |
| 顏色統一、好修改     | CSS 變數                                 | CSS             |
| 按鈕、編輯區、輸出區   | 語意標籤 + `id` 當作「把手」                     | HTML            |
| 載入 Python 引擎 | 動態建立 `<script>`，失敗自動換備用網址              | JS              |
| 執行時不卡死       | `async / await` + `try / catch`        | JS              |

> [!tip] 整體思路：三種語言各管一件事
> - **HTML**：有哪些東西（骨架）
> - **CSS**：長什麼樣子、放在哪裡（外觀與位置）
> - **JavaScript**：按下去會發生什麼事（行為）

---

# 02.HTML 筆記（骨架）

## 1. 基本結構
```html
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Python 小畫家</title>
</head>
<body>
  ...畫面上看得到的東西...
</body>
</html>
```
- `<head>`：給瀏覽器看的設定（標題、編碼、樣式）。
- `<body>`：畫面上看得到的內容。
- `charset="utf-8"`：沒寫的話中文可能變亂碼。
- `lang="zh-Hant"`：告訴瀏覽器這是繁體中文。

## 2. 用有意義的標籤分區
```html
<header> 上方按鈕列 </header>
<div id="main">
  <section id="left"> 左半部 </section>
  <section id="right"> 右半部 </section>
</div>
```
- `header`、`section` 比一堆 `div` 更好讀，一看就知道用途。
- 本頁的巢狀關係：`main` 裡面有 `left`、`vsplit`、`right`；`left` 裡面又有 `graphWrap`、`hsplit`、`outWrap`。

## 3. `id`：給 JavaScript 與 CSS 抓取
```html
<button id="runBtn">▶ 執行</button>
```
- `id` 在整頁只能出現一次。
- JavaScript 用 `document.getElementById("runBtn")` 抓到它。CSS 用 `#runBtn { ... }` 設定它。

## 4. 標籤
| 標籤 | 用途 |
| ---- | ---- |
| `<textarea>` | 多行輸入，用來寫 Python |
| `<pre>` | 保留空格與換行，用來顯示 `print` 結果 |
| `<button>` | 按鈕 |
| `<div>` | 通用盒子，裝圖形畫布 |
| `title="..."` 屬性 | 滑鼠停在上面會出現提示文字 |

## 5. 神奇小技巧
- **註解**：`<!-- 這是註解 -->`，我在檔案開頭寫了「區塊目錄」，用搜尋 `【區塊】` 可以快速跳轉。
- `<script>` 放在 `</body>` 前面：先讓畫面出來，再執行程式，才抓得到上面的元素。
- `<textarea spellcheck="false">`：關閉紅色波浪底線，寫程式時才不會干擾

---

# 03.CSS 筆記（外觀與位置）

## 1. CSS 寫法
```css
選擇器 {
  屬性: 值;
}
```

| 選擇器 | 意思 |
| ---- | ---- |
| `button` | 所有按鈕 |
| `#runBtn` | id 是 runBtn 的那一個 |
| `.label` | class 是 label 的全部 |
| `.vsplit:hover` | 滑鼠移上去時 |



## 2. CSS 變數（統一管理顏色）
```css
:root {
  --bg: #1e1e2e;
  --accent: #ff8c1a;
}
body { background: var(--bg); }
button { background: var(--accent); }
```
- `:root` 代表整份網頁，變數寫在這裡，全部地方都能用。
- 要換主題色，只改最上面一處。萬聖節改橘色、聖誕節改紅色很方便:)

## 3. `box-sizing: border-box`
```css
* { box-sizing: border-box; }
```
- 讓 `padding`（內距）和邊框算在寬度裡面，不會因為加了內距而撐破版面。幾乎每個網頁都會寫。

## 4. Flexbox（本頁最重要的排版方法 給到⭐️⭐️⭐️）
```css
#main { display: flex; }            /* 子元素橫向排成一排 */
#left { width: 33.333%; }           /* 左邊固定比例 */
#right { flex: 1; }                 /* 右邊吃掉剩下所有空間 */
```
- 預設橫向排列；要直向排列就寫 `flex-direction: column`。
- `flex: 1` 的意思是「剩下的空間我全包」。
- **上下分區**：`#left` 設 `display: flex; flex-direction: column`，裡面的 `graphWrap` 用 `flex: 0 0 55%`（不放大、不縮小、固定 55%），`outWrap` 用 `flex: 1` 吃剩下的。
- 滿版高度：`html, body { height: 100% }` 加上 `body { display: flex; flex-direction: column }`，再讓主區域 `flex: 1`。
- ⚠️ **`min-height: 0` 的原因**：flex 子元素預設不肯縮得比內容小，內容多時會把版面撐出螢幕。加上 `min-height: 0` 才能正常出現捲軸。

## 5. 捲動與裁切
```css
#out { overflow: auto; white-space: pre-wrap; }
#graph { overflow: hidden; }
```
- `overflow: auto`：內容太多時才出現捲軸。
- `overflow: hidden`：超出範圍的部分直接藏起來。
- `white-space: pre-wrap`：保留換行，遇到邊界又會自動折行。

## 6. 滑鼠游標與懸停效果
```css
.vsplit { cursor: col-resize; }   /* 左右拖曳的游標 */
.hsplit { cursor: row-resize; }   /* 上下拖曳的游標 */
.vsplit:hover { background: var(--accent); }
```
- 游標變化是在提示使用者「這裡可以拖」。

## 7. 字型與等寬字體
```css
font-family: Menlo, Consolas, monospace;
```
- 寫程式要用**等寬字體**，每個字一樣寬，縮排才會對齊。
- 字型是「優先順序清單」：Mac 用 Menlo，Windows 用 Consolas，都沒有就用系統預設等寬字體。

## 8. 拖曳時防止選到文字
```css
body.dragging { user-select: none; }
```
- 拖曳時 JavaScript 會暫時幫 `body` 加上 `dragging` 這個 class，避免滑鼠拖過去時反白文字。放開後再移除。這就是「用 JS 切換 class，由 CSS 負責外觀」的標準做法。

---

# 04.JavaScript 筆記（行為）

## 1. 抓元素、縮短寫法
```js
const $ = id => document.getElementById(id);
const out = $('out');
```
- `const` 宣告不會再被改掉的變數。
- `id => ...` 是**箭頭函式**，等同 `function(id){ return ... }`。
- 這裡把長長的 `document.getElementById` 縮成 `$`，後面寫起來比較短。

## 2. 事件：按下去會發生什麼事
```js
runBtn.onclick = runCode;                       // 按按鈕就執行 runCode

codeBox.addEventListener('keydown', e => {      // 鍵盤事件
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();                         // 取消預設行為（不要換行）
    runCode();
  }
});
```
- `e.ctrlKey` 是 Windows 的 Ctrl，`e.metaKey` 是 Mac 的 Cmd。兩個都寫，兩邊電腦都能用。
- `e.preventDefault()`：阻止瀏覽器原本的動作。例如 Tab 鍵原本是跳到下一個欄位，我們改成輸入 4 個空格。

## 3. `textContent` 與 `innerHTML`
```js
out.textContent = '';        // 清空輸出（純文字）
graph.innerHTML = '';        // 清空圖形區（含裡面的畫布元素）
span.textContent = text;     // 顯示學生的輸出，不會被當成 HTML 執行
```
- 顯示使用者或程式產生的文字時，優先用 `textContent`，比較安全。
- `innerHTML` 會把字串當 HTML 解析，用來清空畫布這種情況才合適。

## 4. 動態載入外部程式並自動換備用網址
```js
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
```
- 用 JS 建立 `<script>` 標籤插進頁面，就能載入外部檔案。
- 傳入一份網址清單，第一個失敗就試第二個（`onerror` 呼叫 `next()`），這是**備用來源**的概念。

## 5. `async / await` 與 `try / catch`
```js
async function runCode() {
  ...
  try {
    await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody(...));
  } catch (e) {
    addOut(e.toString(), true);     // Python 寫錯時，錯誤顯示在輸出區
  }
}
```
- `async` 函式裡可以用 `await`，意思是「等這件事做完再往下」，網頁不會卡住。
- `try` 放可能出錯的程式，出錯就跳到 `catch`。這裡用來把 Python 的錯誤訊息顯示給學生看。

## 6. 狀態旗標
```js
let skulptReady = false, running = false;
if (!skulptReady || running) return;    // 沒準備好或正在跑，就不要重複執行
```
- 用 `true / false` 變數記住目前狀態，避免學生連點按鈕造成重複執行。

## 7. 拖曳調整大小（pointer events）
```js
handle.addEventListener('pointerdown', e => {
  handle.setPointerCapture(e.pointerId);        // 鎖定滑鼠，拖出分隔線也不會斷
  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', stop);   // 放開時取消監聽
});
```
- 流程是：**按下 → 移動（持續計算新寬度）→ 放開（收尾）**。
- 計算寬度：`ev.clientX`（滑鼠在螢幕的 X 位置）減掉容器左邊位置，就是左半部新寬度。
- `Math.max(最小值, Math.min(算出的值, 最大值))` 可以把數值限制在範圍內，不讓分區被拖到消失。

## 8. Skulpt：在瀏覽器執行 Python
```js
Sk.configure({
  output: t => addOut(t),            // Python 的 print 會呼叫這裡
  inputfun: p => prompt(p),          // Python 的 input 會跳出輸入框
  __future__: Sk.python3
});
Sk.TurtleGraphics = { target: 'graph', width: ..., height: ... };   // 海龜畫在 #graph
```
- 設定「Python 的輸入、輸出、畫圖要接到網頁上的哪裡」，Skulpt 就能把 Python 程式在網頁上跑起來。

---

# 05.待測試and待辦

- [x] 雙擊開啟後是否顯示「✅ 準備好了」
- [x] 連續執行兩次，圖形是否正常重畫
- [x] `input()`、f-string、`time.sleep()` 是否可用
- [x] 「停止」按鈕能否中斷無窮迴圈
- [x] 舊版已在學校電腦測試過
- [x] 新版（三個檔案、CodeMirror、無限畫布）在學校電腦測試
- [x] 加入顏色選擇
- [x] 迴圈南瓜範例（先跑過現有範例，再決定要不要加入）
- [x] 加入可拖曳的表情符號（貼紙在最上層）
- [x] 無限畫布（拖曳平移、滾輪縮放、格線）
- [x] 程式碼行號與語法上色（CodeMirror 5）
- [x] 淺色／深色模式（預設淺色）
- [x] 填色（`fillcolor` + `begin_fill` / `end_fill`）實測可用
- [ ] 觸控螢幕雙指縮放（目前只能用右上角 ＋－ 按鈕）
- [ ] 學校電腦若畫布卡頓，把 `WORLD = 2400` 改小（例如 1600）

---

# 06.拆成三個檔案

## 1. 為什麼要拆
程式變長之後，一個檔案裡混著 HTML、CSS、JS 很難找、很難改！！！
拆開以後「要改外觀就開 CSS、要改功能就開 JS」。

| 檔案 | 負責 |
| ---- | ---- |
| `Codeing.html` | 版面骨架（有哪些按鈕、分區） |
| `Codeing.css` | 外觀、顏色、淺色／深色主題 |
| `Codeing.js` | 所有功能（執行 Python、無限畫布、貼紙、顏色按鈕…） |

## 2. HTML 怎麼接上另外兩個
```html
<head>
  <link rel="stylesheet" href="Codeing.css">   <!-- 接上 CSS -->
</head>
<body>
  ...
  <script src="Codeing.js"></script>          <!-- 接上 JS，放在 body 最後面 -->
</body>
```
- `href` / `src` 寫的是**相對路徑**：檔名前面沒有資料夾，代表「跟自己同一個資料夾」。
- JS 必須放在 `</body>` 前，否則程式執行時頁面上的元素還沒出現，抓不到。

## 3. 發給別人時
> [!warning]
> **三個檔案要一起發**（或壓成一個 zip），下載後要放在同一個資料夾，再雙擊 `Codeing.html`。缺一個，頁面就會跑版或沒有功能。

---

# 07.進階功能筆記（第二部分）

## 1. 淺色／深色主題
**CSS：用 `data-theme` 切換一組變數**
```css
:root, :root[data-theme="light"] { --bg: #ffffff; --text: #1f1f1f; }
:root[data-theme="dark"]         { --bg: #1e1e1e; --text: #cccccc; }
body { background: var(--bg); color: var(--text); }
```
**JS：改 `data-theme`，並記住選擇**
```js
function setTheme(t) {
  document.documentElement.dataset.theme = t;      // 改掉 <html data-theme="...">
  try { localStorage.setItem('theme', t); } catch (e) {}
}
```
- 觀念：**顏色都寫成變數，換主題就是換一組變數的值**，其他地方一個字都不用改。
- `localStorage`：瀏覽器幫你記在電腦上的小資料，重開網頁還在。用 `try / catch` 包起來，因為有些瀏覽器不允許。
- 預設淺色：學校電腦螢幕可能對比不好，淺色比較保險。

## 2. 程式碼編輯器：CodeMirror 5（行號 + 語法上色）
```js
cm = CodeMirror.fromTextArea(codeBox, {
  mode: 'python',        // 用 Python 的語法規則上色
  theme: 'vscode',       // 會套用 CSS 裡的 .cm-s-vscode
  lineNumbers: true,     // 左邊顯示行號
  indentUnit: 4
});
```
- `fromTextArea`：把原本的文字框「升級」成編輯器。載入失敗時文字框還在，這就是**備援方案 fallback**的概念。
- 上色是靠 CSS class：CodeMirror 把每個字包上 `cm-keyword`、`cm-string`、`cm-comment` 等 class，我們在 CSS 裡幫它們指定顏色。
  ```css
  .cm-s-vscode .cm-keyword { color: var(--cm-keyword); }
  .cm-s-vscode .cm-string  { color: var(--cm-string); }
  ```
- 因為顏色也是 CSS 變數，所以切換深淺色時編輯器會**自動跟著換**。
- 配色參照 VS Code：深色 Dark+（背景 `#1e1e1e`、關鍵字紫、字串橘褐、註解綠）、淺色 Light+。
- 拖曳分隔線改變大小時，用 `ResizeObserver` 呼叫 `cm.refresh()` 讓編輯器重新計算。

> [!tip] CSS 優先順序（specificity）
> CodeMirror 自己也帶一份 CSS，實際上會和我們的樣式互相覆蓋。用 `#editorHost .CodeMirror`（多一層 id）讓自己的規則「比較大」，才不會被蓋掉。規則是：**id 選擇器 > class 選擇器 > 標籤選擇器**，同級時後載入的贏。

## 3. 無限畫布（平移 + 縮放 + 格線）
**核心想法：把海龜畫布放在一個「世界層」，只移動、縮放這一層。**
```js
const view = { x: 0, y: 0, k: 1 };   // x,y：原點在畫面上的位置；k：縮放倍率
world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.k})`;
```
- **平移**：拖曳時把 `view.x`、`view.y` 加上滑鼠移動量。
- **滑鼠位置為中心的縮放**：縮放前後，滑鼠指到的那一點要留在原地：
  ```js
  view.x = px - (px - view.x) * f;   // f = 新縮放倍率 / 舊縮放倍率
  view.y = py - (py - view.y) * f;
  ```
- **拖曳和滾輪**用 `pointermove`、`wheel` 事件。`wheel` 要寫 `{ passive: false }` 才能用 `preventDefault()` 阻止整頁跟著捲動。
- **格線**是另外一張 `<canvas>`，每次平移或縮放都**重新畫一次**「目前畫面範圍」的線，所以可以無限延伸。間距用 `niceStep()` 選 1、2、5 × 10 的次方，縮放時自動調整。
- `devicePixelRatio`：Retina 螢幕上要把 canvas 大小乘以這個值，線條和數字才不會模糊。

> [!warning] 限制
> Skulpt 的海龜只能畫在「一張固定大小的畫布」上，所以我們做了 2400×2400（`WORLD`），原點在中心。格線可以無限，但海龜走超過約 ±1200 格就會被截掉。放大超過 1 倍時線條會有點糊（點陣圖放大），格線和數字不會。

## 4. 圖層順序（z-index）
```css
#world    { position: absolute; z-index: 1; }   /* 海龜圖形 */
#gridCv   { position: absolute; z-index: 2; }   /* 格線 */
#stickers { position: absolute; z-index: 3; }   /* 表情貼紙 */
#viewBtns { position: absolute; z-index: 5; }   /* 右上角按鈕 */
```
- `z-index` 數字越大越在上面，**要先設 `position`（例如 `absolute`）才有效**。
- 想讓某一層「看得到但滑鼠穿過」，用 `pointer-events: none`（格線層、貼紙容器都這樣設），貼紙本體再設 `pointer-events: auto` 才抓得到。

## 5. 表情貼紙
- **從托盤拖出**：`pointerdown` 時建立一個跟著滑鼠的「幽靈」（`position: fixed`），放開時如果在畫布範圍內，就在那個位置建立真正的貼紙。
- **貼紙用「世界座標」記位置**：`toWorld()` 把螢幕座標轉成世界座標，貼紙才會跟著平移、縮放。
  ```js
  x: (clientX - box.left - view.x) / view.k
  ```
- **`e.stopPropagation()`**：貼紙被按下時不要讓事件「冒泡」到畫布，否則拖貼紙時整個畫布也會跟著被拖走。
- 雙擊刪除：`addEventListener('dblclick', () => s.remove())`。

## 6. 顏色按鈕（線條＆填色）
```js
b.addEventListener('mousedown', e => e.preventDefault());          // 不搶走編輯器的游標
b.addEventListener('click', () => insertAtCursor('"' + name + '"')); // 插入 "red"
```
- 按鈕是用 JS 迴圈「建立」的（`document.createElement('button')`），顏色清單只要改一個陣列 `COLORS`，按鈕就自動增減。這和教學的迴圈觀念一樣。
- **區分線條與填色**：線條是**空心圓環**，填色是**實心方塊**（差別只在 CSS：`border-radius: 50%` + `border` 對上 `background`）。
- 填色的完整寫法（Python）：
  ```python
  t.fillcolor("yellow")
  t.begin_fill()      # 開始填色
  for i in range(4):
      t.forward(100)
      t.left(90)
  t.end_fill()        # 結束填色
  ```

---

# 08.外部參考連結

## 語法
- [MDN HTML](https://developer.mozilla.org/zh-TW/docs/Web/HTML)（繁中）
- [MDN CSS](https://developer.mozilla.org/zh-TW/docs/Web/CSS)（繁中）
- [MDN JavaScript](https://developer.mozilla.org/zh-TW/docs/Web/JavaScript)（繁中）

## 概念主題
- [Flexbox 基本概念](https://developer.mozilla.org/zh-TW/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox)
- [Flexbox 圖解速查](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [CSS 變數（自訂屬性）](https://developer.mozilla.org/zh-TW/docs/Web/CSS/Using_CSS_custom_properties)
- [指標事件](https://developer.mozilla.org/zh-TW/docs/Web/API/Pointer_events)（拖曳用）
- [async 函式](https://developer.mozilla.org/zh-TW/docs/Web/JavaScript/Reference/Statements/async_function)
- [CSS transform](https://developer.mozilla.org/zh-TW/docs/Web/CSS/transform)（平移、縮放）
- [z-index](https://developer.mozilla.org/zh-TW/docs/Web/CSS/z-index)（圖層順序）
- [CSS 優先順序 Specificity](https://developer.mozilla.org/zh-TW/docs/Web/CSS/Specificity)
- [Canvas API](https://developer.mozilla.org/zh-TW/docs/Web/API/Canvas_API)（畫格線）
- [ResizeObserver](https://developer.mozilla.org/zh-TW/docs/Web/API/ResizeObserver)
- [localStorage](https://developer.mozilla.org/zh-TW/docs/Web/API/Window/localStorage)

## 程式碼編輯器
- [CodeMirror 5 手冊](https://codemirror.net/5/doc/manual.html)

## 社課延伸
- [Flexbox Froggy](https://flexboxfroggy.com/#zh-tw)（青蛙跳荷葉）
- [W3Schools](https://www.w3schools.com/)（範例多、可直接改直接看結果）

## Python 引擎與海龜繪圖
- [Skulpt 官網](https://skulpt.org/)
- [Skulpt GitHub](https://github.com/skulpt/skulpt)
- [Python 官方 turtle 文件](https://docs.python.org/zh-tw/3/library/turtle.html)（繁中）

感謝你看到了最後！！！第二部分我也剛學，有興趣的同學也可以和我一起討論喔！
程式很有趣對吧~ > <