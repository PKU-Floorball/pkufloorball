import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
test('builds original homepage and deep pages with root assets and competition navigation', () => {
  execFileSync(process.execPath, ['scripts/build-association.mjs']);
  const home = readFileSync('public/index.html', 'utf8');
  expect(home).toContain('北京大学软式曲棍球协会');
  expect(home).toMatch(/href="\/registration"[^>]*>公开赛/);
  expect(home).not.toMatch(/\{%|\{\{|^---/);
  expect(home).toContain('/assets/css/style.css');
  const deep = readFileSync('public/htmls/3-association/2-rk-cup/24-rk-cup/main.html','utf8');
  expect(deep).toContain('/assets/css/cup-style.css');
  expect(deep).not.toMatch(/\{%|\{\{/);
  expect(existsSync('public/assets/images/bg1.png')).toBe(true);
  expect(existsSync('public/.env.local')).toBe(false);
});

test('homepage has no blocking third-party resources and serves lightweight images', () => {
  const home = readFileSync('public/index.html', 'utf8');
  expect(home).not.toMatch(/<(?:link|script)[^>]+(?:href|src)=["']https:\/\/(?:cdn\.jsdelivr\.net|fonts\.googleapis\.com|code\.iconify\.design)/);
  expect(home).not.toContain('<iconify-icon');
  expect(home).toMatch(/assets\/images\/optimized\/bg1-[a-f0-9]+\.webp/);
  expect(home).toContain('loading="lazy"');
  expect(home).toMatch(/<script[^>]+defer/);
});
