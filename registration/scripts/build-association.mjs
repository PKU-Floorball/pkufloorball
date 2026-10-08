import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { parse } from 'yaml';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(app, '..');
const source = path.join(app, 'association-source');
// Explicit allowlist keeps application sources and credentials out of public files.
if (existsSync(path.join(repo, '_layouts/default.html'))) {
  await rm(source, { recursive: true, force: true });
  await mkdir(source, { recursive: true });
  for (const entry of ['index.html', 'htmls', 'assets', '_layouts', '_includes']) {
    await cp(path.join(repo, entry), path.join(source, entry), { recursive: true });
  }
}
if (!existsSync(path.join(source, '_layouts/default.html'))) throw new Error('Association sources missing: run npm run prepare:association from the full repository before deployment.');
const output = path.join(app, 'public');
await mkdir(output, { recursive: true });
for (const entry of ['index.html', 'htmls', 'assets']) await rm(path.join(output, entry), { recursive: true, force: true });
await cp(path.join(source, 'assets'), path.join(output, 'assets'), { recursive: true });
const engine = new Liquid({ root: path.join(source, '_includes'), jekyllInclude: true, strictFilters: true });
engine.registerFilter('relative_url', value => '/' + String(value).replace(/^\/+/, ''));
async function render(file) {
  const raw = await readFile(path.join(source, file), 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const page = match ? parse(match[1]) : {};
  let content = await engine.parseAndRender(match ? raw.slice(match[0].length) : raw, { page });
  if (page.layout) {
    if (!/^[\w-]+$/.test(page.layout)) throw new Error('Invalid layout');
    const layout = await readFile(path.join(source, '_layouts', page.layout + '.html'), 'utf8');
    content = await engine.parseAndRender(layout, { page, content });
  }
  if (/\{%|\{\{/.test(content)) throw new Error(`Unrendered Liquid in ${file}`);
  await mkdir(path.dirname(path.join(output, file)), { recursive: true });
  await writeFile(path.join(output, file), content);
}
async function visit(dir) {
  for (const entry of await readdir(path.join(source, dir))) {
    const file = path.join(dir, entry);
    if ((await stat(path.join(source, file))).isDirectory()) await visit(file);
    else if (file.endsWith('.html')) await render(file);
    else await cp(path.join(source, file), path.join(output, file));
  }
}
await render('index.html');
await visit('htmls');
console.log('Association homepage, pages and assets built.');
