import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSite, loadContent } from '../scripts/build.mjs';

async function filesIn(dir, prefix = '') {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await filesIn(path.join(dir, entry.name), relative));
    else result.push(relative);
  }
  return result;
}

test('the complete imported collection is present', async () => {
  const { sections, catalog } = await loadContent();
  const topics = sections.flatMap((s) => s.topics);
  assert.ok(sections.length >= 20);
  assert.ok(topics.length >= catalog.imported.topics);
  assert.equal(new Set(topics.map((t) => t.id)).size, topics.length);
  assert.ok(topics.reduce((n, t) => n + (t.html.match(/class="fu-item"/g) || []).length, 0) >= catalog.imported.followups);
  assert.ok(topics.reduce((n, t) => n + (t.html.match(/<pre\b/g) || []).length, 0) >= catalog.imported.codeExamples);
  for (const topic of topics) {
    assert.doesNotMatch(topic.html, /class="(?:ql|nq)\b|<script\b|<style\b|<nav\b/);
  }
  assert.equal(topics.find((t) => t.id === 's6-c2').title, 'Playwright & Page Object Model');
});

for (const basePath of ['', '/javascript-ninja-path']) {
  test(`every generated local link, image, and anchor resolves at ${basePath || '/'}`, async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'ninja-site-'));
    try {
      const result = await buildSite({ outDir, basePath });
      const filenames = await filesIn(outDir);
      const existing = new Set(filenames);
      const htmlPages = filenames.filter((f) => f.endsWith('.html'));
      assert.equal(htmlPages.length, result.topics + result.sections + 2);
      for (const filename of htmlPages) {
        const html = await readFile(path.join(outDir, filename), 'utf8');
        assert.match(html, /<html lang="en"/);
        assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, filename);
        const tags = (html.match(/<[a-zA-Z][^>]*>/g) || []).join('\n');
        const ids = [...tags.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
        assert.equal(ids.length, new Set(ids).size, `Duplicate DOM IDs in ${filename}`);
        for (const [, attribute, reference] of tags.matchAll(/\b(href|src)="([^"]+)"/g)) {
          if (/^(?:https?:|mailto:|data:)/.test(reference)) continue;
          const url = new URL(reference, `https://example.test${result.base}${filename.replace(/index\.html$/, '')}`);
          assert.ok(url.pathname.startsWith(result.base), `Missing project prefix: ${reference} in ${filename}`);
          const relative = decodeURIComponent(url.pathname.slice(result.base.length));
          const target = !relative || relative.endsWith('/') ? `${relative}index.html` : relative;
          assert.ok(existing.has(target), `Missing ${attribute}: ${reference} in ${filename}`);
          if (url.hash && target.endsWith('.html')) {
            const destination = target === filename ? html : await readFile(path.join(outDir, target), 'utf8');
            assert.ok(destination.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Missing anchor ${reference} in ${filename}`);
          }
        }
        assert.doesNotMatch(html, /\$ASSET\//);
      }
      const index = JSON.parse(await readFile(path.join(outDir, 'search-index.json'), 'utf8'));
      assert.equal(index.length, result.topics);
      assert.ok(index.every((entry) => entry.text && entry.title && entry.url.startsWith(result.base)));
      assert.ok(index.some((entry) => entry.id === 's3-3' && /closure/i.test(entry.text)));
      assert.match(await readFile(path.join(outDir, 'sitemap.xml'), 'utf8'), /<urlset/);
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
}
