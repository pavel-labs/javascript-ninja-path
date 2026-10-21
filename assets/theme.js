document.documentElement.classList.replace('no-js', 'js');
try {
  const saved = localStorage.getItem('js-ninja-path:theme');
  if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
} catch { /* Reading works when browser storage is unavailable. */ }
