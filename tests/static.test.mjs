import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const page of ["index.html", "block.html"]) {
  test(`${page} has unique IDs and resolvable local assets`, async () => {
    const html = await readFile(resolve(root, page), "utf8");
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `duplicate ID in ${page}`);
    assert.equal((html.match(/<\/body>/g) || []).length, 1);
    assert.equal((html.match(/<\/html>/g) || []).length, 1);
    const localAssets = [...html.matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)].map((match) => match[1]);
    await Promise.all(localAssets.map((asset) => access(resolve(root, asset))));
  });
}

test("Blockly is loaded once and does not use JavaScript generator APIs", async () => {
  const html = await readFile(resolve(root, "block.html"), "utf8");
  const blocks = await readFile(resolve(root, "blockly_blocks.js"), "utf8");
  const controller = await readFile(resolve(root, "blockly_script.js"), "utf8");
  assert.equal((html.match(/blockly\.min\.js/g) || []).length, 1);
  assert.doesNotMatch(`${blocks}\n${controller}`, /Blockly\.JavaScript|javascriptGenerator|workspaceToCode/);
});

test("API key uses sessionStorage and never localStorage", async () => {
  const app = await readFile(resolve(root, "app.js"), "utf8");
  assert.match(app, /sessionStorage/);
  assert.doesNotMatch(app, /localStorage/);
  assert.doesNotMatch(app, /console\.log/);
});


test("released v2 pages do not present themselves as a release candidate", async () => {
  const sources = await Promise.all(
    ["README.md", "index.html", "block.html"].map((file) => readFile(resolve(root, file), "utf8")),
  );
  assert.doesNotMatch(sources.join("\n"), /release candidate|v2 rc/i);
});

test("README example stays aligned with the shared product example", async () => {
  const [readme, exampleModule] = await Promise.all([
    readFile(resolve(root, "README.md"), "utf8"),
    readFile(resolve(root, "examples.js"), "utf8"),
  ]);
  const source = exampleModule.split("\x60")[1];
  assert.ok(source, "shared example source not found");
  for (const command of source.split("\n")) {
    assert.ok(readme.includes(command), `README is missing shared example command: ${command}`);
  }
});
