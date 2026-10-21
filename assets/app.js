const body = document.body;
const storageKey = 'js-ninja-path:read:v1';
let readTopics = new Set();
let persistent = true;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved)) readTopics = new Set(saved.filter((id) => typeof id === 'string'));
} catch { persistent = false; }

function syncProgress() {
  const total = Number(body.dataset.total);
  const count = Math.min(readTopics.size, total);
  document.querySelectorAll('[data-read-count]').forEach((el) => { el.textContent = String(count); });
  document.querySelectorAll('[data-progress]').forEach((el) => { el.value = count; });
  document.querySelectorAll('[data-section-progress]').forEach((el) => {
    const ids = el.dataset.ids.split(',');
    const completed = ids.filter((id) => readTopics.has(id)).length;
    el.textContent = completed ? `${completed} / ${ids.length} read` : '';
  });
  document.querySelectorAll('[data-topic-card], [data-topic-link]').forEach((el) => {
    el.classList.toggle('is-read', readTopics.has(el.dataset.topicCard || el.dataset.topicLink));
  });
  const readButton = document.querySelector('[data-mark-read]');
  if (readButton) {
    const isRead = readTopics.has(body.dataset.topic);
    readButton.setAttribute('aria-pressed', String(isRead));
    readButton.querySelector('[data-read-label]').textContent = isRead ? 'Read · undo' : 'Mark as read';
    document.querySelector('.storage-note').textContent = persistent ? 'Saved in this browser' : 'Saved for this visit';
  }
}
document.querySelector('[data-mark-read]')?.addEventListener('click', () => {
  const id = body.dataset.topic;
  if (readTopics.has(id)) readTopics.delete(id); else readTopics.add(id);
  try { localStorage.setItem(storageKey, JSON.stringify([...readTopics])); } catch { persistent = false; }
  syncProgress();
});
window.addEventListener('storage', (event) => {
  if (event.key !== storageKey && event.key !== null) return;
  try {
    const saved = JSON.parse(event.newValue || '[]');
    readTopics = new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []);
    syncProgress();
  } catch { /* Leave the current progress intact when another tab writes invalid data. */ }
});
syncProgress();

const themeButton = document.querySelector('[data-theme-toggle]');
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
function isDark() { return document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : systemDark.matches; }
function syncTheme() { themeButton.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme'); }
themeButton.addEventListener('click', () => {
  const theme = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('js-ninja-path:theme', theme); } catch { /* Theme still works for this page. */ }
  syncTheme();
});
systemDark.addEventListener('change', syncTheme);
syncTheme();

const keyword = 'const|let|var|function|return|if|else|for|while|do|new|await|async|class|export|import|from|default|type|interface|extends|implements|typeof|instanceof|null|undefined|true|false|this|try|catch|finally|throw|switch|case|break|continue|yield|as|of|in|void|readonly|public|private|enum|satisfies';
const tokenPattern = new RegExp('(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)|(`(?:\\\\.|[^`\\\\])*`|"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')|\\b(' + keyword + ')\\b|\\b(\\d+(?:\\.\\d+)?)\\b|\\b([A-Za-z_$][\\w$]*)(?=\\()', 'g');
const tokenTypes = ['comment', 'string', 'keyword', 'number', 'function'];
document.querySelectorAll('pre').forEach((pre) => {
  const source = pre.textContent;
  const code = document.createElement('code');
  let last = 0;
  for (const match of source.matchAll(tokenPattern)) {
    code.append(document.createTextNode(source.slice(last, match.index)));
    const span = document.createElement('span');
    span.className = `token-${tokenTypes[match.slice(1).findIndex((part) => part !== undefined)]}`;
    span.textContent = match[0];
    code.append(span);
    last = match.index + match[0].length;
  }
  code.append(document.createTextNode(source.slice(last)));
  pre.replaceChildren(code);
});
document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const pre = document.getElementById(button.dataset.copy);
    try {
      await navigator.clipboard.writeText(pre.textContent);
      button.textContent = 'Copied';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      button.textContent = 'Selected · Ctrl/Cmd+C';
    }
    setTimeout(() => { button.textContent = 'Copy code'; }, 2400);
  });
});

const dialog = document.querySelector('.search-dialog');
const input = dialog.querySelector('input');
const results = dialog.querySelector('.search-results');
const status = dialog.querySelector('.search-status');
let indexPromise;
let index;
const fold = (text) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function renderResults() {
  if (!index) return;
  const query = fold(input.value.trim());
  const words = query.split(/\s+/).filter(Boolean);
  const matches = index.map((topic) => {
    const title = fold(topic.title);
    const haystack = `${title} ${fold(topic.section)} ${fold(topic.text)}`;
    if (!words.every((word) => haystack.includes(word))) return null;
    return { ...topic, score: (title.includes(query) ? 10 : 0) + words.reduce((n, word) => n + (title.includes(word) ? 4 : 0), 0) };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  results.replaceChildren();
  for (const topic of matches.slice(0, query ? 30 : 8)) {
    const link = document.createElement('a');
    link.className = 'search-result';
    link.href = topic.url;
    const section = document.createElement('small');
    section.textContent = topic.section;
    const title = document.createElement('strong');
    title.textContent = topic.title;
    const excerpt = document.createElement('p');
    const text = topic.text;
    const start = query ? Math.max(0, fold(text).indexOf(words[0]) - 45) : 0;
    excerpt.textContent = `${start ? '…' : ''}${text.slice(start, start + 155)}${text.length > start + 155 ? '…' : ''}`;
    link.append(section, title, excerpt);
    results.append(link);
  }
  status.textContent = query ? (matches.length ? `${matches.length} topic${matches.length === 1 ? '' : 's'} found${matches.length > 30 ? ' · showing the first 30' : ''}` : 'No topics found. Try a different word or phrase.') : 'A few starting points. Search in questions, answers, and examples.';
}

async function openSearch() {
  if (!dialog.open) dialog.showModal();
  input.focus();
  if (!index) {
    status.textContent = 'Loading the notes…';
    try {
      indexPromise ??= fetch(`${body.dataset.base}search-index.json`).then((response) => {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.json();
      });
      index = await indexPromise;
    } catch {
      indexPromise = undefined;
      status.textContent = 'Could not load search. Close and reopen to try again, or browse the chapters.';
      return;
    }
  }
  renderResults();
}
document.querySelectorAll('[data-search]').forEach((trigger) => trigger.addEventListener('click', (event) => { event.preventDefault(); openSearch(); }));
dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  const box = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
});
input.addEventListener('input', renderResults);
dialog.addEventListener('keydown', (event) => {
  const links = [...results.querySelectorAll('a')];
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const current = links.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') links[Math.min(current + 1, links.length - 1)]?.focus();
    else if (current > 0) links[current - 1].focus(); else input.focus();
  }
  if (event.key === 'Enter' && document.activeElement === input) links[0]?.click();
});
document.addEventListener('keydown', (event) => {
  const editable = event.target instanceof HTMLElement && (event.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
  if (((event.key === '/' && !editable) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k')) && !event.altKey) {
    event.preventDefault();
    openSearch();
  }
});
