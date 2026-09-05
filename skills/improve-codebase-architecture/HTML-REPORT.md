# HTML 报告格式

架构评审输出为操作系统临时目录中的单个 HTML 文件。Tailwind 和 Mermaid 通过 CDN 加载；Mermaid 适合图结构，手写 div 和内联 SVG 适合质量图、剖面图与折叠效果，两者按表达需要组合使用。

## 页面骨架

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>{{仓库名称}} 架构评审</title>
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

## 页头

只展示仓库名、日期和紧凑图例：实线框表示模块，虚线表示接缝，红色箭头表示泄漏，粗深色框表示深模块。直接进入候选，不写介绍段落。

## 候选卡片

图形承担主要表达，文字保持简短。每个候选使用一个 `<article>`：

- **标题**：简短描述深化动作，例如“收拢订单接入流程”；
- **徽章**：推荐强度，加上依赖类别标签：`进程内`、`本地可替代`、`ports & adapters` 或 `mock`；
- **涉及文件**：使用等宽小号文字；
- **Before / After**：双栏并排，是卡片主体；
- **问题**：一句话说明摩擦；
- **方案**：一句话说明改变；
- **收益**：用短语说明规则集中、消费者调用和必要验证的改善；
- **ADR 提示**：适用时使用琥珀色单行提示。

不使用长段解释。如果图形需要一段文字才能理解，重新画图。

## 图形模式

按候选选择最能表达问题的模式，不让所有图形长得一样。

### Mermaid 图

依赖、调用流和时序使用 Mermaid `flowchart`、`graph` 或 `sequenceDiagram`。用红色边表示泄漏，用深色块表示深化后的模块。

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

### 手绘框与箭头

当 Mermaid 布局无法突出“一个粗边框深模块包住灰色内部实现”时，用相对定位的 div 画模块，用内联 SVG 画箭头。

### 剖面图

适合展示层层浅转发。Before 用多个薄横条表示调用穿过的层；After 用一个粗横条表示收拢后的职责。

### 质量图

每个模块画接口和实现两个矩形。Before 中接口矩形几乎与实现同高，表示浅；After 中接口短、实现高，表示深。

### 调用图折叠

Before 展示嵌套调用树；After 把同一调用树收进一个模块，内部调用以淡色展示。

## 视觉风格

- 使用编辑式而非企业仪表盘风格，留足空白；
- 颜色克制：一个主色，红色表示泄漏，琥珀色表示警告；
- 图形高度约 320px，保证 before / after 无需滚动即可并排阅读；
- 模块标签使用小号大写或紧凑字距，呈现示意图而非应用 UI；
- 除 Tailwind CDN 和 Mermaid ESM 外不加入应用脚本或交互逻辑。

## 首选建议

使用一张更大的卡片，只包含候选名称、一句推荐原因和指向候选卡片的锚点。

## 语气与词汇

使用简洁业务语言和代码已有标识。职责归属、接口和局部性沿用 `codebase-design` 的判断；深、浅用于比较接口暴露的复杂度与模块内部承担的规则。

合适的表达：

- “订单接入模块较浅：接口几乎等同于实现。”
- “定价逻辑泄漏到了接缝之外。”
- “深化：一个接口，一个测试位置。”
- “调用方通过现有外部边界验证规则，无需为内部函数增加接口。”

收益条目直接说结果，例如“同一规则集中在一个模块”“调用方只需一次业务操作”。避免“更易维护”“代码更干净”等无法说明具体收益的笼统表述。
