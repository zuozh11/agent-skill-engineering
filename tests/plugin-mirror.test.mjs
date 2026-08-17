import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = path.join(REPOSITORY_ROOT, "skills");
const MIRROR_ROOT = path.join(REPOSITORY_ROOT, "plugins", "agent-skill-engineering", "skills");

function assertRealDirectory(target, label) {
  const stats = fs.lstatSync(target);
  assert.equal(stats.isSymbolicLink(), false, `${label} 不得是 symbolic link`);
  assert.equal(stats.isDirectory(), true, `${label} 必须是 directory`);
}

function listFiles(root, relativePath = "", label = root) {
  const directory = path.join(root, relativePath);
  assertRealDirectory(directory, relativePath ? `${label}/${relativePath}` : label);
  return fs.readdirSync(directory)
    .filter((name) => name !== ".DS_Store")
    .sort((left, right) => Buffer.from(left).compare(Buffer.from(right)))
    .flatMap((name) => {
      const child = path.join(relativePath, name);
      const childStats = fs.lstatSync(path.join(root, child));
      assert.equal(childStats.isSymbolicLink(), false, `${label}/${child} 不得是 symbolic link`);
      if (childStats.isDirectory()) return listFiles(root, child, label);
      assert.equal(childStats.isFile(), true, `${label}/${child} 必须是 regular file`);
      return [child];
    });
}

test("Codex 插件 Skill 镜像与权威 skills 逐文件一致", () => {
  const sourceFiles = listFiles(SOURCE_ROOT, "", "skills");
  const mirrorFiles = listFiles(MIRROR_ROOT, "", "plugins/agent-skill-engineering/skills");
  assert.deepEqual(mirrorFiles, sourceFiles);
  for (const relativePath of sourceFiles) {
    assert.deepEqual(
      fs.readFileSync(path.join(MIRROR_ROOT, relativePath)),
      fs.readFileSync(path.join(SOURCE_ROOT, relativePath)),
      `${relativePath} 内容不一致`,
    );
  }
});

test("镜像检查拒绝根目录或树内 symbolic link", (t) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-mirror-symlink-"));
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }));
  const targetDirectory = path.join(fixtureRoot, "target");
  fs.mkdirSync(targetDirectory);
  fs.writeFileSync(path.join(targetDirectory, "SKILL.md"), "fixture\n");
  const symlinkType = process.platform === "win32" ? "junction" : "dir";

  const rootLink = path.join(fixtureRoot, "root-link");
  fs.symlinkSync(targetDirectory, rootLink, symlinkType);
  assert.throws(() => listFiles(rootLink, "", "mirror"), /mirror 不得是 symbolic link/);

  const mirrorDirectory = path.join(fixtureRoot, "mirror");
  fs.mkdirSync(mirrorDirectory);
  fs.symlinkSync(targetDirectory, path.join(mirrorDirectory, "linked-skill"), symlinkType);
  assert.throws(
    () => listFiles(mirrorDirectory, "", "mirror"),
    /mirror\/linked-skill 不得是 symbolic link/,
  );
});
