# HTML 报告格式

架构审查以单个自包含 HTML 文件呈现，写入系统临时目录。Tailwind 和 Mermaid 均来自 CDN。Mermaid 可靠处理图状图表；手工 div 和内联 SVG 处理更编辑感的可视化（质量图、截面图）。混合使用——不要所有图都用 Mermaid，那样会显得千篇一律。

## 脚手架

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>架构审查 — {{仓库名}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## 头部

仓库名、日期、紧凑图例：实线框 = 模块，虚线 = 接缝，红色箭头 = 泄漏，粗深色框 = 深模块。不写介绍段落——直接进入候选。

## 候选卡片

图表承载主要信息。文字精简、朴素，使用术语表词汇（[LANGUAGE.md](LANGUAGE.md)）而不加修饰。

每个候选是一个 `<article>`：

- **标题** ——简短，命名加深动作（如"折叠 Order 接收管线"）。
- **徽章行** ——推荐强度（`Strong` = emerald，`Worth exploring` = amber，`Speculative` = slate），加一个依赖类别标签（`in-process`、`local-substitutable`、`ports & adapters`、`mock`）。
- **文件** ——等宽列表，`font-mono text-sm`。
- **Before / After 图** ——核心。两列并排。见下方模式。
- **问题** ——一句话。哪里痛。
- **方案** ——一句话。改变什么。
- **收益** ——要点，每条 ≤6 个词。如"测试只打一个接口"、"定价逻辑不再泄漏"、"删除 4 个浅包装"。
- **RULES 提示**（如适用）——琥珀色底框中一行。

不写解释段落。如果图表需要一段话才能看懂，重画图表。

## 图表模式

选择适合候选的模式。混合使用。不要让每张图看起来一样——多样性本身就是要点。

### Mermaid 图（依赖/调用流的主力）

当要点是"X 调用 Y 调用 Z，看这团乱麻"时用 Mermaid `flowchart` 或 `graph`。用 Tailwind 样式卡片包裹，不要让它看起来像空降的。用 classDef 给泄漏边着红色、深模块着深色。序列图适合表达"before: 6 次往返；after: 1 次"。

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
  <pre class="mermaid">
    flowchart LR
      A[OrderHandler] --> B[OrderValidator]
      B --> C[OrderRepo]
      C -.leak.-> D[PricingClient]
      classDef leak stroke:#dc2626,stroke-width:2px;
      class C,D leak
  </pre>
</div>
```

### 手工框线图（Mermaid 布局不听话时）

模块用带边框和标签的 `<div>`。箭头用内联 SVG `<line>` 或 `<path>` 绝对定位在相对容器上。当你想让"after"图感觉像一个粗边框的深模块、内部灰化时用这个——Mermaid 渲染不出那种视觉重量。

### 截面图（适合分层浅化）

水平带堆叠（`h-12 border-l-4`）展示调用穿过的层。Before: 6 个薄层各自什么都不做。After: 1 个厚带标注合并后的职责。

### 质量图（适合"接口和实现一样宽"）

每个模块两个矩形——一个表示接口面积，一个表示实现。Before: 接口矩形几乎和实现矩形一样高（浅）。After: 接口矩形矮，实现矩形高（深）。

### 调用图折叠

Before: 函数调用树渲染为嵌套框。After: 同一棵树折叠为一个框，内部调用淡化显示。

## 样式指南

- 偏编辑感，不要企业仪表盘感。大量留白。标题可选衬线体（`font-serif` 配 stone/slate 效果好）。
- 颜色克制：一个强调色（emerald 或 indigo）加红色表示泄漏、琥珀色表示警告。
- 图表保持约 320px 高，before/after 并排时无需滚动。
- 图表内模块标签用 `text-xs uppercase tracking-wider`——读起来像示意图，不像 UI。
- 唯一的脚本是 Tailwind CDN 和 Mermaid ESM 导入。报告是静态的——无应用代码，无交互（Mermaid 自身渲染除外）。

## 首选推荐区域

一张更大的卡片。候选名称，一句话说明为什么，锚链接到其卡片。就这些。

## 语气

朴素中文，精简——但架构名词和动词严格来自 [LANGUAGE.md](LANGUAGE.md)。精简不是偏离术语的借口。

**精确使用：** 模块、接口、实现、深度、深、浅、接缝、适配器、杠杆、局部性。

**绝不替换：** 组件、服务、单元（代替模块）· API、签名（代替接口）· 边界（代替接缝）· 层、包装（代替模块，当你指的是模块时）。

**符合风格的表述：**

- "Order 接收模块是浅的——接口几乎匹配实现。"
- "定价跨接缝泄漏。"
- "加深：一个接口，一个测试点。"
- "两个适配器证明接缝合理：生产用 HTTP，测试用内存。"

**收益要点**用术语表词汇命名增益：*"局部性：bug 集中在一个模块"*、*"杠杆：一个接口，N 个调用点"*、*"接口收缩；实现吸收包装"*。不要写 *"更易维护"* 或 *"更干净的代码"*——这些词不在术语表中，不配出现。

不犹豫，不铺垫，不写"值得注意的是……"。如果一句话能变成要点，就变成要点。如果一个要点能删，就删。如果一个词不在 [LANGUAGE.md](LANGUAGE.md) 中，先找一个在的，再考虑发明新的。
