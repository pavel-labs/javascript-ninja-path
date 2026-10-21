import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('..', import.meta.url));
export const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const normalizeBase = (value = '') => value === '/' || value === '' ? '/' : `/${value.replace(/^\/+|\/+$/g, '')}/`;

export function textContent(value) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

export async function loadContent() {
  const catalog = JSON.parse(await readFile(path.join(root, 'content/catalog.json'), 'utf8'));
  const sections = await Promise.all(catalog.sections.map(async (slug) => {
    const section = JSON.parse(await readFile(path.join(root, 'content', `${slug}.json`), 'utf8'));
    if (section.slug !== slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error(`Invalid section: ${slug}`);
    return section;
  }));
  const seen = new Set();
  for (const section of sections) {
    if (!section.title || !section.shortTitle || !section.topics.length) throw new Error(`Empty section: ${section.slug}`);
    for (const topic of section.topics) {
      if (!/^[a-zA-Z0-9-]+$/.test(topic.id) || seen.has(topic.id)) throw new Error(`Invalid or duplicate ID: ${topic.id}`);
      if (!topic.title || !topic.html) throw new Error(`Empty topic: ${topic.id}`);
      const tags = topic.html.match(/<[^>]*>/g) || [];
      if (tags.some((tag) => /<\/?(?:script|iframe|style)\b|\son\w+\s*=/i.test(tag))) throw new Error(`Unexpected executable HTML: ${topic.id}`);
      seen.add(topic.id);
    }
  }
  return { catalog, sections };
}

const icons = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>',
};
const priorityNames = { key: 'Key topic', basic: 'Fundamentals', med: 'In depth', hard: 'Advanced', scen: 'Scenario' };
const repository = 'https://github.com/pavel-labs/javascript-ninja-path';
const brand = 'JavaScript Ninja Path';

export async function buildSite({ outDir = path.join(root, 'dist'), basePath = process.env.BASE_PATH || '', origin = process.env.SITE_URL || 'https://pavel-labs.github.io' } = {}) {
  const base = normalizeBase(basePath);
  const { sections, catalog } = await loadContent();
  const topics = sections.flatMap((section, sectionIndex) => section.topics.map((topic, topicIndex) => ({ ...topic, section, sectionIndex, topicIndex })));
  const topicUrl = (topic) => `${base}learn/${topic.section.slug}/${topic.id}/`;
  const sectionUrl = (section) => `${base}chapters/${section.slug}/`;
  const totalFollowups = topics.reduce((n, t) => n + (t.html.match(/class="fu-item"/g) || []).length, 0);
  const totalCode = topics.reduce((n, t) => n + (t.html.match(/<pre\b/g) || []).length, 0);
  const prefixNumber = (n) => String(n + 1).padStart(2, '0');
  const topicById = new Map(topics.map((t) => [t.id, t]));

  function navigation(currentSection, currentTopic, mobile = false) {
    let group = '';
    return `<nav aria-label="${mobile ? 'Mobile chapters' : 'Chapters'}">${sections.map((section, i) => {
      const heading = group !== section.group ? `<p class="nav-group">${escape(section.group)}</p>` : '';
      group = section.group;
      const current = section === currentSection;
      return `${heading}<a class="chapter-link${current ? ' current' : ''}" href="${sectionUrl(section)}" ${current && !currentTopic ? 'aria-current="page"' : ''}><span class="chapter-number">${prefixNumber(i)}</span><span>${escape(section.shortTitle)}</span><span class="nav-count">${section.topics.length}</span></a>${current && currentTopic ? `<div class="topic-nav">${section.topics.map((t) => `<a href="${topicUrl(topicById.get(t.id))}" ${t.id === currentTopic.id ? 'aria-current="page"' : ''} data-topic-link="${t.id}">${escape(t.title)}</a>`).join('')}</div>` : ''}`;
    }).join('')}</nav>`;
  }

  function layout({ title, description, route = '', content, section, topic }) {
    const fullTitle = title ? `${title} · ${brand}` : brand;
    const canonical = `${origin.replace(/\/$/, '')}${base}${route}`;
    return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(fullTitle)}</title><meta name="description" content="${escape(description)}"><meta name="author" content="Pavel Piatrovich">
<meta name="color-scheme" content="light dark"><meta name="theme-color" content="#174f43">
<link rel="canonical" href="${escape(canonical)}"><meta property="og:type" content="${topic ? 'article' : 'website'}"><meta property="og:title" content="${escape(fullTitle)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${escape(canonical)}">
<link rel="icon" href="${base}assets/favicon.svg" type="image/svg+xml">
<script src="${base}assets/theme.js"></script><link rel="stylesheet" href="${base}assets/site.css">
<script type="module" src="${base}assets/app.js"></script>
</head>
<body data-base="${base}"${topic ? ` data-topic="${topic.id}"` : ''} data-total="${topics.length}">
<a class="skip-link" href="#main">Skip to content</a>
<aside class="sidebar">
  <a class="brand" href="${base}" aria-label="JavaScript Ninja Path home"><img src="${base}assets/favicon.svg" width="37" height="37" alt=""><span>JavaScript<br><strong>Ninja Path<span class="brand-dot">.</span></strong></span></a>
  <p class="sidebar-caption">A personal field guide</p>
  <div class="sidebar-scroll">${navigation(section, topic)}</div>
  <div class="sidebar-bottom"><span class="author-avatar" aria-hidden="true">PP</span><div><strong>Pavel Piatrovich</strong><span>Notes from my own path</span></div></div>
</aside>
<div class="workspace">
<header class="topbar">
  <a class="topbar-home" href="${base}">JavaScript Ninja Path<span>.</span></a><span class="topbar-label">THE JAVASCRIPT ECOSYSTEM</span>
  <div class="topbar-actions"><a href="${base}#chapters" class="search-trigger" data-search>${icons.search}<span>Search the notes</span><kbd>/</kbd></a><button class="icon-button" data-theme-toggle data-js aria-label="Switch colour theme">${icons.sun}</button><a class="repository-link" href="${repository}">GitHub <span aria-hidden="true">↗</span></a></div>
</header>
<details class="mobile-navigation"><summary>Browse chapters <span aria-hidden="true">⌄</span></summary>${navigation(section, topic, true)}</details>
<main id="main" class="main" tabindex="-1">${content}</main>
<footer class="footer"><span>Handpicked notes. A personal perspective.</span><a href="${repository}">View the source <span aria-hidden="true">↗</span></a></footer>
</div>
<dialog class="search-dialog" aria-labelledby="search-title"><div class="search-dialog-header"><h2 id="search-title">Find a topic</h2><button class="dialog-close" aria-label="Close search">Esc</button></div><div class="search-field">${icons.search}<input type="search" aria-label="Search questions and answers" placeholder="Try closures, Fiber, or accessibility…" autocomplete="off"></div><p class="search-status" role="status" aria-live="polite">Search across ${topics.length} topics and their answers.</p><div class="search-results"></div></dialog>
</body></html>`;
  }

  function topicCards(list) {
    return `<ol class="topic-list">${list.map((topic) => `<li data-topic-card="${topic.id}"><a href="${topicUrl(topic)}"><span class="topic-order">${prefixNumber(topic.topicIndex)}</span><div><span class="topic-title">${escape(topic.title)}</span><span class="topic-excerpt">${escape(textContent(topic.html).replace(/^💬 Say it like this\s*/, '').slice(0, 155))}…</span></div><span class="priority priority-${topic.priority}">${priorityNames[topic.priority]}</span><span class="topic-arrow" aria-hidden="true">↗</span></a></li>`).join('')}</ol>`;
  }

  const home = layout({
    description: 'My personal, handpicked study notes for JavaScript, TypeScript, React, React Native, and frontend engineering. Questions, answers, and code examples.',
    content: `<section class="hero"><p class="eyebrow"><span class="eyebrow-line"></span>PERSONAL STUDY NOTES · BY PAVEL PIATROVICH</p><h1>A ninja’s path through<br>the <em>JavaScript</em> ecosystem.</h1><p class="hero-description">A collection I’ve assembled by hand: questions, answers, and working examples. The topics and priorities reflect my own understanding of what matters.</p><div class="hero-actions"><a class="primary-button" href="${topicUrl(topics[0])}">Start reading ${icons.arrow}</a><a class="text-link" href="#chapters">Explore the chapters <span aria-hidden="true">↓</span></a></div><div class="hero-stats"><div><strong>${topics.length}</strong><span>study topics</span></div><div><strong>${totalFollowups}</strong><span>follow-up questions</span></div><div><strong>${totalCode}</strong><span>code examples</span></div><div><strong>${sections.length}</strong><span>chapters</span></div></div><div class="hero-index" aria-hidden="true"><span>JS</span><span>TS</span><span>React</span><span>Native</span></div></section>
<section id="chapters" class="chapters-section"><div class="section-heading"><div><p class="eyebrow">THE MATERIAL</p><h2>Choose your next chapter.</h2></div><div class="reading-progress" data-js><span><strong data-read-count>0</strong> / ${topics.length} read</span><progress data-progress max="${topics.length}" value="0" aria-label="Reading progress"></progress></div></div><div class="chapter-grid">${sections.map((section, i) => `<a class="chapter-card" href="${sectionUrl(section)}"><div class="chapter-card-top"><span class="chapter-number">CHAPTER ${prefixNumber(i)}</span><span class="chapter-card-arrow" aria-hidden="true">↗</span></div><h3>${escape(section.shortTitle)}</h3><p>${escape(section.topics.slice(0, 3).map((t) => t.title.replace(/\?$/, '')).join(' · '))}</p><div class="chapter-card-footer"><span>${section.topics.length} ${section.topics.length === 1 ? 'topic' : 'topics'}</span><span data-section-progress="${section.slug}" data-ids="${section.topics.map((t) => t.id).join(',')}" data-js></span></div></a>`).join('')}</div></section>
<aside class="author-note"><span class="note-marker" aria-hidden="true">※</span><div><h2>A note about these notes</h2><p>This is my personal material, collected and organised from my point of view. It reflects my priorities and understanding, and it will evolve as I learn. It isn’t an official curriculum or a definitive reference.</p><span>Pavel Piatrovich</span></div></aside>`,
  });

  const pages = new Map([['index.html', home]]);
  for (const [index, section] of sections.entries()) {
    const list = topics.filter((t) => t.section === section);
    pages.set(`chapters/${section.slug}/index.html`, layout({
      title: section.shortTitle, description: section.title, route: `chapters/${section.slug}/`, section,
      content: `<div class="breadcrumb"><a href="${base}">All chapters</a><span aria-hidden="true">/</span><span>Chapter ${prefixNumber(index)}</span></div><section class="chapter-intro"><p class="eyebrow">CHAPTER ${prefixNumber(index)} · ${section.topics.length} TOPICS</p><h1>${escape(section.shortTitle)}</h1><p>${escape(section.title)}</p><a class="text-link" href="${topicUrl(list[0])}">Read this chapter ${icons.arrow}</a></section>${topicCards(list)}`,
    }));
  }

  for (const [index, topic] of topics.entries()) {
    const previous = topics[index - 1];
    const next = topics[index + 1];
    let body = topic.html.replaceAll('$ASSET/', `${base}assets/`);
    // Keep original card anchors usable when answers link to another topic.
    body = body.replace(/href="#([^"]+)"/g, (match, id) => topicById.has(id) ? `href="${topicUrl(topicById.get(id))}"` : match);
    body = body.replace(/<div class="tl">💬 Say it like this<\/div>/g, '<div class="tl">In plain words</div>');
    body = body.replace(/<div class="fu">/g, '<div class="fu"><h2>Follow-up questions</h2>');
    let codeIndex = 0;
    body = body.replace(/<pre([^>]*)>([\s\S]*?)<\/pre>/g, (_, attrs, code) => `<div class="code-block"><div class="code-header"><span>CODE EXAMPLE</span><button type="button" data-copy="code-${++codeIndex}" data-js>Copy code</button></div><pre${attrs} id="code-${codeIndex}" tabindex="0">${code}</pre></div>`);
    body = body.replace(/<table>/g, '<div class="table-scroll" tabindex="0" role="region" aria-label="Comparison table"><table>').replace(/<\/table>/g, '</table></div>');
    body = body.replace(/<div class="arch">/g, '<div class="arch" tabindex="0">');
    const minutes = Math.max(1, Math.ceil(textContent(topic.html).split(' ').length / 220));
    pages.set(`learn/${topic.section.slug}/${topic.id}/index.html`, layout({
      title: topic.title, description: textContent(topic.html).slice(0, 165), route: `learn/${topic.section.slug}/${topic.id}/`, section: topic.section, topic,
      content: `<article class="reader"><div class="breadcrumb"><a href="${base}">Chapters</a><span aria-hidden="true">/</span><a href="${sectionUrl(topic.section)}">${escape(topic.section.shortTitle)}</a></div><header class="article-header"><div class="article-meta"><span class="priority priority-${topic.priority}">${priorityNames[topic.priority]}</span><span>${minutes} min read</span><span>${topic.topicIndex + 1} / ${topic.section.topics.length}</span></div><h1>${escape(topic.title)}</h1></header><div class="article-body" id="${topic.id}">${body}</div><div class="reading-actions" data-js><p>One step further along the path.</p><button class="read-button" data-mark-read aria-pressed="false"><span aria-hidden="true">✓</span> <span data-read-label>Mark as read</span></button><span class="storage-note">Saved in this browser</span></div><nav class="article-pagination" aria-label="Previous and next topics">${previous ? `<a href="${topicUrl(previous)}"><span>← PREVIOUS TOPIC</span><strong>${escape(previous.title)}</strong><small>${escape(previous.section.shortTitle)}</small></a>` : '<div></div>'}${next ? `<a href="${topicUrl(next)}" class="pagination-next"><span>NEXT TOPIC →</span><strong>${escape(next.title)}</strong><small>${escape(next.section.shortTitle)}</small></a>` : `<a href="${base}"><span>BACK TO THE CHAPTERS →</span><strong>Keep exploring</strong></a>`}</nav></article>`,
    }));
  }
  pages.set('404.html', layout({ title: 'Page not found', description: 'This page could not be found.', route: '404.html', content: `<section class="not-found"><p class="eyebrow">404 · A SMALL DETOUR</p><h1>This page left the path.</h1><p>The topic may have moved, or the address may be incomplete.</p><a class="primary-button" href="${base}">Back to the chapters ${icons.arrow}</a></section>` }));

  await mkdir(outDir, { recursive: true });
  await rm(path.join(outDir, 'learn'), { recursive: true, force: true });
  await rm(path.join(outDir, 'chapters'), { recursive: true, force: true });
  await cp(path.join(root, 'assets'), path.join(outDir, 'assets'), { recursive: true });
  for (const [route, html] of pages) {
    const destination = path.join(outDir, route);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, html);
  }
  const searchIndex = topics.map((t) => ({ id: t.id, title: t.title, section: t.section.shortTitle, url: topicUrl(t), text: textContent(t.html) }));
  await writeFile(path.join(outDir, 'search-index.json'), JSON.stringify(searchIndex));
  await writeFile(path.join(outDir, '.nojekyll'), '');
  const urls = [...pages.keys()].filter((p) => p !== '404.html').map((p) => `${origin.replace(/\/$/, '')}${base}${p.replace(/index\.html$/, '')}`);
  await writeFile(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escape(url)}</loc></url>`).join('')}</urlset>`);
  await writeFile(path.join(outDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${origin.replace(/\/$/, '')}${base}sitemap.xml\n`);
  return { pages: pages.size, topics: topics.length, followups: totalFollowups, codeExamples: totalCode, sections: sections.length, base, outDir, imported: catalog.imported };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await buildSite(), null, 2));
}
