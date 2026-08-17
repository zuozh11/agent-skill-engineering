#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SKILL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LAYOUT_FILES = ["domain.md", "context-format.md"];
const COMMON_FILES = ["rules-format.md"];

function usage() {
  return "用法：node render-layout-docs.mjs <single|multiple> <目标目录>\n";
}

function renderLayout(raw, selected, file) {
  let output = raw.replaceAll("\r\n", "\n");
  for (const layout of ["single", "multiple"]) {
    const start = `<!-- layout:${layout}:start -->`;
    const end = `<!-- layout:${layout}:end -->`;
    let count = 0;
    while (output.includes(start)) {
      const startIndex = output.indexOf(start);
      const endIndex = output.indexOf(end, startIndex + start.length);
      if (endIndex < 0) throw new Error(`${file}：缺少完整的 ${layout} 布局标记`);
      const bodyStart = startIndex + start.length;
      const body = output.slice(bodyStart, endIndex).replace(/^\n|\n$/g, "");
      output = output.slice(0, startIndex) + (layout === selected ? body : "") + output.slice(endIndex + end.length);
      count += 1;
    }
    if (!count || output.includes(end)) {
      throw new Error(`${file}：缺少完整的 ${layout} 布局标记`);
    }
  }
  if (/<!-- layout:(?:single|multiple):(?:start|end) -->/.test(output)) {
    throw new Error(`${file}：存在未处理的布局标记`);
  }
  return output.replace(/\n{3,}/g, "\n\n").replace(/\s*$/u, "\n");
}

function main() {
  const [layout, outputDir, ...rest] = process.argv.slice(2);
  if (rest.length || !["single", "multiple"].includes(layout) || !outputDir) {
    process.stderr.write(usage());
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(outputDir, { recursive: true });
  for (const file of LAYOUT_FILES) {
    const raw = fs.readFileSync(path.join(SKILL_DIR, file), "utf8");
    fs.writeFileSync(path.join(outputDir, file), renderLayout(raw, layout, file), "utf8");
  }
  for (const file of COMMON_FILES) {
    fs.copyFileSync(path.join(SKILL_DIR, file), path.join(outputDir, file));
  }
}

main();
