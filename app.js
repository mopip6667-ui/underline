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
const CAP = window.Capacitor;
const NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
const P = NATIVE ? CAP.Plugins : {};
const REMOTE = 'https://mopip6667-ui.github.io/underline/';
// localStorage for speed; on the native apps every write is mirrored to device storage (Preferences), which the OS won't purge.
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { const j = JSON.stringify(v); try { localStorage.setItem(k, j); } catch {} if (NATIVE && P.Preferences) P.Preferences.set({ key: k, value: j }).catch(() => {}); }
};
async function hydrateNative() {
  if (!NATIVE || !P.Preferences) return;
  try { const { keys } = await P.Preferences.keys(); for (const k of keys) if (k.startsWith('underline.')) { const { value } = await P.Preferences.get({ key: k }); if (value != null) try { localStorage.setItem(k, value); } catch {} } } catch {}
}
const haptic = () => { if (NATIVE && P.Haptics) P.Haptics.impact({ style: 'LIGHT' }).catch(() => {}); };

let texts = { books: {}, titles: {} }, books = [], config = { libraries: [] }, saved = store.get('underline.saved', []), scope = { kind: 'all' }, shuffled = null, nav = [];

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
  const len = (c.text || '').length * 1.6 + (c.meaning || '').length + (c.apply || '').length;
  const dense = len > 470 ? ' xlong' : len > 400 ? ' long' : '';   // long cards get slightly smaller type on short screens
  return `<article class="card${q ? ' isq' : ''}${dense}" data-id="${esc(c.id)}" style="--c:${okColor(b.color)}">
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
  store.set('underline.saved', saved); syncSaveButtons(); if (!has) haptic();
  if (!onlyOn) toast(has ? 'Removed from Saved' : 'Saved');
  return !has;
}
function pop(card) { const d = document.createElement('div'); d.className = 'pop'; d.innerHTML = I.save; card.appendChild(d); setTimeout(() => d.remove(), 800); }
async function copyText(t, ok) {
  if (NATIVE && P.Share && ok === 'Shared') { try { await P.Share.share({ text: t, dialogTitle: 'Share this card' }); } catch {} return; }
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
    if (a === 'book') openBook(c.book.id);
    return;
  }
  if (!card || !card.dataset.id) return;
  const now = Date.now();
  if (lastTap.id === card.dataset.id && now - lastTap.t < 320) { lastTap = { id: null, t: 0 }; toggleSave(card.dataset.id, true); pop(card); }
  else lastTap = { id: card.dataset.id, t: now };
});
document.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => { const v = ch.dataset.view; if (v === 'lib') { openLib(); return; } if (v === 'reels') { openReels(); return; } setScope({ kind: v }); }));
$('#scopeX').addEventListener('click', () => setScope({ kind: 'all' }));
$('#shuffleBtn').addEventListener('click', () => {
  if (scope.kind === 'all') { const ids = list().map(c => c.id); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } shuffled = ids; render(); toast('Shuffled'); }
  else { const l = list(); if (l.length) { feed.scrollTop = Math.floor(Math.random() * l.length) * feed.clientHeight; toast('Random card'); } }
});
$('#moreBtn').addEventListener('click', () => {
  const nc = books.reduce((n, b) => n + cardsOf(b).length, 0);
  $('#aboutSub').textContent = `${libs().length} libraries · ${books.length} books · ${nc} cards · ${Object.keys(allTexts()).length} full books · version ${APP_VERSION}`;
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
  if (nav[0] === '__read') {
    const all = Object.entries(allTexts()).sort((a, b) => a[1].title.localeCompare(b[1].title));
    P.innerHTML = `<button class="back" data-back>‹ Library</button><div class="hd"><div><h3>Full books</h3><p class="sub">Public-domain classics, complete and free. Your place is saved.</p></div>${close}</div>
    ${continueHTML()}<ul class="rows">${all.map(([f, m]) => { const pr = progressOf(f); return `<li><button class="open" data-read="${esc(f)}"><span><b>${esc(m.title)}</b><small>${esc(m.author || '')}${pr ? ` · ${pr.pct}% read` : ''}</small></span><span class="chev">›</span></button></li>`; }).join('')}</ul>`;
    return;
  }
  const l = nav[0] && L.find(x => x.id === nav[0]), s = l && nav[1] && l.shelves.find(x => x.id === nav[1]);
  if (!l) {
    const nt = Object.keys(allTexts()).length;
    P.innerHTML = `<div class="hd"><div><h3>Library</h3><p class="sub">${L.length} libraries · ${books.length} books · ${countCards(books)} cards</p></div>${close}</div>
    ${continueHTML()}
    <div class="tiles">${nt ? `<button class="tile" data-fullbooks style="--c:#3a2a12"><b>Full books</b><span>${nt} free classics to read</span></button>` : ''}${L.map(x => { const bs = x.shelves.flatMap(y => y.books); return `<button class="tile" data-lib="${esc(x.id)}" style="--c:${x.color}"><b>${esc(x.name)}</b><span>${x.shelves.length} shelves · ${countCards(bs)} cards</span></button>`; }).join('')}</div>`;
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
  ${s.books.length ? `<button class="btn swipe" data-swipe="shelf">Swipe this shelf</button><h4>On this shelf</h4><ul class="rows">${s.books.map(b => `<li><button class="open" data-book="${esc(b.id)}"><span class="dot" style="background:${okColor(b.color)}"></span><span><b>${esc(b.title)}</b><small>${esc(b.author || '')}${b.author ? ' · ' : ''}${cardsOf(b).length} cards${textFor(b) ? ' · full book' : ''}</small></span><span class="chev">›</span></button></li>`).join('')}</ul>` : ''}
  ${sug.length ? `<h4>Coming up on this shelf</h4><ul class="rows">${sug.map(x => { const f = texts.titles[norm(x.t)]; return `<li><span class="open" style="cursor:default"><span><b>${esc(x.t)}${f ? '<span class="readtag">Full book</span>' : x.free ? '<span class="pd">Free</span>' : ''}</b><small>${esc(x.a || '')}${!f && x.free ? ` · <a class="free" href="${freeLink(x.t)}" target="_blank" rel="noopener">Read it free</a>` : ''}</small></span></span>${f ? `<button class="mini" data-read="${esc(f)}">Read</button>` : ''}</li>`; }).join('')}</ul>` : ''}`;
}
$('#libPanel').addEventListener('click', e => {
  const t = e.target;
  const tile = t.closest('[data-lib]'); if (tile) { nav = [tile.dataset.lib]; renderLib(); $('#libPanel').scrollTop = 0; return; }
  const sh = t.closest('[data-shelf]'); if (sh) { nav = [nav[0], sh.dataset.shelf]; renderLib(); $('#libPanel').scrollTop = 0; return; }
  if (t.closest('[data-back]')) { nav = nav.slice(0, -1); renderLib(); return; }
  const sw = t.closest('[data-swipe]'); if (sw) { closeSheets(); setScope(sw.dataset.swipe === 'library' ? { kind: 'library', lib: nav[0] } : { kind: 'shelf', lib: nav[0], shelf: nav[1] }); return; }
  const bk = t.closest('[data-book]'); if (bk) { closeSheets(); openBook(bk.dataset.book); return; }
  const rd = t.closest('[data-read]'); if (rd) { closeSheets(); openReader(rd.dataset.read); return; }
  if (t.closest('[data-fullbooks]')) { nav = ['__read']; renderLib(); $('#libPanel').scrollTop = 0; }
});

document.addEventListener('keydown', e => {
  const sheetOpen = !!document.querySelector('.scrim:not([hidden])');
  if (RV && RV.open && !sheetOpen && $('#reader').hidden) {
    if (e.key === 'Escape') closeReels();
    else if (e.key === ' ') { e.preventDefault(); toggleUserPause(); }
    else if (e.key === 'ArrowRight') nextScene();
    else if (e.key === 'ArrowLeft') prevScene();
    else if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); goReel(RV.idx + 1); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); goReel(RV.idx - 1); }
    else if (e.key === 'm') $('#rvSound').click();
    else if (e.key === 's') $('#rvSave').click();
    return;
  }
  if (!$('#reader').hidden && !sheetOpen) { if (e.key === 'Escape') $('#rClose').click(); return; }
  if (e.key === 'Escape') { closeSheets(); return; }
  if (sheetOpen) return;
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); feed.scrollBy({ top: feed.clientHeight }); }
  else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); feed.scrollBy({ top: -feed.clientHeight }); }
  else if (e.key === 's') { const id = currentId(); if (id) toggleSave(id); }
});
const feedRO = new ResizeObserver(() => { const id = currentId(); if (id) { const k = [...feed.children].findIndex(c => c.dataset.id === id); if (k >= 0) feed.scrollTop = k * feed.clientHeight; } });
feedRO.observe(feed);
let posT; feed.addEventListener('scroll', () => { clearTimeout(posT); posT = setTimeout(() => { if (scope.kind === 'all') store.set('underline.pos', currentId()); }, 300); }, { passive: true });


/* ---------- full books: book page + reader ---------- */
const textFor = b => b && (texts.books[b.id] || texts.titles[norm(b.title)]) || null;
function allTexts() {
  const m = {};
  for (const [k, f] of Object.entries(texts.titles)) m[f] = m[f] || { title: (texts.meta && texts.meta[f] && texts.meta[f].title) || titleFromFile(f), author: (texts.meta && texts.meta[f] && texts.meta[f].author) || '' };
  return m;
}
function titleFromFile(f) { for (const b of books) if (textFor(b) === f) return b.title; return f.replace(/\.json$/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function progressOf(f) { const p = store.get('underline.read.' + f, null); return p && typeof p.ch === 'number' ? p : null; }
function continueHTML() {
  const last = store.get('underline.lastRead', null); if (!last || !last.f) return '';
  const p = progressOf(last.f); if (!p) return '';
  return `<button class="cont" data-read="${esc(last.f)}"><span><b>${esc(last.title || 'Continue reading')}</b><small>${esc(p.chTitle || '')} · ${p.pct}% read</small></span><span>Continue ›</span></button>`;
}
const findLinks = t => [
  ['Your library (Libby / OverDrive)', 'Free with a library card', `https://www.overdrive.com/search?q=${encodeURIComponent(t)}`],
  ['Hoopla', 'Free with a library card, no waitlist', `https://www.hoopladigital.com/search?q=${encodeURIComponent(t)}`],
  ['Open Library', 'Free digital borrowing', `https://openlibrary.org/search?q=${encodeURIComponent(t)}&mode=ebooks`]
];
function openBook(id) {
  const b = books.find(x => x.id === id); if (!b) return;
  const L = libs(), p = placeOf(b, L), n = cardsOf(b).length, f = textFor(b), pr = f && progressOf(f);
  $('#bookPanel').innerHTML = `<div class="hd"><div class="bookhd"><span class="cover" style="background:${okColor(b.color)}"></span><div><h3>${esc(b.title)}</h3><p class="sub">${esc(b.author || '')}${p.s && p.l.id !== 'unsorted' ? `<br>${esc(p.l.name)} · ${esc(p.s.name)}` : ''}</p></div></div><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  ${n ? `<button class="btn swipe" data-bookswipe="${esc(b.id)}">Swipe ${n} cards</button>` : ''}
  ${f ? `<button class="btn wide" data-read="${esc(f)}">${pr ? `Continue reading · ${pr.pct}%` : 'Read the full book'}</button><p class="sub" style="margin-top:10px">Complete public-domain edition. Your place is saved on this device.</p>`
      : `<h4>Read the full book</h4><p class="sub">This book is still under copyright, so it can’t be included here. You can usually borrow it free:</p><div class="links">${findLinks(b.title).map(([a, s2, u]) => `<a href="${u}" target="_blank" rel="noopener"><span>${esc(a)}<br><small>${esc(s2)}</small></span><span>›</span></a>`).join('')}</div>`}`;
  $('#bookSheet').hidden = false;
}
$('#bookPanel').addEventListener('click', e => {
  const sw = e.target.closest('[data-bookswipe]'); if (sw) { closeSheets(); setScope({ kind: 'book', book: sw.dataset.bookswipe }); return; }
  const rd = e.target.closest('[data-read]'); if (rd) { closeSheets(); openReader(rd.dataset.read); }
});

const R = { f: null, book: null, ch: 0 };
const SIZES = [16, 18, 19, 21, 24];
const textCache = new Map();
const rScroll = $('#rScroll');
function applyReaderPrefs() {
  const pref = store.get('underline.readerPrefs', { size: 2, light: false });
  $('#reader').style.setProperty('--rfs', SIZES[pref.size ?? 2] + 'px');
  $('#reader').classList.toggle('light', !!pref.light);
  return pref;
}
async function openReader(f) {
  $('#reader').hidden = false; applyReaderPrefs();
  $('#rBook').textContent = 'Loading…'; $('#rChap').textContent = ''; $('#rBody').innerHTML = '';
  try {
    let book = textCache.get(f);
    if (!book) { book = await getJSON('data/texts/' + f); if (!book || !Array.isArray(book.chapters) || !book.chapters.length) throw 0; textCache.set(f, book); }
    R.f = f; R.book = book;
    const pr = progressOf(f);
    showChapter(pr ? Math.min(pr.ch, book.chapters.length - 1) : 0, pr ? pr.y : 0);
  } catch {
    $('#rBook').textContent = 'Couldn’t open this book';
    $('#rBody').innerHTML = '<p>Check your connection and try again. Books you have opened before work offline.</p>';
  }
}
function showChapter(i, y) {
  const b = R.book, c = b.chapters[i]; R.ch = i;
  $('#rBook').textContent = b.title; $('#rChap').textContent = `${c.title} · ${i + 1} of ${b.chapters.length}`;
  const src = i === 0 ? `<p class="src">${esc(b.author || '')}${b.translator ? ' · translated by ' + esc(b.translator) : ''}<br>${b.source && b.source.url ? `<a href="${esc(b.source.url)}" target="_blank" rel="noopener">${esc(b.source.name || 'Source')}</a>` : ''}</p>` : '';
  $('#rBody').innerHTML = `${src}<h2>${esc(c.title)}</h2>${(c.paras || []).map(t => String(t).startsWith('§ ') ? `<h3>${esc(String(t).slice(2))}</h3>` : `<p>${esc(t)}</p>`).join('')}
  <div class="rnav"><button data-rch="${i - 1}" ${i ? '' : 'disabled'}>‹ Previous</button><button class="next" data-rch="${i + 1}" ${i < b.chapters.length - 1 ? '' : 'disabled'}>${i < b.chapters.length - 1 ? 'Next chapter ›' : 'The end'}</button></div>`;
  requestAnimationFrame(() => { rScroll.scrollTop = (y || 0) * Math.max(0, rScroll.scrollHeight - rScroll.clientHeight); saveProgress(); });
}
function saveProgress() {
  if (!R.book || $('#reader').hidden || !rScroll.clientHeight) return;
  const max = Math.max(1, rScroll.scrollHeight - rScroll.clientHeight), y = Math.min(1, rScroll.scrollTop / max), n = R.book.chapters.length;
  const pct = Math.min(100, Math.round(((R.ch + y) / n) * 100));
  $('#rProg').style.width = pct + '%';
  store.set('underline.read.' + R.f, { ch: R.ch, y, pct, chTitle: R.book.chapters[R.ch].title, t: Date.now() });
  store.set('underline.lastRead', { f: R.f, title: R.book.title });
}
let rT; rScroll.addEventListener('scroll', () => { clearTimeout(rT); rT = setTimeout(saveProgress, 250); }, { passive: true });
$('#rBody').addEventListener('click', e => { const b = e.target.closest('[data-rch]'); if (b && !b.disabled) showChapter(+b.dataset.rch, 0); });
$('#rClose').addEventListener('click', () => { clearTimeout(rT); saveProgress(); $('#reader').hidden = true; });
$('#rSize').addEventListener('click', () => { const p = applyReaderPrefs(), y = rScroll.scrollTop / Math.max(1, rScroll.scrollHeight - rScroll.clientHeight); p.size = ((p.size ?? 2) + 1) % SIZES.length; store.set('underline.readerPrefs', p); applyReaderPrefs(); rScroll.scrollTop = y * (rScroll.scrollHeight - rScroll.clientHeight); toast('Text size ' + (p.size + 1) + ' of ' + SIZES.length); });
$('#rTheme').addEventListener('click', () => { const p = applyReaderPrefs(); p.light = !p.light; store.set('underline.readerPrefs', p); applyReaderPrefs(); });
$('#rToc').addEventListener('click', () => {
  if (!R.book) return;
  $('#tocPanel').innerHTML = `<div class="hd"><div><h3>${esc(R.book.title)}</h3><p class="sub">${R.book.chapters.length} chapters</p></div><button type="button" class="x" data-close aria-label="Close">✕</button></div>
  <ul class="rows toc">${R.book.chapters.map((c, i) => `<li><button class="open${i === R.ch ? ' cur' : ''}" data-toc="${i}"><span><b>${esc(c.title)}</b></span><span class="chev">›</span></button></li>`).join('')}</ul>`;
  $('#tocSheet').hidden = false;
  const cur = $('#tocPanel .cur'); if (cur) cur.scrollIntoView({ block: 'center' });
});
$('#tocPanel').addEventListener('click', e => { const b = e.target.closest('[data-toc]'); if (b) { $('#tocSheet').hidden = true; showChapter(+b.dataset.toc, 0); } });

/* ---------- daily card (native apps) ---------- */
const DAILY_IDS = Array.from({ length: 14 }, (_, i) => 1000 + i);
async function scheduleDaily() {
  const LN = P.LocalNotifications; if (!NATIVE || !LN) return;
  const pref = store.get('underline.daily', { on: false, hour: 8 });
  try { await LN.cancel({ notifications: DAILY_IDS.map(id => ({ id })) }); } catch {}
  if (!pref.on) return;
  const pool = Object.values(cardMap()); if (!pool.length) return;
  const now = new Date(), notifications = [];
  for (let d = 0; d < DAILY_IDS.length; d++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, pref.hour, 0, 0);
    if (at <= now) continue;
    const c = pool[Math.floor(Math.random() * pool.length)];
    notifications.push({ id: DAILY_IDS[d], title: c.book.title, body: (c.type === 'quote' ? '“' + c.text + '”' : c.text), schedule: { at }, extra: { card: c.id } });
  }
  try { await LN.schedule({ notifications }); } catch {}
}
async function setDaily(on, hour) {
  const LN = P.LocalNotifications; if (!LN) return;
  if (on) {
    let perm = await LN.checkPermissions().catch(() => ({ display: 'denied' }));
    if (perm.display !== 'granted') perm = await LN.requestPermissions().catch(() => ({ display: 'denied' }));
    if (perm.display !== 'granted') { toast('Turn on notifications for Eerah in Settings'); on = false; }
  }
  store.set('underline.daily', { on, hour }); await scheduleDaily(); renderDaily();
  if (on) toast(`Daily card at ${fmtHour(hour)}`);
}
const fmtHour = h => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'AM' : 'PM'}`;
function renderDaily() {
  const box = $('#dailyBox'); if (!box) return;
  box.hidden = !NATIVE;
  const pref = store.get('underline.daily', { on: false, hour: 8 });
  $('#dailyBtn').textContent = pref.on ? `On · ${fmtHour(pref.hour)}` : 'Off';
  $('#dailyBtn').setAttribute('aria-pressed', String(pref.on));
  $('#dailyHour').value = String(pref.hour);
}
if ($('#dailyBtn')) {
  $('#dailyBtn').addEventListener('click', () => { const p = store.get('underline.daily', { on: false, hour: 8 }); setDaily(!p.on, p.hour); });
  $('#dailyHour').addEventListener('change', e => { const p = store.get('underline.daily', { on: false, hour: 8 }); setDaily(p.on, +e.target.value); });
}
if (NATIVE && P.LocalNotifications) P.LocalNotifications.addListener('localNotificationActionPerformed', ev => {
  const id = ev && ev.notification && ev.notification.extra && ev.notification.extra.card; if (!id) return;
  const go = () => { closeSheets(); setScope({ kind: 'all' }); const k = list().findIndex(c => c.id === id); if (k >= 0) feed.scrollTop = k * feed.clientHeight; };
  if (phase === 'ready') go(); else setTimeout(go, 1500);
});


/* ---------- Reels: each card plays as a short animated clip (hook → meaning → try this → book) ---------- */
const reels = $('#reels'), rfeed = $('#rfeed'), segsEl = $('#segs');
const TTS = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const AU = new Audio(); AU.preload = 'auto'; AU.setAttribute('playsinline', '');   // one persistent player: iOS only lets an element that was started by a tap keep playing
const ABLOB = new Map(), AURL = new Map();                                        // narration files fetched ahead into memory, so each line starts instantly
function fetchAudio(path) {
  if (ABLOB.has(path)) return ABLOB.get(path);
  const tryUrl = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return URL.createObjectURL(await r.blob()); };
  const p = tryUrl(path).catch(e => { if (NATIVE) return tryUrl(REMOTE + path); throw e; })
    .then(u => { AURL.set(path, u); return u; })
    .catch(() => { ABLOB.delete(path); return null; });
  ABLOB.set(path, p);
  if (ABLOB.size > 90) { const old = ABLOB.keys().next().value; const u = AURL.get(old); if (u) { try { URL.revokeObjectURL(u); } catch {} } ABLOB.delete(old); AURL.delete(old); }
  return p;
}
let AUD = {};                                                                     // narration manifest (data/audio/manifest.json), filled by the weekly voice job
let RV = { list: [], el: null, idx: -1, scenes: [], s: -1, elapsed: 0, dur: 0, paused: false, hold: false, user: false, cover: false, timer: null, voice: 'none', speechDone: true, sound: store.get('underline.reels.sound', true) !== false, open: false, anim: 0 };
const CHECK = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const ARROW = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const wordCount = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function kinetic(text, hlWord) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  let hi = -1;
  if (hlWord !== false) { let best = 0; words.forEach((w, i) => { const l = w.replace(/[^a-z]/gi, '').length; if (l >= 6 && l > best) { best = l; hi = i; } }); }
  return words.map((w, i) => `<span class="w${i === hi ? ' hl' : ''}" style="--i:${i}">${esc(w)}</span>${i < words.length - 1 ? ' ' : ''}`).join('');
}
function scenesOf(c) {
  const b = c.book, q = c.type === 'quote', ent = AUD[c.id];
  const D = [{ role: 'idea', say: q ? c.text + (b.author ? '. ' + b.author + '.' : '') : c.text, n: wordCount(c.text) }];
  if (c.meaning) D.push({ role: 'meaning', say: c.meaning, n: wordCount(c.meaning) });
  if (c.apply) D.push({ role: 'apply', say: 'Try this. ' + c.apply, n: wordCount(c.apply) });
  D.push({ role: 'end', say: b.title + (b.author ? ', by ' + b.author : ''), n: 0, end: true });
  for (const s of D) {
    const a = ent && Array.isArray(ent.s) ? ent.s.find(x => x.r === s.role) : null;
    if (a && a.d > 0) { s.ad = a.d; s.path = `data/audio/${ent.f}/${s.role}.m4a`; }
    s.d0 = s.role === 'apply' ? (s.ad ? .85 : .5) : .15;
    if (s.end) { s.step = .3; s.dur = Math.max(3000, (s.ad || 0) * 1000 + 900); continue; }
    if (s.ad) { s.step = clamp((s.ad - s.d0 - .3) / Math.max(1, s.n), .15, .5); s.dur = Math.max(2600, (s.ad + .3) * 1000); }   // words land in time with the voice
    else { s.step = s.role === 'idea' ? .34 : .3; s.dur = clamp((s.n * s.step + s.d0 + 1.7) * 1000, 3000, 11000); }
  }
  return D;
}
function sceneHTML(s, c) {
  const b = c.book, q = c.type === 'quote', st = `style="--step:${s.step}s;--d0:${s.d0}s"`;
  let h;
  if (s.role === 'idea') h = `<span class="kick">${q ? 'Quote' : 'The idea'}</span><p class="rt ${q ? 'q' : 'big'}">${kinetic(q ? '“' + c.text + '”' : c.text)}</p>${q && b.author ? `<div class="by" style="--byd:${(s.n * s.step + s.d0 + .25).toFixed(2)}s">— ${esc(b.author)}</div>` : ''}`;
  else if (s.role === 'meaning') h = `<span class="kick">What it means</span><p class="rt mid">${kinetic(c.meaning, false)}</p>`;
  else if (s.role === 'apply') h = `<span class="kick y">Try this</span><div class="tryc"><div class="tick">${CHECK}</div><p class="rt mid">${kinetic(c.apply, false)}</p></div>`;
  else h = `<div class="cover2">${esc(b.title)}</div><h3 class="endt">${esc(b.title)}</h3>${b.author ? `<div class="by" style="--byd:.5s">${esc(b.author)}</div>` : ''}<div class="next">${ARROW} Swipe up for the next one</div>`;
  return `<div class="scene${s.end ? ' endc' : ''}" data-k="${s.k}" ${st}>${h}</div>`;
}
function reelShell(c, i) { return `<section class="reel" data-id="${esc(c.id)}" data-i="${i}" style="--c:${okColor(c.book.color)}"><div class="bg"></div></section>`; }
// Only the playing clip and its two neighbours carry the heavy layers (blobs, text, scenes); the other ~290 stay as flat colour. This is what keeps swiping smooth.
function dress(i) {
  const el = rfeed.children[i]; if (!el || el.dataset.d) return;
  const c = RV.list[i], where = placeOf(c.book, libs()), tag = where.s && where.l && where.l.id !== 'unsorted' ? where.s.name : (c.type === 'quote' ? 'Quote' : 'Idea');
  const sc = scenesOf(c); sc.forEach((s, k) => { s.k = k; });
  el._scenes = sc; el.dataset.d = '1';
  el.insertAdjacentHTML('beforeend', `<div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div><div class="ghost">${esc(tag)}</div><div class="stage">${sc.map(s => sceneHTML(s, c)).join('')}<div class="rfoot">${esc(c.book.title)}${c.book.author ? ' · ' + esc(c.book.author) : ''} · ${i + 1} of ${RV.list.length}</div></div>`);
}
function undress(i) { const el = rfeed.children[i]; if (!el || !el.dataset.d) return; el.querySelectorAll('.blob,.ghost,.stage').forEach(n => n.remove()); delete el.dataset.d; el._scenes = null; el.classList.remove('act'); }
function openReels() {
  if (phase !== 'ready') { toast('Still loading'); return; }
  const l = list(); if (!l.length) { toast(scope.kind === 'saved' ? 'Save a card first' : 'Nothing to play here'); return; }
  const start = currentId();
  RV.list = l; RV.open = true; RV.idx = -1; RV.s = -1; RV.hold = RV.user = false; RV.cover = false; reels.hidden = false;
  rfeed.innerHTML = l.map(reelShell).join('');
  $('#rCount').textContent = scope.kind === 'saved' ? 'Saved' : (scopeLabel() || '');
  $('#rvSound').hidden = false; syncSound(); applyPause(true);
  const k = Math.max(0, start ? l.findIndex(c => c.id === start) : 0);
  rfeed.scrollTop = k * rfeed.clientHeight;
  activate(k);                     // synchronous, inside the tap: lets iOS start the voice
  const hint = $('#rvHint'); if (!store.get('underline.reels.hint', false)) { store.set('underline.reels.hint', true); hint.style.display = ''; } else hint.style.display = 'none';
  haptic();
}
function closeReels() { stopPlayer(); RV.open = false; reels.hidden = true; const id = RV.list[RV.idx] && RV.list[RV.idx].id; rfeed.innerHTML = ''; RV.idx = -1; if (id && scope.kind !== 'library' && scope.kind !== 'shelf') { const k = list().findIndex(c => c.id === id); if (k >= 0) feed.scrollTop = k * feed.clientHeight; } }
function syncSound() { const on = RV.sound, b = $('#rvSound'); b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Voice on' : 'Voice off'); b.style.opacity = on ? 1 : .55; reels.querySelector('.wv').style.display = on ? '' : 'none'; }
function stopVoice() { RV.voice = 'none'; RV.speechDone = true; try { AU.pause(); } catch {} if (TTS) try { speechSynthesis.cancel(); } catch {} }
function stopPlayer() { clearInterval(RV.timer); RV.timer = null; if (RV.anim) { cancelAnimationFrame(RV.anim); RV.anim = 0; rfeed.style.scrollSnapType = ''; } stopVoice(); }
function pickVoice() {
  if (!TTS) return null; const vs = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
  const en = vs.filter(v => /^en(-|_|$)/i.test(v.lang)); if (!en.length) return null;
  const gb = v => /en[-_]GB/i.test(v.lang), rank = v => (gb(v) && /premium|enhanced|neural|natural/i.test(v.name) && /female|sonia|serena|kate|martha|stephanie|libby/i.test(v.name) ? 0 : gb(v) && /sonia|serena|kate|martha|stephanie|google uk english female/i.test(v.name) ? 1 : gb(v) ? 2 : /premium|enhanced|neural/i.test(v.name) ? 3 : 4);   // stand-in for Sonia when a clip has no recording yet
  return en.slice().sort((a, b) => rank(a) - rank(b))[0];
}
function activate(i) {
  if (!RV.open || i < 0 || i >= RV.list.length || i === RV.idx) return;
  stopVoice();
  const old = rfeed.children[RV.idx]; if (old) { old.classList.remove('act'); old.querySelectorAll('.scene').forEach(s => s.classList.remove('on', 'out')); }
  for (const j of [i - 1, i, i + 1]) dress(j);
  for (let j = Math.max(0, RV.idx - 3); j <= Math.min(RV.list.length - 1, RV.idx + 3); j++) if (RV.idx >= 0 && Math.abs(j - i) > 1) undress(j);
  RV.idx = i; RV.user = false; RV.s = -1;
  const el = rfeed.children[i], c = RV.list[i]; RV.el = el; RV.scenes = el._scenes; el.classList.add('act');
  segsEl.innerHTML = RV.scenes.map(() => '<i><b></b></i>').join('');
  const sv = $('#rvSave'); sv.innerHTML = I.save; sv.setAttribute('aria-pressed', String(saved.includes(c.id)));
  $('#rvShare').innerHTML = I.copy; $('#rvBook').innerHTML = I.book;
  RV.cover = coverUp(); applyPause(true);
  warm(i); playScene(0);
  warm(i + 1); warm(i - 1);
}
function warm(i) { const sc = rfeed.children[i] && rfeed.children[i]._scenes; if (sc) sc.forEach(s => { if (s.path) fetchAudio(s.path); }); }
function playScene(k) {
  const S = RV.scenes[k]; if (!S) return;
  const els = RV.el.querySelectorAll('.scene'), prev = RV.s;
  els.forEach((e, j) => {
    if (j === k) { if (e.classList.contains('on')) { e.classList.remove('on'); void e.offsetWidth; } e.classList.remove('out'); e.classList.add('on'); }
    else if (e.classList.contains('on')) { e.classList.remove('on'); e.classList.add('out'); setTimeout(() => e.classList.remove('out'), 650); }
  });
  RV.s = k; RV.elapsed = 0; RV.dur = S.dur; RV.voice = 'none'; RV.speechDone = true;
  RV.el.style.setProperty('--s', k);
  [...segsEl.children].forEach((e, j) => { e.className = j < k ? 'done' : j === k ? 'cur' : ''; e.style.setProperty('--d', (S.dur / 1000) + 's'); });
  try { AU.pause(); if (TTS) speechSynthesis.cancel(); } catch {}
  if (RV.sound && !RV.paused) startVoice(S);
  clearInterval(RV.timer); RV.timer = setInterval(tick, 50);
}
function startVoice(S) {
  RV.speechDone = false;
  if (S.path) {
    RV.voice = 'audio'; RV.tried = 0;
    try { AU._path = S.path; AU.src = AURL.get(S.path) || S.path; AU.currentTime = 0; const p = AU.play(); if (p && p.catch) p.catch(() => audioFail()); } catch { audioFail(); }
  } else speakTTS(S);
}
function audioFail() {
  if (RV.voice !== 'audio') return; const S = RV.scenes[RV.s]; if (!S) return;
  if (NATIVE && !RV.tried && S.path) { RV.tried = 1; try { AU.src = REMOTE + S.path; const p = AU.play(); if (p && p.catch) p.catch(() => audioFail()); return; } catch {} }   // new weekly clips aren't in the app bundle yet
  speakTTS(S);
}
function speakTTS(S) {
  if (!TTS) { RV.voice = 'none'; RV.speechDone = true; return; }
  RV.voice = 'tts'; RV.speechDone = false; const tok = RV.idx + ':' + RV.s;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(S.say), v = pickVoice(); if (v) { u.voice = v; u.lang = v.lang; } u.rate = 0.98; u.pitch = 1;
    const done = () => { if (RV.idx + ':' + RV.s === tok) RV.speechDone = true; };
    u.onend = done; u.onerror = done; speechSynthesis.speak(u);
  } catch { RV.voice = 'none'; RV.speechDone = true; }
}
AU.addEventListener('ended', () => { if (RV.voice === 'audio') RV.speechDone = true; });
AU.addEventListener('error', () => { if (RV.voice === 'audio') audioFail(); });
function tick() {
  if (RV.paused || !RV.open) return;
  RV.elapsed += 50;
  if (RV.sound && RV.voice === 'none' && RV.scenes[RV.s] && RV.elapsed <= 200) startVoice(RV.scenes[RV.s]);   // voice switched on, or was blocked until now
  const voicing = RV.sound && RV.voice !== 'none' && !RV.speechDone && RV.elapsed < RV.dur * 2.2 + 2500;
  if (RV.elapsed >= RV.dur && !voicing) nextScene();
}
function slideTo(k, ms) {
  if (RV.anim) cancelAnimationFrame(RV.anim);
  const from = rfeed.scrollTop, to = k * rfeed.clientHeight;
  if (REDUCED || from === to) { rfeed.scrollTop = to; return; }
  rfeed.style.scrollSnapType = 'none';
  const t0 = performance.now(), ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const step = now => { const t = Math.min(1, (now - t0) / (ms || 360)); rfeed.scrollTop = from + (to - from) * ease(t); if (t < 1) RV.anim = requestAnimationFrame(step); else { RV.anim = 0; rfeed.style.scrollSnapType = ''; rfeed.scrollTop = to; } };
  RV.anim = requestAnimationFrame(step);
}
function goReel(k) { if (k < 0 || k >= RV.list.length) return false; activate(k); slideTo(k); return true; }   // clip starts as it slides in, no dead pause
function nextScene() {
  if (RV.s < RV.scenes.length - 1) { playScene(RV.s + 1); return; }
  if (!goReel(RV.idx + 1)) { clearInterval(RV.timer); stopVoice(); toast('That’s all for now'); }
}
function prevScene() {
  if (RV.elapsed > 1500 || RV.s > 0) { playScene(RV.elapsed > 1500 ? RV.s : RV.s - 1); return; }
  if (!goReel(RV.idx - 1)) playScene(0);
}
function coverUp() { return !!document.querySelector('.scrim:not([hidden])') || !$('#reader').hidden || document.hidden; }
function applyPause(force) {
  const p = RV.hold || RV.user || RV.cover; if (p === RV.paused && !force) return;
  const was = RV.paused; RV.paused = p; reels.classList.toggle('paused', p); reels.classList.toggle('showbadge', RV.hold || RV.user);
  if (p === was) return;
  if (p) { try { if (RV.voice === 'audio') AU.pause(); else if (TTS && RV.voice === 'tts') speechSynthesis.pause(); } catch {} }
  else { try { if (RV.voice === 'audio' && !RV.speechDone) { const q = AU.play(); if (q && q.catch) q.catch(() => audioFail()); } else if (RV.voice === 'tts' && !RV.speechDone) speechSynthesis.resume(); } catch {} }
}
function toggleUserPause() { RV.user = !RV.user; applyPause(); }
// feed scrolling by finger: switch clips as soon as the next one is half on screen, so its text starts while it slides in
let rvRaf = 0;
rfeed.addEventListener('scroll', () => { if (RV.anim || rvRaf) return; rvRaf = requestAnimationFrame(() => { rvRaf = 0; if (!RV.open || RV.anim) return; const k = Math.round(rfeed.scrollTop / Math.max(1, rfeed.clientHeight)); if (k !== RV.idx) activate(k); }); }, { passive: true });
// touch: sides skip a scene instantly, middle pauses (double-tap saves), hold pauses
let rvDown = null, rvMid = 0;
rfeed.addEventListener('pointerdown', e => {
  if (RV.anim) { cancelAnimationFrame(RV.anim); RV.anim = 0; rfeed.style.scrollSnapType = ''; }
  rvDown = { x: e.clientX, y: e.clientY, moved: false, held: false };
  const d = rvDown; d.h = setTimeout(() => { if (rvDown === d && !d.moved) { d.held = true; RV.hold = true; applyPause(); } }, 280);
});
rfeed.addEventListener('pointermove', e => { const d = rvDown; if (d && !d.moved && (Math.abs(e.clientX - d.x) > 10 || Math.abs(e.clientY - d.y) > 10)) { d.moved = true; clearTimeout(d.h); if (d.held) { d.held = false; RV.hold = false; applyPause(); } } });
const rvEnd = e => {
  const d = rvDown; if (!d) return; rvDown = null; clearTimeout(d.h);
  if (d.held) { RV.hold = false; applyPause(); return; }
  if (d.moved || e.type === 'pointercancel') return;
  const r = reels.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, now = Date.now();
  if (x < .33) { rvMid = 0; prevScene(); }
  else if (x > .67) { rvMid = 0; nextScene(); }
  else if (now - rvMid < 340) { rvMid = 0; toggleUserPause(); const id = RV.list[RV.idx] && RV.list[RV.idx].id; if (id) { toggleSave(id, true); $('#rvSave').setAttribute('aria-pressed', 'true'); pop(RV.el); } }
  else { rvMid = now; toggleUserPause(); }
};
rfeed.addEventListener('pointerup', rvEnd); rfeed.addEventListener('pointercancel', rvEnd);
rfeed.addEventListener('contextmenu', e => e.preventDefault());
$('#rvClose').addEventListener('click', closeReels);
$('#rvSound').addEventListener('click', () => { RV.sound = !RV.sound; store.set('underline.reels.sound', RV.sound); if (!RV.sound) stopVoice(); syncSound(); toast(RV.sound ? 'Voice on' : 'Voice off'); });
$('#rvSave').addEventListener('click', () => { const id = RV.list[RV.idx] && RV.list[RV.idx].id; if (!id) return; const on = toggleSave(id); $('#rvSave').setAttribute('aria-pressed', String(on)); });
$('#rvShare').addEventListener('click', () => { const c = RV.list[RV.idx]; if (c) copyText(`${c.type === 'quote' ? '“' + c.text + '”' : c.text}\n— ${c.book.title}${c.book.author ? ', ' + c.book.author : ''}\n\nWhat it means: ${c.meaning || ''}${c.apply ? '\nTry this: ' + c.apply : ''}`, 'Shared'); });
$('#rvBook').addEventListener('click', () => { const c = RV.list[RV.idx]; if (c) openBook(c.book.id); });
// pause under any sheet or the reader, and when the app is hidden
const rvGuard = () => { if (!RV.open) return; RV.cover = coverUp(); applyPause(); };
new MutationObserver(rvGuard).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['hidden'] });
document.addEventListener('visibilitychange', rvGuard);

/* ---------- load ---------- */
async function localJSON(p) { const r = await fetch(p, { cache: 'no-cache' }); if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); }
async function getJSON(p) {
  const isText = p.includes('/texts/') && !p.endsWith('index.json');
  if (NATIVE && isText) { try { return await localJSON(p); } catch {} } // bundled full books open instantly; only new ones download
  if (NATIVE) {
    try {
      const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 3000);
      const r = await fetch(REMOTE + p, { cache: 'no-cache', signal: ctl.signal }); clearTimeout(timer);
      if (r.ok) { const j = await r.json(); if (!p.includes('/texts/') || p.endsWith('index.json')) try { localStorage.setItem('underline.remote.' + p, JSON.stringify(j)); } catch {} return j; }
    } catch {}
    const cached = localStorage.getItem('underline.remote.' + p);
    if (cached) try { return JSON.parse(cached); } catch {}
  }
  return localJSON(p);
}
async function load() {
  phase = 'loading';
  if (NATIVE && !load.hydrated) { await hydrateNative(); load.hydrated = true; saved = store.get('underline.saved', []); }
  try {
    const [cfg, idx, tix, aud] = await Promise.all([getJSON('data/libraries.json'), getJSON('data/index.json'), getJSON('data/texts/index.json').catch(() => null), getJSON('data/audio/manifest.json').catch(() => null)]);
    AUD = aud && typeof aud === 'object' && !Array.isArray(aud) ? aud : {};
    if (tix && typeof tix === 'object') texts = { books: tix.books || {}, titles: tix.titles || {}, meta: tix.meta || {} };
    const files = Array.isArray(idx.files) ? idx.files : [];
    const parts = await Promise.all(files.map(f => getJSON('data/' + f).catch(() => [])));
    const byId = new Map();
    for (const arr of parts) for (const b of (Array.isArray(arr) ? arr : [])) if (b && b.id && b.title) byId.set(b.id, b);
    config = cfg && Array.isArray(cfg.libraries) ? cfg : { libraries: [] };
    books = [...byId.values()];
    phase = 'ready';
  } catch (e) { phase = 'error'; }
  render(store.get('underline.pos', null));
  if (NATIVE) { renderDaily(); scheduleDaily(); if (P.SplashScreen) P.SplashScreen.hide().catch(() => {}); }
}
load();
const APP_VERSION = '9';
if (!NATIVE && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {}); });
}
})();
