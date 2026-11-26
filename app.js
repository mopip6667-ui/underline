/* Underline — standalone web app. Library data: data/libraries.json + data/index.json (list of book files). Saved cards: this device. */
(() => {
'use strict';
const I = {
  save: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
  copy: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  book: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/></svg>'
};
const $ = s => document.querySelector(s);
const feed = $('#feed');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const okColor = c => /^#[0-9a-f]{6}$/i.test(c || '') ? c : '#13242e';
const norm = s => String(s || '').toLowerCase().replace(/^the\s+/, '').replace(/[:(].*$/, '').replace(/[^a-z0-9]/g, '');
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

let books = [], config = { libraries: [] }, saved = store.get('underline.saved', []), scope = { kind: 'all' }, shuffled = null, nav = [];

/* ---------- taxonomy ---------- */
function sortedBooks() { return books.slice().sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || (a.createdAt || 0) - (b.createdAt || 0)); }
function libs() {
  const out = (config.libraries || []).map(l => ({ id: String(l.id), name: String(l.name || l.id), blurb: String(l.blurb || ''), color: okColor(l.color),
    shelves: (l.shelves || []).map(s => ({ id: String(s.id), name: String(s.name || s.id), suggest: Array.isArray(s.suggest) ? s.suggest : [], books: [] })) }));
  let uns = null;
  for (const b of sortedBooks()) {
    let l = out.find(x => x.id === b.library), s = l && l.shelves.find(x => x.id === b.shelf);
    if (!s) {
      if (!uns) { uns = { id: 'unsorted', name: 'More books', blurb: '', color: '#2a2d34', shelves: [{ id: 'unsorted', name: 'More books', suggest: [], books: [] }] }; out.push(uns); }
      l = uns; s = uns.shelves[0];
    }
    s.books.push(b);
  }
  return out;
}
function placeOf(b, L) { for (const l of L) for (const s of l.shelves) if (s.books.includes(b)) return { l, s }; return { l: null, s: null }; }

/* ---------- cards ---------- */
function cardsOf(b) { return (Array.isArray(b.cards) ? b.cards : []).map((c, i) => c && c.text ? { ...c, id: b.id + ':' + i, book: b } : null).filter(Boolean); }
function cardMap() { const m = {}; for (const b of books) for (const c of cardsOf(b)) m[c.id] = c; return m; }
function rr(bs) { const cols = bs.map(cardsOf), out = [], n = Math.max(0, ...cols.map(c => c.length)); for (let i = 0; i < n; i++) for (const c of cols) if (c[i]) out.push(c[i]); return out; }
function scopeBooks() {
  const L = libs();
  if (scope.kind === 'library') { const l = L.find(x => x.id === scope.lib); return l ? l.shelves.flatMap(s => s.books) : []; }
  if (scope.kind === 'shelf') { const l = L.find(x => x.id === scope.lib), s = l && l.shelves.find(x => x.id === scope.shelf); return s ? s.books : []; }
  if (scope.kind === 'book') { const b = books.find(x => x.id === scope.book); return b ? [b] : []; }
  return sortedBooks();
}
function list() {
  if (scope.kind === 'saved') { const m = cardMap(); return saved.map(id => m[id]).filter(Boolean); }
  if (scope.kind === 'book') return scopeBooks().flatMap(cardsOf);
  const base = rr(scopeBooks());
  if (scope.kind === 'all' && shuffled) { const m = {}; for (const c of base) m[c.id] = c; const out = shuffled.map(id => m[id]).filter(Boolean), seen = new Set(shuffled); for (const c of base) if (!seen.has(c.id)) out.push(c); return out; }
  return base;
}
function scopeLabel() {
  const L = libs();
  if (scope.kind === 'library') { const l = L.find(x => x.id === scope.lib); return l ? l.name : ''; }
  if (scope.kind === 'shelf') { const l = L.find(x => x.id === scope.lib), s = l && l.shelves.find(x => x.id === scope.shelf); return l && s ? `${l.name} › ${s.name}` : ''; }
  if (scope.kind === 'book') { const b = books.find(x => x.id === scope.book); if (!b) return ''; const p = placeOf(b, L); return p.s ? `${p.s.name} › ${b.title}` : b.title; }
  return '';
}
function cardHTML(c, i, n, L) {
  const b = c.book, q = c.type === 'quote', on = saved.includes(c.id), p = placeOf(b, L);
  const where = p.l && p.l.id !== 'unsorted' ? `${p.l.name} · ${p.s.name}` : b.title;
  return `<article class="card${q ? ' isq' : ''}" data-id="${esc(c.id)}" style="--c:${okColor(b.color)}">
  <div class="tag"><b>${q ? 'Quote' : 'Idea'}</b><span>${esc(where)}</span></div>
  ${q ? `<blockquote class="q">“${esc(c.text)}”</blockquote>` : `<h2 class="i">${esc(c.text)}</h2>`}
  ${c.meaning ? `<p class="meaning">${esc(c.meaning)}</p>` : ''}
  ${c.apply ? `<div class="apply"><strong>Try this</strong>${esc(c.apply)}</div>` : ''}
  <div class="foot">${esc(b.title)}${b.author ? ' · ' + esc(b.author) : ''} · ${i + 1} of ${n}</div>
  <div class="rail"><button data-act="save" aria-pressed="${on}" aria-label="Save card">${I.save}</button><button data-act="copy" aria-label="Copy card">${I.copy}</button><button data-act="book" aria-label="More from this book">${I.book}</button></div>
</article>`;
}
const msg = (h, p, btn) => `<article class="card msg"><h2>${h}</h2><p>${p}</p>${btn || ''}</article>`;
function currentId() { const k = Math.round(feed.scrollTop / Math.max(1, feed.clientHeight)); return feed.children[k]?.dataset.id || null; }

let phase = 'loading';
function render(keepId) {
  const v = scope.kind === 'saved' ? 'saved' : scope.kind === 'all' ? 'all' : 'lib';
  document.querySelectorAll('.chip').forEach(ch => ch.setAttribute('aria-current', String(ch.dataset.view === v)));
  $('#savedN').textContent = saved.length ? saved.length : '';
  const lab = scopeLabel(); $('#scope').hidden = !lab; $('#scopeTxt').textContent = lab;
  if (phase === 'loading') return;
  if (phase === 'error' && !books.length) { feed.innerHTML = msg('Can’t load the library', 'Check your connection and reopen the app. Once it loads, it works offline.', '<button class="btn" data-act="retry">Try again</button>'); return; }
  const L = libs(), l = list();
  if (!l.length) {
    if (scope.kind === 'saved') feed.innerHTML = msg('Nothing saved yet', 'Double-tap any card, or tap the bookmark, to keep it here.', '<button class="btn" data-act="home">Back to the feed</button>');
    else feed.innerHTML = msg('This shelf is empty', 'New books arrive every week. Browse the library for the suggested reads.', '<button class="btn" data-act="browse">Open the library</button>');
    return;
  }
  feed.innerHTML = l.map((c, i) => cardHTML(c, i, l.length, L)).join('');
  const k = keepId ? l.findIndex(c => c.id === keepId) : -1;
  feed.scrollTop = k > 0 ? k * feed.clientHeight : 0;
}
function setScope(s) { scope = s; if (s.kind !== 'all') shuffled = null; render(); }
function syncSaveButtons() {
  feed.querySelectorAll('.card[data-id]').forEach(el => { const b = el.querySelector('[data-act=save]'); if (b) b.setAttribute('aria-pressed', String(saved.includes(el.dataset.id))); });
  $('#savedN').textContent = saved.length ? saved.length : '';
}
let tt;
function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(tt); tt = setTimeout(() => el.hidden = true, 2400); }
function toggleSave(id, onlyOn) {
  const has = saved.includes(id);
  if (onlyOn && has) return true;
  saved = has ? saved.filter(x => x !== id) : [id, ...saved];
  store.set('underline.saved', saved); syncSaveButtons();
  if (!onlyOn) toast(has ? 'Removed from Saved' : 'Saved');
  return !has;
}
function pop(card) { const d = document.createElement('div'); d.className = 'pop'; d.innerHTML = I.save; card.appendChild(d); setTimeout(() => d.remove(), 800); }
async function copyText(t, ok) {
  try { if (navigator.share && matchMedia('(pointer:coarse)').matches && ok === 'Shared') { await navigator.share({ text: t }); return; } await navigator.clipboard.writeText(t); toast(ok || 'Copied'); }
  catch (e) { if (e && e.name !== 'AbortError') toast('Couldn’t copy'); }
}

let lastTap = { id: null, t: 0 };
feed.addEventListener('click', e => {
  const btn = e.target.closest('button'), card = e.target.closest('.card');
  if (btn) {
    const a = btn.dataset.act;
    if (a === 'home') setScope({ kind: 'all' });
    if (a === 'browse') openLib();
    if (a === 'retry') load();
    if (!card || !card.dataset.id) return;
    const c = cardMap()[card.dataset.id]; if (!c) return;
    if (a === 'save') toggleSave(c.id);
    if (a === 'copy') copyText(`${c.type === 'quote' ? '“' + c.text + '”' : c.text}\n— ${c.book.title}${c.book.author ? ', ' + c.book.author : ''}\n\nWhat it means: ${c.meaning || ''}${c.apply ? '\nTry this: ' + c.apply : ''}`, 'Shared');
    if (a === 'book') setScope({ kind: 'book', book: c.book.id });
    return;
  }
  if (!card || !card.dataset.id) return;
  const now = Date.now();
  if (lastTap.id === card.dataset.id && now - lastTap.t < 320) { lastTap = { id: null, t: 0 }; toggleSave(card.dataset.id, true); pop(card); }
  else lastTap = { id: card.dataset.id, t: now };
});
document.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => { const v = ch.dataset.view; if (v === 'lib') { openLib(); return; } setScope({ kind: v }); }));
$('#scopeX').addEventListener('click', () => setScope({ kind: 'all' }));
$('#shuffleBtn').addEventListener('click', () => {
  if (scope.kind === 'all') { const ids = list().map(c => c.id); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } shuffled = ids; render(); toast('Shuffled'); }
  else { const l = list(); if (l.length) { feed.scrollTop = Math.floor(Math.random() * l.length) * feed.clientHeight; toast('Random card'); } }
});
$('#moreBtn').addEventListener('click', () => {
  const nc = books.reduce((n, b) => n + cardsOf(b).length, 0);
  $('#aboutSub').textContent = `${libs().length} libraries · ${books.length} books · ${nc} cards`;
  $('#installBox').hidden = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  $('#moreSheet').hidden = false;
});
$('#backupBtn').addEventListener('click', () => copyText('UNDERLINE1:' + btoa(unescape(encodeURIComponent(JSON.stringify(saved)))), 'Backup code copied'));
$('#restoreBtn').addEventListener('click', () => {
  const code = (prompt('Paste your backup code') || '').trim();
  if (!code) return;
  try {
    const arr = JSON.parse(decodeURIComponent(escape(atob(code.replace(/^UNDERLINE1:/, '')))));
    if (!Array.isArray(arr)) throw 0;
    saved = [...new Set([...arr.filter(x => typeof x === 'string'), ...saved])];
    store.set('underline.saved', saved); syncSaveButtons(); toast(`Restored ${arr.length} saved cards`);
  } catch { toast('That code didn’t work'); }
});
function closeSheets() { document.querySelectorAll('.scrim').forEach(s => s.hidden = true); }
document.querySelectorAll('.scrim').forEach(s => s.addEventListener('click', e => { if (e.target === s || e.target.closest('[data-close]')) closeSheets(); }));

/* ---------- library browser ---------- */
const countCards = bs => bs.reduce((n, b) => n + cardsOf(b).length, 0);
const freeLink = t => `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(t)}`;
function openLib() {
  if (scope.kind === 'shelf') nav = [scope.lib, scope.shelf];
  else if (scope.kind === 'library') nav = [scope.lib];
  else if (nav.length && !libs().find(l => l.id === nav[0])) nav = [];
  renderLib(); $('#libSheet').hidden = false;
}
function renderLib() {
  const L = libs(), P = $('#libPanel');
  const close = '<button type="button" class="x" data-close aria-label="Close">✕</button>';
  const l = nav[0] && L.find(x => x.id === nav[0]), s = l && nav[1] && l.shelves.find(x => x.id === nav[1]);
  if (!l) {
    P.innerHTML = `<div class="hd"><div><h3>Library</h3><p class="sub">${L.length} libraries · ${books.length} books · ${countCards(books)} cards</p></div>${close}</div>
    <div class="tiles">${L.map(x => { const bs = x.shelves.flatMap(y => y.books); return `<button class="tile" data-lib="${esc(x.id)}" style="--c:${x.color}"><b>${esc(x.name)}</b><span>${x.shelves.length} shelves · ${countCards(bs)} cards</span></button>`; }).join('')}</div>`;
    return;
  }
  if (!s) {
    const n = countCards(l.shelves.flatMap(y => y.books));
    P.innerHTML = `<button class="back" data-back>‹ Library</button><div class="hd"><div><h3>${esc(l.name)}</h3><p class="sub">${esc(l.blurb)}</p></div>${close}</div>
    ${n ? `<button class="btn swipe" data-swipe="library">Swipe all of ${esc(l.name)} · ${n} cards</button>` : ''}
    <h4>Shelves</h4><ul class="rows">${l.shelves.map(y => { const c = countCards(y.books); return `<li><button class="open" data-shelf="${esc(y.id)}"><span class="dot" style="background:${l.color};opacity:${c ? 1 : .35}"></span><span><b>${esc(y.name)}</b><small>${y.books.length ? `${y.books.length} book${y.books.length > 1 ? 's' : ''} · ${c} cards` : 'Coming soon'}</small></span><span class="chev">›</span></button></li>`; }).join('')}</ul>`;
    return;
  }
  const have = new Set(s.books.map(b => norm(b.title)));
  const sug = s.suggest.filter(x => x && x.t && !have.has(norm(x.t)));
  P.innerHTML = `<button class="back" data-back>‹ ${esc(l.name)}</button><div class="hd"><div><h3>${esc(s.name)}</h3><p class="sub">${s.books.length} on the shelf · ${countCards(s.books)} cards</p></div>${close}</div>
  ${s.books.length ? `<button class="btn swipe" data-swipe="shelf">Swipe this shelf</button><h4>On this shelf</h4><ul class="rows">${s.books.map(b => `<li><button class="open" data-book="${esc(b.id)}"><span class="dot" style="background:${okColor(b.color)}"></span><span><b>${esc(b.title)}</b><small>${esc(b.author || '')}${b.author ? ' · ' : ''}${cardsOf(b).length} cards</small></span><span class="chev">›</span></button></li>`).join('')}</ul>` : ''}
  ${sug.length ? `<h4>Coming up on this shelf</h4><ul class="rows">${sug.map(x => `<li><span class="open" style="cursor:default"><span><b>${esc(x.t)}${x.free ? '<span class="pd">Free</span>' : ''}</b><small>${esc(x.a || '')}${x.free ? ` · <a class="free" href="${freeLink(x.t)}" target="_blank" rel="noopener">Read it free</a>` : ''}</small></span></span></li>`).join('')}</ul>` : ''}`;
}
$('#libPanel').addEventListener('click', e => {
  const t = e.target;
  const tile = t.closest('[data-lib]'); if (tile) { nav = [tile.dataset.lib]; renderLib(); $('#libPanel').scrollTop = 0; return; }
  const sh = t.closest('[data-shelf]'); if (sh) { nav = [nav[0], sh.dataset.shelf]; renderLib(); $('#libPanel').scrollTop = 0; return; }
  if (t.closest('[data-back]')) { nav = nav.slice(0, -1); renderLib(); return; }
  const sw = t.closest('[data-swipe]'); if (sw) { closeSheets(); setScope(sw.dataset.swipe === 'library' ? { kind: 'library', lib: nav[0] } : { kind: 'shelf', lib: nav[0], shelf: nav[1] }); return; }
  const bk = t.closest('[data-book]'); if (bk) { closeSheets(); setScope({ kind: 'book', book: bk.dataset.book }); }
});

document.addEventListener('keydown', e => {
  const sheetOpen = !!document.querySelector('.scrim:not([hidden])');
  if (e.key === 'Escape') { closeSheets(); return; }
  if (sheetOpen) return;
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); feed.scrollBy({ top: feed.clientHeight }); }
  else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); feed.scrollBy({ top: -feed.clientHeight }); }
  else if (e.key === 's') { const id = currentId(); if (id) toggleSave(id); }
});
const feedRO = new ResizeObserver(() => { const id = currentId(); if (id) { const k = [...feed.children].findIndex(c => c.dataset.id === id); if (k >= 0) feed.scrollTop = k * feed.clientHeight; } });
feedRO.observe(feed);
let posT; feed.addEventListener('scroll', () => { clearTimeout(posT); posT = setTimeout(() => { if (scope.kind === 'all') store.set('underline.pos', currentId()); }, 300); }, { passive: true });

/* ---------- load ---------- */
async function getJSON(p) { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }
async function load() {
  phase = 'loading';
  try {
    const [cfg, idx] = await Promise.all([getJSON('data/libraries.json'), getJSON('data/index.json')]);
    const files = Array.isArray(idx.files) ? idx.files : [];
    const parts = await Promise.all(files.map(f => getJSON('data/' + f).catch(() => [])));
    const byId = new Map();
    for (const arr of parts) for (const b of (Array.isArray(arr) ? arr : [])) if (b && b.id && b.title) byId.set(b.id, b);
    config = cfg && Array.isArray(cfg.libraries) ? cfg : { libraries: [] };
    books = [...byId.values()];
    phase = 'ready';
  } catch (e) { phase = 'error'; }
  render(store.get('underline.pos', null));
}
load();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
