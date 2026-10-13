import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Liquid } from 'liquidjs';
import { parse } from 'yaml';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
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
  if (file === 'index.html') {
    const visible = content.replace(/<!--[\s\S]*?-->/g, '');
    const references = [...new Set(visible.match(/\/?assets\/images\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g)/g) || [])];
    let originalBytes = 0, optimizedBytes = 0;
    const optimized = new Map();
    for (const url of references) {
      const input = path.join(source, url.replace(/^\//, ''));
      if (optimized.has(input)) {
        content = content.replaceAll(url, (url.startsWith('/') ? '/' : '') + optimized.get(input));
        continue;
      }
      if (!existsSync(input)) continue;
      const bytes = await readFile(input);
      if (bytes.length < 120000) continue;
      const resized = await sharp(bytes).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer();
      if (resized.length >= bytes.length) continue;
      const hash = createHash('sha256').update(bytes).update('1600-q78-v1').digest('hex').slice(0, 12);
      const name = `${path.parse(input).name}-${hash}.webp`;
      const asset = path.join('assets/images/optimized', name);
      await mkdir(path.join(output, 'assets/images/optimized'), { recursive: true });
      await writeFile(path.join(output, asset), resized);
      optimized.set(input, asset);
      content = content.replaceAll(url, (url.startsWith('/') ? '/' : '') + asset);
      originalBytes += bytes.length; optimizedBytes += resized.length;
    }
    // The hero is a CSS background; inline images are all below the first screen.
    for (const match of [...content.matchAll(/<img\b([^>]*)>/g)]) {
      let attrs = match[1];
      const src = attrs.match(/\bsrc="([^"]+)"/)?.[1];
      if (src && !/\b(?:width|height)=/.test(attrs)) {
        const image = path.join(output, src.replace(/^\//, ''));
        if (existsSync(image)) {
          const { width, height } = await sharp(image).metadata();
          if (width && height) attrs += ` width="${width}" height="${height}"`;
        }
      }
      if (!/\bloading=/.test(attrs)) attrs += ' loading="lazy"';
      if (!/\bdecoding=/.test(attrs)) attrs += ' decoding="async"';
      content = content.replace(match[0], `<img${attrs}>`);
    }
    console.log(`Homepage images: ${originalBytes} -> ${optimizedBytes} bytes`);
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
