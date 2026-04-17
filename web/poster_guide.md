# 学术海报制作指南（基于本项目经验）

---

## 一、尺寸与技术规格

- **屏幕尺寸**：1440 × 960px（宽高比 3:2，对应 36×24 英寸）
- **打印尺寸**：36in × 24in（914 × 609mm），横向
- **`@page`**：`size: 36in 24in landscape; margin: 0`
- **生成 PDF**：用 Playwright 脚本生成，设 `width="15in" height="10in"`，并注入 `zoom:1` 覆盖 print CSS，保证单页输出

---

## 二、整体布局

```
┌──────────────── HEADER（全宽，深蓝背景）────────────────┐
│  大标题 / 副标题 / 作者信息                    校徽 Logo │
├────────────┬────────────┬──────────────────────────────┤
│  左列      │  中列      │  右列                        │
│  (flex:1)  │  (flex:1)  │  (flex:1)                    │
├────────────┴────────────┴──────────────────────────────┤
│  FOOTER（参考文献）                                     │
└─────────────────────────────────────────────────────────┘
```

- Body 用 `display:flex; flex-direction:row; gap:16px`
- 每列内部用 `display:flex; flex-direction:column; gap:Xpx`
- Section 用 `flex:N` 分配高度，**必须测量溢出**

---

## 三、防溢出是核心难点

每次改动内容后都要用 JS 测量：

```javascript
(() => {
  const secs = document.querySelectorAll('.sec');
  return Array.from(secs).map(s => ({
    title: s.querySelector('.sec-hdr')?.textContent.trim(),
    overflow: s.scrollHeight - s.offsetHeight
  })).filter(x => x.overflow > 2);
})()
```

**处理溢出的优先级**：
1. 缩短文字（首选）
2. 减小字号（`11px → 10px`）
3. 减小 padding / gap
4. 调整 flex 比例
5. 最后才考虑删内容

**常见 flex 策略**：
- `flex:0 0 auto`：内容自适应高度，不撑满（用于内容固定的 section）
- `flex:1`：填充剩余空间（用于需要撑满的 section）
- `flex:1.3` 等：按比例分配

---

## 四、配色方案

```css
--navy:     #1a237e;  /* 主色，header 背景 */
--navy2:    #283593;
--lavender: #e8eaf6;  /* section 背景 */
--lav-mid:  #9fa8da;  /* 边框 / 分隔线 */
--text:     #1a237e;
--muted:    #4b5563;
```

算法专属色（图表/标签用）：
```css
--dijk: #0284c7;  /* Dijkstra 蓝 */
--manh: #059669;  /* A* Manhattan 绿 */
--eucl: #dc6803;  /* A* Euclidean 橙 */
```

---

## 五、字体

```html
<link href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600;700&family=Inter:wght@400;500;600;700&family=Fira+Code:wght@400;500&display=swap" rel="stylesheet">
```

| 用途 | 字体 | 字重 | 大小 |
|------|------|------|------|
| 大标题 | Crimson Pro | 700 | 50px |
| Section 标题 | Inter | 600 | 11px（全大写） |
| 正文 | Inter | 400 | 11–12px |
| 代码/公式 | Fira Code | 400/500 | 按需 |

---

## 六、Header 结构

```html
<header>
  <div class="hdr-text">
    <h1>项目名称</h1>
    <div class="authors">副标题或一句话描述</div>
    <div class="affil">成员 · 导师 · 学院 · 学校</div>
  </div>
  <div class="logo">
    <img src="assets/logo.png" style="height:78px;">
  </div>
</header>
```

---

## 七、Section 通用结构

```html
<div class="sec" style="flex:1.2;">
  <div class="sec-hdr"><h2>Section Title</h2></div>
  <div class="sec-body" style="padding:7px 12px;">
    <!-- 内容 -->
  </div>
</div>
```

---

## 八、内容建议（三列典型分配）

| 左列 | 中列 | 右列 |
|------|------|------|
| Abstract | System Architecture | Tool Demo（截图/canvas） |
| Background & Motivation | Interactive Features | Performance Results（图表） |
| Algorithm Overview（表格） | Visualization Design | Key Insight（callout 框） |
| Conclusion & Future Work | | |

---

## 九、可视化组件

**条形图**：用 flex + 绝对定位数字标签，高度按比例换算

```html
<div style="display:flex;align-items:flex-end;gap:12px;height:42px;">
  <div style="flex:1;position:relative;height:36px;background:var(--dijk);border-radius:3px 3px 0 0;">
    <div style="position:absolute;bottom:calc(100% + 2px);width:100%;text-align:center;font-weight:700;">368</div>
  </div>
  <!-- 其他柱子... -->
</div>
```

**Canvas Demo**：用 `<canvas>` + JavaScript 绘制，支持 print 背景色（需加 `-webkit-print-color-adjust: exact`）

**Callout 框**：

```html
<div class="callout">
  <div class="callout-lbl">Key Insight</div>
  <p>核心结论文字...</p>
</div>
```

---

## 十、生成 PDF 的正确方式

```python
from playwright.sync_api import sync_playwright
import os

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 960})
    page.goto(f"file://{os.path.abspath('poster.html')}")
    page.wait_for_timeout(2000)

    # 关键：覆盖 print CSS 的 zoom，保证单页
    page.evaluate("""
        const s = document.createElement('style');
        s.textContent = `@media print {
            html { zoom: 1 !important; }
            body, .poster { width: 1440px !important; height: 960px !important; overflow: hidden !important; }
        }`;
        document.head.appendChild(s);
    """)

    page.pdf(
        path="output.pdf",
        width="15in",   # 1440px @ 96dpi = 15in
        height="10in",  # 960px  @ 96dpi = 10in
        print_background=True,
        margin={"top": "0", "right": "0", "bottom": "0", "left": "0"}
    )
    browser.close()
```

> 打印时在打印机设置里选「缩放到纸张」→ 36×24in 即可。

---

## 十一、常见坑

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 内容溢出 section | flex 分配不够 | 测量 scrollHeight，调 flex 或精简文字 |
| PDF 变成 2 页 | `zoom:2.4` 被 Playwright 执行 | 用 JS 注入覆盖 `zoom:1` |
| 打印背景色丢失 | 浏览器默认不打印背景 | `-webkit-print-color-adjust: exact !important` |
| 大量白空间 | 某 section 用了 `flex:2` 但内容少 | 改为 `flex:0 0 auto` |
| Canvas 在 PDF 中空白 | print CSS 缺少 canvas 声明 | 补上 `canvas { display: block; }` |
| 浏览器窗口太窄导致测量失真 | flex-shrink 压缩了海报 | 确保预览窗口宽度 ≥ 1500px |
| `margin-top:auto` 不生效 | 父容器未设 `align-items:stretch` | 父容器加 `align-items:stretch` |
