/* ============================================================
   Your Japanese Knife — game logic
   Loads knives.json, renders the codex, compare table, and
   the Dojo quiz. Tracks collection + XP in localStorage.
   ============================================================ */

const RARITY_LABEL = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic'
};

/* Whetstone grit tiers. In the quiz we show only the tier NAME so the numeric
   range never gives the answer away; the full ranges live in the whetstone
   compare table and its detail modal. */
const GRIT_LABEL = {
  'Coarse #120–#400': 'Coarse',
  'Medium #800–#2000': 'Medium',
  'Fine #3000–#5000': 'Fine',
  'Very Fine #6000–#8000': 'Very Fine',
  'Ultra Fine #10000+': 'Ultra Fine'
};

const RANKS = [
  { min: 0,    name: 'Apprentice',     emoji: '🌱' },
  { min: 100,  name: 'Prep Cook',      emoji: '🥢' },
  { min: 220,  name: 'Line Cook',      emoji: '🍳' },
  { min: 360,  name: 'Chef de Partie', emoji: '🍥' },
  { min: 520,  name: 'Sous Chef',      emoji: '🔪' },
  { min: 700,  name: 'Head Chef',      emoji: '👨‍🍳' },
  { min: 900,  name: 'Executive Chef', emoji: '🎌' },
  { min: 1150, name: 'Itamae',         emoji: '🍣' },
  { min: 1450, name: 'Shokunin',       emoji: '🏮' },
  { min: 1800, name: 'Knife Master',   emoji: '🏯' }
];

/* Higher-rarity blades stay hidden as silhouettes in the Codex until the user
   inspects them for the first time. */
const SPECIALIST_RARITIES = new Set(['rare', 'epic']);

/* Extended reference data (steels, anatomy, matrix, achievements, wizard,
   fix-it processes, steel quiz). Loaded from codex-data.js. */
const CD = window.CODEX_DATA || {};

const STORE_KEY = 'yjk-progress-v1';

// How many questions are drawn (at random) from the pool each round.
const QUIZ_LENGTH = 12;
// The Daily Dojo is always exactly this many questions.
const DAILY_LENGTH = 5;
// XP bonus for finishing all five Daily Dojo questions.
const DAILY_BONUS = 25;

const state = {
  knives: [],
  quiz: [],          // full question pool
  round: [],         // the randomized subset for the current run
  byId: {},
  stones: [],        // whetstone grit tiers
  stoneById: {},
  steels: [],        // Steel Codex entries
  steelById: {},
  filter: 'all',
  view: 'home',      // active top-level view
  search: '',        // Codex grid search query
  librarySearch: '', // Greater Codex archive search query
  steelSearch: '',   // Steel Codex search query
  collected: new Set(),
  readStones: new Set(),   // whetstone tiers whose detail was opened
  readLibrary: new Set(),  // Greater Codex families that were expanded
  steelsRead: new Set(),   // steels whose detail was opened
  libDiscovered: new Set(),// Greater Codex knives discovered (non-featured ids)
  libById: {},             // id -> Greater Codex knife entry
  recent: null,            // { emoji, name } of the most recently discovered knife
  roll: {},                // My Knife Roll: id -> { owned, length, steel, ... }
  achievements: new Set(), // unlocked achievement ids
  xp: 0,
  seenQuiz: new Set(),   // scenarios already shown in the Dojo
  quizIndex: 0,
  quizScore: 0,
  quizActive: false,
  quizIsDaily: false,    // whether the current run is the Daily Dojo
  dojoMode: 'all',   // Dojo training focus: all | knife | steel | sharpening | care
  curStreak: 0,      // consecutive correct answers in the current run
  // Lifetime Dojo statistics (persisted).
  dojo: { rounds: 0, answered: 0, correct: 0, best: 0, perfect: 0, bestStreak: 0 },
  // Daily Dojo tracking (persisted).
  daily: { date: '', done: false, score: 0, streak: 0, lastDate: '' },
  modalId: null,     // id of the knife currently shown in the detail modal
  modalKind: null    // 'knife' | 'stone' | 'steel'
};

/* Local calendar date as YYYY-MM-DD (used to seed and gate the Daily Dojo). */
function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

/* ---------- Persistence ---------- */
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.xp = data.xp || 0;
    state.collected = new Set(data.collected || []);
    state.readStones = new Set(data.readStones || []);
    state.readLibrary = new Set(data.readLibrary || []);
    state.steelsRead = new Set(data.steelsRead || []);
    state.libDiscovered = new Set(data.libDiscovered || []);
    state.recent = data.recent || null;
    state.roll = data.roll || {};
    // Migrate legacy single-record ownership -> an array of records so a knife
    // can be owned more than once.
    Object.keys(state.roll).forEach(id => {
      const r = state.roll[id];
      if (Array.isArray(r)) return;
      if (r && r.owned) {
        const { owned, ...rest } = r;
        state.roll[id] = [rest];
      } else {
        delete state.roll[id];
      }
    });
    state.achievements = new Set(data.achievements || []);
    state.seenQuiz = new Set(data.seenQuiz || []);
    if (data.dojo) state.dojo = { ...state.dojo, ...data.dojo };
    if (data.daily) state.daily = { ...state.daily, ...data.daily };
    if (data.dojoMode) state.dojoMode = data.dojoMode;
  } catch (e) { /* ignore corrupt store */ }
}
function saveProgress() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      xp: state.xp,
      collected: [...state.collected],
      readStones: [...state.readStones],
      readLibrary: [...state.readLibrary],
      steelsRead: [...state.steelsRead],
      libDiscovered: [...state.libDiscovered],
      recent: state.recent,
      roll: state.roll,
      achievements: [...state.achievements],
      seenQuiz: [...state.seenQuiz],
      dojo: state.dojo,
      daily: state.daily,
      dojoMode: state.dojoMode
    }));
  } catch (e) { /* storage may be unavailable */ }
}

/* ---------- Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* Escape user-supplied text before placing it in innerHTML. */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* Flatten a knife's searchable fields into one lowercase string. */
function knifeSearchText(k) {
  return [
    k.name, k.kanji, k.translation, k.role, k.purpose, k.edge, k.profile,
    ...(k.bestFor || []), ...(k.avoid || []), ...(k.techniques || []), ...(k.steels || [])
  ].join(' ').toLowerCase();
}

/* Care-topic keywords used to split the non-knife questions between the
   Sharpening and Care focuses. */
const CARE_RE = /wash|dishwasher|\bstore\b|storage|saya|cutting surface|cutting board|\bboard\b|patina|rust|\boil\b|camellia|tsubaki|drawer|magnetic|granite|glass, stone|dry it|hand wash/i;

/* Classify a Dojo question into one of the four focuses:
   knife (knife-id options), steel (tagged), care (upkeep/storage), else
   sharpening (grits, strops, angles, workflow). */
function quizCategory(q) {
  if (q.cat) return q.cat;
  const opts = q.options || [];
  if (opts.some(o => state.byId[o])) return 'knife';
  const text = `${q.scenario} ${q.answer || ''}`.toLowerCase();
  if (CARE_RE.test(text)) return 'care';
  return 'sharpening';
}

/* Fisher–Yates shuffle (returns a new array). */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Pick an emoji for a non-knife answer based on keywords. */
function keywordEmoji(text) {
  const t = text.toLowerCase();
  if (/ultra fine|#10000|#12000|mirror/.test(t)) return '💎';
  if (/very fine|#6000|#8000/.test(t)) return '✨';
  if (/\bfine\b|#3000|#5000/.test(t)) return '🌟';
  if (/medium|#800|#1000|#1200|#2000/.test(t)) return '🧱';
  if (/coarse|#120|#220|#400/.test(t)) return '🪨';
  if (/strop|leather|balsa/.test(t)) return '🟫';
  if (/compound|chromium|green|paste/.test(t)) return '🟢';
  if (/nagura|slurry/.test(t)) return '⚪';
  if (/flatten|lapping|dish|concave/.test(t)) return '📏';
  if (/soak|splash|water/.test(t)) return '💧';
  if (/oil|camellia|tsubaki|patina|carbon/.test(t)) return '🛢️';
  if (/angle|°|degree|bevel/.test(t)) return '📐';
  if (/rod|steel|hone|honing/.test(t)) return '⚙️';
  if (/board|wood/.test(t)) return '🪵';
  if (/wash|dry|store|saya|dishwasher/.test(t)) return '🧼';
  if (/burr|wire edge|deburr|realign/.test(t)) return '🪒';
  if (/paper|sharp|test/.test(t)) return '📄';
  return '🔧';
}

/* Resolve a quiz option (knife id OR plain label) to a display label + emoji. */
function optionMeta(opt) {
  const k = state.byId[opt];
  if (k) return { label: k.name, emoji: k.emoji };
  // Grit options collapse to their tier name; emoji is still keyed off the
  // original text (which carries the #range) so the icon stays accurate.
  return { label: GRIT_LABEL[opt] || opt, emoji: keywordEmoji(opt) };
}

/* A question may accept several answers (e.g. multiple grits that all work).
   Falls back to the single `answer` when no `answers` list is provided. */
function acceptedAnswers(q) {
  return q.answers && q.answers.length ? q.answers : [q.answer];
}

/* Join labels into a readable phrase: "A, B, and C" / "A or B". */
function formatList(items, conj = 'and') {
  if (items.length <= 1) return items[0] || '';
  if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, ${conj} ${items[items.length - 1]}`;
}

function rankFor(xp) {
  let r = RANKS[0];
  for (const rank of RANKS) if (xp >= rank.min) r = rank;
  return r;
}
function nextRank(xp) {
  return RANKS.find(r => r.min > xp) || null;
}

function addXp(amount, reason) {
  state.xp += amount;
  saveProgress();
  updateHud();
  if (reason) toast(`+${amount} XP · ${reason}`);
}

function toast(msg) {
  const zone = $('#toast-zone');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  zone.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function diffDots(level) {
  let out = '<span class="diff-dots">';
  for (let i = 1; i <= 5; i++) out += `<span class="${i <= level ? 'on' : ''}"></span>`;
  return out + '</span>';
}

/* ---------- HUD ---------- */
function updateHud() {
  const rank = rankFor(state.xp);
  const nxt = nextRank(state.xp);
  $('#hud-xp').textContent = state.xp;
  $('#hud-collected').textContent = discoveredKnives();
  $('#hud-total').textContent = totalKnives();
  $('#hud-rank').textContent = `${rank.emoji} ${rank.name}`;

  let pct = 100;
  if (nxt) {
    const span = nxt.min - rank.min;
    pct = Math.min(100, Math.round(((state.xp - rank.min) / span) * 100));
  }
  $('#hud-xp-fill').style.width = pct + '%';
}

/* ---------- Profile view ---------- */
function renderProfile() {
  const current = rankFor(state.xp);
  const nxt = nextRank(state.xp);

  // Progress toward the next rank (mirrors the HUD bar).
  let pct = 100;
  let progressLabel = 'Top rank reached — the codex is yours. 🎉';
  if (nxt) {
    const span = nxt.min - current.min;
    pct = Math.min(100, Math.round(((state.xp - current.min) / span) * 100));
    progressLabel = `${nxt.min - state.xp} XP to ${nxt.emoji} ${nxt.name}`;
  }

  const total = totalKnives();
  const found = discoveredKnives();
  const steelTotal = state.steels.length;
  const steelFound = state.steelsRead.size;
  const d = state.dojo;
  const accuracy = d.answered ? Math.round((d.correct / d.answered) * 100) : 0;
  const achCount = state.achievements.size;
  const achTotal = (CD.achievements || []).length;
  const rankIndex = RANKS.indexOf(current) + 1;

  const profile = $('#profile');
  if (profile) profile.innerHTML = `
    <div class="profile-rank">
      <span class="profile-rank-em">${current.emoji}</span>
      <div class="profile-rank-text">
        <div class="profile-rank-name">${current.name} <span class="profile-lvl">· Level ${rankIndex}</span></div>
        <div class="profile-xp">${state.xp} XP earned</div>
      </div>
    </div>
    <div class="profile-progress">
      <div class="profile-progress-track"><i style="width:${pct}%"></i></div>
      <div class="profile-progress-label">${progressLabel}</div>
    </div>
    <div class="profile-stats">
      <div class="pstat"><div class="pstat-value">${found}<span class="pstat-sub">/${total}</span></div><div class="pstat-label">Knives Found</div></div>
      <div class="pstat"><div class="pstat-value">${steelFound}<span class="pstat-sub">/${steelTotal}</span></div><div class="pstat-label">Steels Studied</div></div>
      <div class="pstat"><div class="pstat-value">${accuracy}<span class="pstat-sub">%</span></div><div class="pstat-label">Dojo Accuracy</div></div>
      <div class="pstat"><div class="pstat-value">${d.rounds}</div><div class="pstat-label">Dojo Rounds</div></div>
      <div class="pstat"><div class="pstat-value">${state.daily.streak || 0}<span class="pstat-sub"> 🔥</span></div><div class="pstat-label">Daily Streak</div></div>
      <div class="pstat"><div class="pstat-value">${d.best}</div><div class="pstat-label">Best Round</div></div>
      <div class="pstat"><div class="pstat-value">${d.bestStreak}<span class="pstat-sub"> 🔥</span></div><div class="pstat-label">Best Streak</div></div>
      <div class="pstat"><div class="pstat-value">${d.perfect}</div><div class="pstat-label">Perfect Runs</div></div>
      <div class="pstat"><div class="pstat-value">${achCount}<span class="pstat-sub">/${achTotal}</span></div><div class="pstat-label">Achievements</div></div>
    </div>`;

  const rn = $('#ranks-next');
  if (rn) rn.innerHTML = nxt
    ? `Next rank is <b>${nxt.emoji} ${nxt.name}</b> — <b>${nxt.min - state.xp}</b> XP to go.`
    : `You've reached the top rank — <b>${current.emoji} ${current.name}</b>. 🎉`;

  const rl = $('#ranks-list');
  if (rl) rl.innerHTML = RANKS.map(r => {
    const achieved = state.xp >= r.min;
    const isCurrent = r.name === current.name;
    const cls = ['rank-row', achieved ? 'achieved' : '', isCurrent ? 'current' : ''].join(' ').trim();
    return `
      <div class="${cls}">
        <span class="rank-em">${r.emoji}</span>
        <span class="rank-name">${r.name}</span>
        <span class="rank-min">${r.min} XP</span>
        ${isCurrent ? '<span class="rank-tag">You</span>' : (achieved ? '<span class="rank-check">✓</span>' : '')}
      </div>`;
  }).join('');

  renderAchievements();
  renderRoll();
}

/* ---------- Codex ---------- */
function renderFilters() {
  const rarities = ['all', ...new Set(state.knives.map(k => k.rarity))];
  const box = $('#filters');
  box.innerHTML = rarities.map(r => {
    const label = r === 'all' ? 'All Knives' : RARITY_LABEL[r] || r;
    return `<button class="chip ${r === state.filter ? 'active' : ''}" data-filter="${r}">${label}</button>`;
  }).join('');
  $$('.chip', box).forEach(chip => {
    chip.addEventListener('click', () => {
      state.filter = chip.dataset.filter;
      renderFilters();
      renderGrid();
    });
  });
}

function renderGrid() {
  const grid = $('#knife-grid');
  const q = state.search.trim().toLowerCase();
  let list = state.filter === 'all'
    ? state.knives
    : state.knives.filter(k => k.rarity === state.filter);
  if (q) list = list.filter(k => knifeSearchText(k).includes(q));

  if (!list.length) {
    grid.innerHTML = q
      ? `<p class="empty-state">No knives match <b>“${escapeHtml(state.search.trim())}”</b>. Try another term.</p>`
      : `<p class="empty-state">No knives in this filter.</p>`;
    return;
  }

  grid.innerHTML = list.map((k, i) => {
    const collected = state.collected.has(k.id);
    const color = `var(--rarity-${k.rarity})`;
    const locked = !collected && SPECIALIST_RARITIES.has(k.rarity);

    if (locked) {
      return `
      <article class="knife-card locked" data-id="${k.id}" style="animation-delay:${i * 55}ms" title="Undiscovered — tap to reveal">
        <span class="rarity-bar" style="background:${color}"></span>
        <div class="top">
          <span class="emoji">${k.emoji}</span>
          <span class="rarity-tag" style="background:${color}">${RARITY_LABEL[k.rarity]}</span>
        </div>
        <h4 class="locked-name">Undiscovered <span class="kanji">秘</span></h4>
        <div class="role">A specialist blade awaits</div>
        <p class="desc">Tap to inspect this blade and add it to your codex.</p>
        <div class="meta">
          <span class="lock-hint">🔒 Locked</span>
          <span>? ? ?</span>
        </div>
      </article>`;
    }

    return `
      <article class="knife-card ${collected ? 'collected' : ''}" data-id="${k.id}" style="animation-delay:${i * 55}ms">
        <span class="rarity-bar" style="background:${color}"></span>
        <div class="top">
          <span class="emoji">${k.emoji}</span>
          <span class="rarity-tag" style="background:${color}">${RARITY_LABEL[k.rarity]}</span>
        </div>
        <h4>${k.name} <span class="kanji">${k.kanji}</span></h4>
        <div class="role">${k.role}</div>
        <p class="desc">${k.purpose}</p>
        <div class="meta">
          <span>${diffDots(k.difficulty)}</span>
          <span class="collected-flag">✓ Collected</span>
          <span>${k.bladeLength}</span>
        </div>
      </article>`;
  }).join('');

  $$('.knife-card', grid).forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

/* ---------- Compare table ---------- */
function renderCompare() {
  $('#compare-body').innerHTML = state.knives.map(k => `
    <tr data-id="${k.id}">
      <td class="name-cell"><span class="em">${k.emoji}</span>${k.name}</td>
      <td>${k.bestFor[0]}</td>
      <td>${k.bladeLength}</td>
      <td><span class="pill">${k.edge}</span></td>
      <td>${diffDots(k.difficulty)}</td>
    </tr>`).join('');
  $$('#compare-body tr').forEach(row => {
    row.addEventListener('click', () => openModal(row.dataset.id));
  });
}

/* ---------- Whetstone compare table ---------- */
function renderStoneCompare() {
  const body = $('#stone-compare-body');
  if (!body) return;
  body.innerHTML = state.stones.map(s => `
    <tr data-id="${s.id}">
      <td class="name-cell"><span class="em">${s.emoji}</span>${s.name}</td>
      <td><span class="pill">${s.grit}</span></td>
      <td>${s.bestFor[0]}</td>
      <td>${s.stage}</td>
      <td>${diffDots(s.fineness)}</td>
    </tr>`).join('');
  $$('#stone-compare-body tr').forEach(row => {
    row.addEventListener('click', () => openStoneModal(row.dataset.id));
  });
}

/* ---------- Modal ---------- */
/* Show or hide the knife-only detail blocks (techniques, geometry, steels,
   care, history, similar). Stones reuse the same modal without these. */
function setKnifeOnly(visible) {
  $$('.knife-only').forEach(el => { el.style.display = visible ? '' : 'none'; });
}

/* Reveal every shared detail block. A Greater Codex (library) knife hides most
   of them; call this first in every open* function to restore a clean slate. */
function showAllBlocks() {
  $$('#modal-back .modal-body > .detail-block').forEach(b => { b.style.display = ''; });
}

/* A chip linking to a related knife. Undiscovered specialists stay hidden as
   a locked chip until inspected, but can still be tapped to reveal them. */
function similarChip(id) {
  const k = state.byId[id];
  if (!k) return '';
  const hidden = !state.collected.has(id) && SPECIALIST_RARITIES.has(k.rarity);
  if (hidden) {
    return `<button class="similar-chip locked" data-jump="${id}" title="Undiscovered">
      <span class="em">🔒</span><span>? ? ?</span></button>`;
  }
  return `<button class="similar-chip" data-jump="${id}">
    <span class="em">${k.emoji}</span><span>${k.name}</span></button>`;
}

function openModal(id) {
  const k = state.byId[id];
  if (!k) return;

  const isNew = !state.collected.has(id);

  showAllBlocks();
  setKnifeOnly(true);
  $('#m-best-title').textContent = 'Best Uses';
  $('#m-specs-title').textContent = 'Specs';

  $('#m-emoji').textContent = k.emoji;
  $('#m-name').innerHTML = `${k.name} <span class="kanji">${k.kanji}</span>`;
  $('#m-role').textContent = k.role;
  $('#m-trans').textContent = `“${k.translation}” · ${RARITY_LABEL[k.rarity]}`;
  $('#m-purpose').textContent = k.purpose;

  $('#m-stats').innerHTML = Object.entries(k.stats).map(([key, val]) => `
    <div class="stat-row">
      <div class="s-label"><span>${key}</span><span>${val}/10</span></div>
      <div class="s-bar"><i style="width:0%" data-w="${val * 10}"></i></div>
    </div>`).join('');

  $('#m-best').innerHTML = k.bestFor.map(t => `<span class="tag">${t}</span>`).join('');
  $('#m-techniques').innerHTML = (k.techniques || []).map(t => `<span class="tag">${t}</span>`).join('');
  $('#m-avoid').innerHTML = k.avoid.map(t => `<span class="tag">${t}</span>`).join('');

  $('#m-specs').innerHTML = `
    <div class="spec-row"><span class="k">Typical size</span><span class="v">${k.bladeLength}</span></div>
    <div class="spec-row"><span class="k">Edge type</span><span class="v">${k.edge}</span></div>
    <div class="spec-row"><span class="k">Profile</span><span class="v">${k.profile}</span></div>
    <div class="spec-row"><span class="k">Difficulty</span><span class="v">${diffDots(k.difficulty)}</span></div>`;

  $('#m-geometry').textContent = k.geometry || '';
  $('#m-steels').innerHTML = (k.steels || []).map(s => `<span class="tag">${s}</span>`).join('');
  $('#m-care').innerHTML = (k.care || []).map(c => `<li>${c}</li>`).join('');
  $('#m-history').textContent = k.history || '';

  const similar = (k.similar || []).map(similarChip).filter(Boolean).join('');
  $('#m-similar').innerHTML = similar;
  $('#block-similar').style.display = similar ? '' : 'none';
  $$('#m-similar .similar-chip').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.jump));
  });

  $('#m-tip').textContent = k.tip;

  // Restore the shared "Not Ideal For" block (steel view hides it).
  $('#m-avoid').closest('.detail-block').style.display = '';

  // My Knife Roll ownership controls.
  state.modalId = id;
  state.modalKind = 'knife';
  bindOwnership(id);

  // Discovery flourish only on a knife's first inspection.
  const modal = $('#modal-back .modal');
  modal.classList.toggle('discovered', isNew);
  $('#m-discovery').style.display = isNew ? '' : 'none';

  $('#modal-back').classList.add('open');
  document.body.style.overflow = 'hidden';

  // animate stat bars
  requestAnimationFrame(() => {
    $$('#m-stats .s-bar i').forEach(bar => { bar.style.width = bar.dataset.w + '%'; });
  });

  // first discovery reward
  if (isNew) {
    state.collected.add(id);
    noteDiscovery(k.emoji, k.name);
    saveProgress();
    addXp(15, `Discovered the ${k.name}`);
    renderGrid();
    renderLibrary();
    checkAchievements();
    renderDashboard();
    maybeCollectionComplete();
  }
}

function closeModal() {
  $('#modal-back').classList.remove('open');
  document.body.style.overflow = '';
}

/* Opens the shared detail modal for a whetstone grit tier. Reuses the knife
   modal layout but with stone-specific fields (no collection reward). */
function openStoneModal(id) {
  const s = state.stoneById[id];
  if (!s) return;

  showAllBlocks();
  setKnifeOnly(false);
  $('#m-discovery').style.display = 'none';
  $('#modal-back .modal').classList.remove('discovered');
  $('#m-best-title').textContent = 'Best For';
  $('#m-specs-title').textContent = 'Specs';

  $('#m-emoji').textContent = s.emoji;
  $('#m-name').innerHTML = `${s.name} <span class="kanji">${s.kanji}</span>`;
  $('#m-role').textContent = s.role;
  $('#m-trans').textContent = `“${s.translation}” · Grit ${s.grit}`;
  $('#m-purpose').textContent = s.purpose;

  $('#m-stats').innerHTML = Object.entries(s.stats).map(([key, val]) => `
    <div class="stat-row">
      <div class="s-label"><span>${key}</span><span>${val}/10</span></div>
      <div class="s-bar"><i style="width:0%" data-w="${val * 10}"></i></div>
    </div>`).join('');

  $('#m-best').innerHTML = s.bestFor.map(t => `<span class="tag">${t}</span>`).join('');
  $('#m-avoid').innerHTML = s.avoid.map(t => `<span class="tag">${t}</span>`).join('');
  // A steel view may have hidden the shared avoid block — restore it.
  $('#m-avoid').closest('.detail-block').style.display = '';

  $('#m-specs').innerHTML = `
    <div class="spec-row"><span class="k">Grit range</span><span class="v">${s.grit}</span></div>
    <div class="spec-row"><span class="k">Tier</span><span class="v">${s.tier}</span></div>
    <div class="spec-row"><span class="k">Stage</span><span class="v">${s.stage}</span></div>
    <div class="spec-row"><span class="k">Preparation</span><span class="v">${s.soak}</span></div>
    <div class="spec-row"><span class="k">Fineness</span><span class="v">${diffDots(s.fineness)}</span></div>`;

  $('#m-tip').textContent = s.tip;

  $('#modal-back').classList.add('open');
  document.body.style.overflow = 'hidden';

  state.modalId = id;
  state.modalKind = 'stone';

  requestAnimationFrame(() => {
    $$('#m-stats .s-bar i').forEach(bar => { bar.style.width = bar.dataset.w + '%'; });
  });

  // first-read reward for studying a whetstone tier
  if (!state.readStones.has(id)) {
    state.readStones.add(id);
    saveProgress();
    addXp(10, `Studied the ${s.name} stone`);
  }
}

/* ---------- Dojo / Quiz ---------- */
const DOJO_MODES = [
  { id: 'all',        label: 'All' },
  { id: 'knife',      label: '🔪 Knives' },
  { id: 'steel',      label: '🔩 Steel' },
  { id: 'sharpening', label: '🪨 Sharpening' },
  { id: 'care',       label: '🧼 Care' }
];

/* Questions available for a given training focus. */
function poolForMode(mode) {
  return state.quiz.filter(q => mode === 'all' || quizCategory(q) === mode);
}

function startQuiz() {
  const mode = state.dojoMode || 'all';
  const modePool = poolForMode(mode);

  // Only draw questions not seen in previous rounds of this focus.
  let unseen = modePool.filter(q => !state.seenQuiz.has(q.scenario));
  // Once every question in the focus has been seen, reset just that focus.
  if (unseen.length === 0) {
    modePool.forEach(q => state.seenQuiz.delete(q.scenario));
    unseen = modePool.slice();
  }
  const pool = shuffle(unseen).slice(0, Math.min(QUIZ_LENGTH, unseen.length));
  state.round = pool.map(q => ({ ...q, options: shuffle(q.options) }));
  pool.forEach(q => state.seenQuiz.add(q.scenario));
  saveProgress();

  state.quizIndex = 0;
  state.quizScore = 0;
  state.curStreak = 0;
  state.quizActive = true;
  state.quizIsDaily = false;
  renderQuestion();
  $('#dojo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ---------- Daily Dojo ----------
   Five questions, deterministic per calendar day (a date-seeded shuffle so the
   same five appear all day). Completing all five keeps a daily streak alive. */
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function dateSeed(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h;
}
function dailyQuestions() {
  const key = todayKey();
  return seededShuffle(state.quiz, dateSeed(key)).slice(0, DAILY_LENGTH);
}

function renderDaily() {
  const box = $('#daily-dojo');
  if (!box) return;
  const today = todayKey();
  const doneToday = state.daily.done && state.daily.date === today;
  const streak = state.daily.streak || 0;

  if (doneToday) {
    box.innerHTML = `
      <div class="daily-done">
        <div class="daily-check">✓</div>
        <div>
          <h4>Today's Daily Dojo is complete</h4>
          <p>You scored <b>${state.daily.score}</b> / ${DAILY_LENGTH}. Come back tomorrow to extend your streak.</p>
        </div>
        <div class="daily-streak" title="Current streak">🔥 ${streak}</div>
      </div>`;
    return;
  }

  box.innerHTML = `
    <div class="daily-open">
      <div class="daily-streak" title="Current streak">🔥 ${streak}</div>
      <div class="daily-copy">
        <h4>Five questions. One a day.</h4>
        <p>Finish all ${DAILY_LENGTH} to earn a <b>+${DAILY_BONUS} XP</b> bonus and keep your streak alive.</p>
      </div>
      <button class="btn" id="daily-start">Start Daily Dojo</button>
    </div>`;
  $('#daily-start').addEventListener('click', startDaily);
}

function startDaily() {
  const pool = dailyQuestions();
  state.round = pool.map(q => ({ ...q, options: shuffle(q.options) }));
  state.quizIndex = 0;
  state.quizScore = 0;
  state.curStreak = 0;
  state.quizActive = true;
  state.quizIsDaily = true;
  renderQuestion();
  $('#dojo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* A subtle "on a roll" badge shown once two answers land in a row. */
function streakBadge() {
  return state.curStreak >= 2 ? ` <span class="quiz-streak">· 🔥 ${state.curStreak}</span>` : '';
}

/* A short educational takeaway shown after every answer. */
function explainQuestion(q) {
  if (q.why) return q.why;
  const cat = quizCategory(q);
  const correct = acceptedAnswers(q)[0];
  if (cat === 'knife') {
    const k = state.byId[correct];
    if (k) return k.tip || k.purpose;
  }
  return `Remember: ${optionMeta(correct).label}.`;
}

function renderQuestion() {
  const stage = $('#quiz-stage');
  const total = state.round.length;
  const q = state.round[state.quizIndex];

  const segs = state.round.map((_, i) => {
    let cls = '';
    if (i < state.quizIndex) cls = 'done';
    else if (i === state.quizIndex) cls = 'current';
    return `<span class="seg ${cls}"></span>`;
  }).join('');

  const options = q.options.map((opt, i) => {
    const meta = optionMeta(opt);
    const isCorrect = acceptedAnswers(q).includes(opt);
    return `<button class="answer-btn" data-idx="${i}" data-correct="${isCorrect}">
      <span class="em">${meta.emoji}</span><span>${meta.label}</span>
    </button>`;
  }).join('');

  stage.innerHTML = `
    <div class="quiz-progress">${segs}</div>
    <div class="scenario-card">
      <div class="q-index">Task ${state.quizIndex + 1} of ${total}</div>
      <div class="q-text">${q.scenario}</div>
    </div>
    <div class="answers" id="answers">${options}</div>
    <div class="quiz-feedback" id="quiz-feedback"></div>
    <div class="quiz-foot">
      <span class="quiz-score">Score: <b>${state.quizScore}</b> / ${total}${streakBadge()}</span>
      <button class="btn ghost small" id="quiz-skip">Skip</button>
    </div>`;

  $$('#answers .answer-btn').forEach(btn => {
    btn.addEventListener('click', () => answerQuestion(btn));
  });
  $('#quiz-skip').addEventListener('click', nextQuestion);
}

function answerQuestion(chosenBtn) {
  const q = state.round[state.quizIndex];
  const accepted = acceptedAnswers(q);
  const buttons = $$('#answers .answer-btn');
  buttons.forEach(b => { b.disabled = true; });

  const isCorrect = chosenBtn.dataset.correct === 'true';
  const feedback = $('#quiz-feedback');

  // Track lifetime Dojo accuracy and the correct-answer streak.
  state.dojo.answered++;
  if (isCorrect) {
    state.dojo.correct++;
    state.curStreak++;
    if (state.curStreak > state.dojo.bestStreak) state.dojo.bestStreak = state.curStreak;
  } else {
    state.curStreak = 0;
  }
  saveProgress();

  // Reveal every acceptable answer in green.
  buttons.forEach(b => { if (b.dataset.correct === 'true') b.classList.add('correct'); });

  const correctLabels = accepted.map(a => optionMeta(a).label);
  const explanation = explainQuestion(q);

  let head;
  if (isCorrect) {
    state.quizScore++;
    head = accepted.length > 1
      ? `✓ Correct — ${formatList(correctLabels, 'and')} all work here.`
      : `✓ Correct — ${correctLabels[0]} is the right answer.`;
    addXp(9, 'Correct answer');
  } else {
    chosenBtn.classList.add('wrong');
    head = accepted.length > 1
      ? `✗ Any of ${formatList(correctLabels, 'or')} works here.`
      : `✗ The right answer is ${correctLabels[0]}.`;
  }
  feedback.className = 'quiz-feedback' + (isCorrect ? '' : ' miss');
  feedback.innerHTML =
    `<span class="qf-head">${escapeHtml(head)}</span>` +
    `<span class="qf-why">💡 ${escapeHtml(explanation)}</span>`;

  const foot = $('.quiz-foot');
  const isLast = state.quizIndex === state.round.length - 1;
  foot.innerHTML = `
    <span class="quiz-score">Score: <b>${state.quizScore}</b> / ${state.round.length}${streakBadge()}</span>
    <button class="btn small" id="quiz-next">${isLast ? 'See Result' : 'Next Task'}</button>`;
  $('#quiz-next').addEventListener('click', nextQuestion);
}

function nextQuestion() {
  if (state.quizIndex < state.round.length - 1) {
    state.quizIndex++;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  state.quizActive = false;
  const total = state.round.length;
  const score = state.quizScore;
  const pct = total ? score / total : 0;
  const isDaily = state.quizIsDaily;

  // Record the round in lifetime Dojo statistics.
  state.dojo.rounds++;
  if (score > state.dojo.best) state.dojo.best = score;
  if (pct === 1) state.dojo.perfect++;

  let bonusNote = '';
  if (isDaily) {
    // Mark today's Daily Dojo complete and update the streak.
    const today = todayKey();
    state.daily.date = today;
    state.daily.score = score;
    if (!state.daily.done) {
      state.daily.done = true;
      // Continue the streak if yesterday was completed, otherwise restart.
      state.daily.streak = (state.daily.lastDate === yesterdayKey())
        ? (state.daily.streak || 0) + 1
        : 1;
      state.daily.lastDate = today;
      addXp(DAILY_BONUS, 'Daily Dojo complete');
      bonusNote = `<br />+${DAILY_BONUS} XP daily bonus · 🔥 ${state.daily.streak}-day streak`;
    }
  }
  if (pct === 1) addXp(12, 'Perfect round');
  saveProgress();
  checkAchievements();

  let title, emoji, note;
  if (pct === 1) { title = 'Flawless — Itamae!'; emoji = '🏯'; note = 'A perfect run.'; }
  else if (pct >= 0.75) { title = 'Sharp instincts.'; emoji = '🍣'; note = 'A confident grasp of the codex.'; }
  else if (pct >= 0.5) { title = 'Coming along.'; emoji = '🔪'; note = 'Solid basics — a little more practice.'; }
  else { title = 'Keep training.'; emoji = '🌱'; note = 'Revisit the codex and try again.'; }

  const modeLabel = isDaily
    ? 'the Daily Dojo'
    : (DOJO_MODES.find(m => m.id === (state.dojoMode || 'all')) || DOJO_MODES[0]).label;

  $('#quiz-stage').innerHTML = `
    <div class="quiz-result">
      <div class="rank-emoji">${emoji}</div>
      <h4>${title}</h4>
      <p>${note}<br />You scored <b>${score}</b> of <b>${total}</b> in <b>${modeLabel}</b>.${bonusNote}</p>
      <div class="quiz-result-actions">
        <button class="btn" id="quiz-restart">Train Again</button>
        <button class="btn ghost" id="quiz-change">Change Focus</button>
      </div>
    </div>`;
  $('#quiz-restart').addEventListener('click', startQuiz);
  $('#quiz-change').addEventListener('click', renderDojoIntro);

  renderDaily();
  renderDashboard();
}

function renderDojoIntro() {
  const mode = state.dojoMode || 'all';
  const modes = DOJO_MODES.map(m => {
    const count = poolForMode(m.id).length;
    return `<button class="dojo-mode-chip ${m.id === mode ? 'active' : ''}" data-mode="${m.id}">${m.label}<span class="m-count">${count}</span></button>`;
  }).join('');
  const focusNote = mode === 'knives' ? 'matching knives to the right task'
    : mode === 'stones' ? 'whetstone grits and sharpening stages'
    : mode === 'care' ? 'stropping, storage, and knife care'
    : 'knives, whetstone grits, strops, and knife care';

  $('#quiz-stage').innerHTML = `
    <div class="quiz-result">
      <div class="rank-emoji">🥢</div>
      <h4>Ready to test your eye?</h4>
      <p>Choose a focus, then take on up to ${QUIZ_LENGTH} tasks on ${focusNote}. Answers earn XP and rank you up.</p>
      <div class="dojo-modes" id="dojo-modes">${modes}</div>
      <button class="btn" id="quiz-begin">Begin Training</button>
    </div>`;

  $$('#dojo-modes .dojo-mode-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.dojoMode = chip.dataset.mode;
      saveProgress();
      renderDojoIntro();
    });
  });
  $('#quiz-begin').addEventListener('click', startQuiz);
}

/* ---------- The Greater Codex (library) ----------
   A reference archive of the wider Japanese knife world, grouped by the
   job each family is built for. Rendered as native <details> accordions so
   each family can be expanded on demand. Types already featured in the
   Codex above are tagged so the two views connect. */
const LIBRARY = [
  {
    title: 'The All-Rounders',
    kanji: '万能',
    emoji: '🔪',
    blurb: 'Do-everything blades built for meat, fish and vegetables alike — the backbone of most kitchens.',
    items: [
      { name: 'Gyuto', kanji: '牛刀', jp: 'Cow Sword', note: 'The Western chef\'s knife reimagined in Japan. A curved belly and fine tip make it the ultimate do-everything blade.' },
      { name: 'Santoku', kanji: '三徳', jp: 'Three Virtues', note: 'Meat, fish and vegetables in one compact, flat-profiled home knife made for clean push-cuts.' },
      { name: 'Bunka', kanji: '文化', jp: 'Culture', note: 'A stylish all-rounder crowned with a reverse-tanto K-tip for precise scoring and detail work.' },
      { name: 'Kiritsuke', kanji: '切付', jp: 'To Cut and Mark', note: 'The angular hybrid of slicer and vegetable knife — traditionally single-bevelled and carried as a head chef\'s badge of rank.' },
      { name: 'Kiritsuke Gyuto', kanji: '切付牛刀', jp: 'Kiritsuke-Tipped Cow Sword', note: 'A double-bevel gyuto wearing the sword-like kiritsuke tip: everyday versatility with a dramatic point.' },
      { name: 'Kengata', kanji: '剣型', jp: 'Sword Shape', note: 'A gyuto or santoku reshaped with a bold, pointed reverse-tanto tip for extra control at the point.' },
      { name: 'Funayuki', kanji: '舟行', jp: 'Going Aboard', note: 'The fisherman\'s all-purpose knife: a slim, deba-like blade thin enough to handle both fish and vegetables at sea.' }
    ]
  },
  {
    title: 'The Vegetable Blades',
    kanji: '野菜',
    emoji: '🥬',
    blurb: 'Straight, flat edges tuned for clean, single-motion cuts through produce.',
    items: [
      { name: 'Nakiri', kanji: '菜切', jp: 'Vegetable Cutter', note: 'A straight, rectangular double-bevel blade that drops clean through vegetables in a single push.' },
      { name: 'Usuba', kanji: '薄刃', jp: 'Thin Blade', note: 'The professional\'s single-bevel vegetable knife, prized for paper-thin katsuramuki peeling.' },
      { name: 'Kamagata Usuba', kanji: '鎌形薄刃', jp: 'Sickle-Shaped Thin Blade', note: 'The Kansai-region usuba, its pointed sickle tip adding fine detail work to the flat edge.' },
      { name: 'Mukimono', kanji: '剥き物', jp: 'Decorative Peeling', note: 'A slender knife made for carving elaborate vegetable garnishes and edible decorations.' },
      { name: 'Kawamuki', kanji: '皮剥き', jp: 'Peeling', note: 'A small, nimble blade dedicated to peeling the skin from fruit and vegetables.' },
      { name: 'Negikiri', kanji: '葱切', jp: 'Scallion Cutter', note: 'A specialist for shaving green onions and leeks into fine, feathery strands.' }
    ]
  },
  {
    title: 'Small & Utility',
    kanji: '小型',
    emoji: '🍓',
    blurb: 'Nimble, short blades for in-hand work and jobs too fine for a full-size knife.',
    items: [
      { name: 'Petty', kanji: 'ペティ', jp: 'Petite', note: 'The nimble sidekick for peeling, trimming and detail too fine for a full-size blade.' },
      { name: 'Ko-Bunka', kanji: '小文化', jp: 'Small Bunka', note: 'A pocket-sized bunka: the K-tip precision of its big sibling in a petty-length blade.' },
      { name: 'Ko-Santoku', kanji: '小三徳', jp: 'Small Santoku', note: 'A compact three-virtue knife, ideal for smaller hands and lighter prep.' },
      { name: 'Ko-Gyuto', kanji: '小牛刀', jp: 'Small Cow Sword', note: 'A short chef\'s knife that bridges the gap between a petty and a full gyuto.' }
    ]
  },
  {
    title: 'Fish Butchery · the Deba Family',
    kanji: '出刃',
    emoji: '🐟',
    blurb: 'Thick, heavy single-bevel blades that fillet fish and chop through heads and small bones.',
    items: [
      { name: 'Deba', kanji: '出刃', jp: 'Pointed Carver', note: 'A thick, heavy single-bevel blade built to fillet fish and chop through heads and small bones.' },
      { name: 'Hon-Deba', kanji: '本出刃', jp: 'True Deba', note: 'The full-weight, standard deba — the benchmark of the family.' },
      { name: 'Ai-Deba', kanji: '相出刃', jp: 'Intermediate Deba', note: 'A lighter, thinner deba that trades brute weight for nimbler filleting.' },
      { name: 'Ko-Deba', kanji: '小出刃', jp: 'Small Deba', note: 'A pint-sized deba for breaking down small fish with control.' },
      { name: 'Mioroshi Deba', kanji: '身卸出刃', jp: 'Filleting Deba', note: 'Longer and slimmer than a hon-deba, it both butchers and slices in one blade.' },
      { name: 'Funayuki Deba', kanji: '舟行出刃', jp: 'Boat Deba', note: 'A deba-shaped funayuki: light enough for fine work, sturdy enough for small bones.' },
      { name: 'Ajikiri', kanji: '鯵切', jp: 'Horse-Mackerel Cutter', note: 'A tiny deba sized precisely for aji and other small fish.' }
    ]
  },
  {
    title: 'Sashimi Slicers · the Yanagiba Family',
    kanji: '刺身',
    emoji: '🍣',
    blurb: 'Long, single-bevel blades that render raw fish in one flawless pull-stroke.',
    items: [
      { name: 'Yanagiba', kanji: '柳刃', jp: 'Willow Blade', note: 'The long, single-bevel sashimi slicer that renders raw fish in one flawless pull-stroke.' },
      { name: 'Takohiki', kanji: '蛸引', jp: 'Octopus Puller', note: 'The Kanto-style slicer with a squared-off tip, favoured for octopus and sashimi.' },
      { name: 'Fuguhiki', kanji: '河豚引', jp: 'Pufferfish Puller', note: 'A thinner, more flexible yanagiba for slicing fugu translucently thin.' },
      { name: 'Sakimaru Takohiki', kanji: '先丸蛸引', jp: 'Round-Tipped Octopus Puller', note: 'A takohiki finished with an elegant rounded sword tip; a premium sashimi blade.' },
      { name: 'Kensaki Yanagiba', kanji: '剣先柳刃', jp: 'Sword-Tip Willow Blade', note: 'The Kansai yanagiba capped with a kiritsuke-style pointed tip.' }
    ]
  },
  {
    title: 'Great Fish & Regional Specialists',
    kanji: '専門',
    emoji: '🐡',
    blurb: 'Rare, often enormous blades built for a single fish, technique or region.',
    items: [
      { name: 'Magurokiri', kanji: '鮪切', jp: 'Tuna Cutter', note: 'A long blade for portioning large cuts of tuna.' },
      { name: 'Maguro Bocho', kanji: '鮪包丁', jp: 'Tuna Knife', note: 'An enormous, sometimes two-metre blade used to break down whole tuna at market.' },
      { name: 'Oroshi Hocho', kanji: '卸包丁', jp: 'Filleting Knife', note: 'A giant single-stroke slicer for filleting very large fish.' },
      { name: 'Hancho Hocho', kanji: '半丁包丁', jp: 'Half-Length Knife', note: 'A long tuna knife, shorter than the oroshi, for sectioning big fish.' },
      { name: 'Unagisaki', kanji: '鰻裂き', jp: 'Eel Splitter', note: 'A specialist for splitting and boning slippery eel — with a distinct style for each region.' },
      { name: 'Edo Unagisaki', kanji: '江戸鰻裂き', jp: 'Tokyo Eel Splitter', note: 'The Tokyo style: a squared, dagger-like point.' },
      { name: 'Osaka Unagisaki', kanji: '大阪鰻裂き', jp: 'Osaka Eel Splitter', note: 'The Kansai style, with a sickle-shaped blade.' },
      { name: 'Kyoto Unagisaki', kanji: '京都鰻裂き', jp: 'Kyoto Eel Splitter', note: 'The Kyoto style, slender with a fine point.' },
      { name: 'Nagoya Unagisaki', kanji: '名古屋鰻裂き', jp: 'Nagoya Eel Splitter', note: 'The Nagoya style, compact and broad.' },
      { name: 'Hamo-kiri', kanji: '鱧切', jp: 'Pike-Conger Cutter', note: 'A heavy, square blade for honekiri — scoring the many fine bones of pike conger.' },
      { name: 'Katsuo Hocho', kanji: '鰹包丁', jp: 'Bonito Knife', note: 'Shaped for cleanly slicing skipjack tuna and bonito.' },
      { name: 'Kujira Hocho', kanji: '鯨包丁', jp: 'Whale Knife', note: 'A historic long blade once used to portion whale meat.' },
      { name: 'Sakekiri', kanji: '鮭切', jp: 'Salmon Cutter', note: 'A long knife tuned for slicing whole salmon.' },
      { name: 'Kaniwari', kanji: '蟹割', jp: 'Crab Splitter', note: 'A sturdy tool for cracking and splitting crab shells.' }
    ]
  },
  {
    title: 'Meat, Poultry & Boning',
    kanji: '精肉',
    emoji: '🍖',
    blurb: 'Stiff boning knives and long carving blades for working with meat.',
    items: [
      { name: 'Honesuki', kanji: '骨スキ', jp: 'Bone Remover', note: 'A stiff, triangular knife for boning poultry around the joints.' },
      { name: 'Garasuki', kanji: 'ガラスキ', jp: 'Poultry Boner', note: 'A larger, heavier honesuki for breaking down whole birds.' },
      { name: 'Sujihiki', kanji: '筋引', jp: 'Sinew Slicer', note: 'The double-bevel carving knife for long, clean strokes through cooked and raw meat.' },
      { name: 'Chukabocho', kanji: '中華包丁', jp: 'Chinese Knife', note: 'The Japanese take on the Chinese cleaver, light enough for endless vegetable work.' },
      { name: 'Reito Hocho', kanji: '冷凍包丁', jp: 'Frozen Knife', note: 'A tough, often serrated blade made to saw through frozen foods.' }
    ]
  },
  {
    title: 'Noodles, Dough & Sweets',
    kanji: '製麺・菓子',
    emoji: '🍜',
    blurb: 'Tall, straight blades for slicing rolled dough, noodles and confections.',
    items: [
      { name: 'Menkiri', kanji: '麺切', jp: 'Noodle Cutter', note: 'A tall, straight blade that slices rolled dough into even noodles.' },
      { name: 'Sobakiri', kanji: '蕎麦切', jp: 'Soba Cutter', note: 'A heavy rectangular knife for cutting buckwheat soba by hand.' },
      { name: 'Udonkiri', kanji: '饂飩切', jp: 'Udon Cutter', note: 'A close cousin of the sobakiri, sized for thick udon.' },
      { name: 'Mochikiri', kanji: '餅切', jp: 'Mochi Cutter', note: 'Built to cut dense, sticky rice cakes cleanly.' },
      { name: 'Pankiri', kanji: 'パン切', jp: 'Bread Knife', note: 'The Japanese serrated bread knife.' },
      { name: 'Kashikiri', kanji: '菓子切', jp: 'Confection Cutter', note: 'A fine blade for slicing delicate wagashi and sweets.' }
    ]
  }
];

/* Build an index of every Greater Codex knife that isn't already one of the
   ten featured knives, giving each a stable id so it can be discovered. */
function buildLibraryIndex() {
  const codexByName = new Map(state.knives.map(k => [k.name.toLowerCase(), k.id]));
  state.libById = {};
  LIBRARY.forEach(g => {
    g.items.forEach(it => {
      const featuredId = codexByName.get(it.name.toLowerCase()) || null;
      it._featuredId = featuredId;
      it._family = g.title;
      it._emoji = g.emoji;
      if (featuredId) {
        it._id = featuredId;
      } else {
        const slug = 'lib-' + it.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        it._id = slug;
        state.libById[slug] = it;
      }
    });
  });
}

/* Total number of discoverable knives: the ten featured + every other blade
   in the Greater Codex. */
function totalKnives() {
  return state.knives.length + Object.keys(state.libById).length;
}
/* How many of those the user has discovered so far. */
function discoveredKnives() {
  return state.collected.size + state.libDiscovered.size;
}

/* Record the most recently discovered knife for the Home dashboard. */
function noteDiscovery(emoji, name) {
  state.recent = { emoji, name };
}

/* Fire the codex-complete toast once every knife has been discovered. */
function maybeCollectionComplete() {
  if (discoveredKnives() === totalKnives()) {
    setTimeout(() => toast('🏯 Codex complete — every knife discovered!'), 400);
  }
}

function renderLibrary() {
  const box = $('#library');
  if (!box) return;
  const codexNames = new Set(state.knives.map(k => k.name.toLowerCase()));
  const q = state.librarySearch.trim().toLowerCase();

  // Remember which folders are currently open so re-rendering after a
  // discovery keeps them expanded — makes it easy to click the next blade.
  const openGroups = new Set(
    $$('.lib-group[open]', box).map(g => g.dataset.lib)
  );

  // Filter families/items by the archive search. A family whose title matches
  // keeps all its blades; otherwise only matching blades are shown.
  const groups = LIBRARY.map(g => {
    const groupMatch = !q || [g.title, g.kanji, g.blurb].join(' ').toLowerCase().includes(q);
    const items = groupMatch
      ? g.items
      : g.items.filter(it => [it.name, it.kanji, it.jp, it.note].join(' ').toLowerCase().includes(q));
    return { g, items };
  }).filter(entry => entry.items.length > 0);

  if (!groups.length) {
    box.innerHTML = `<p class="empty-state">No blades in the archive match <b>“${escapeHtml(state.librarySearch.trim())}”</b>.</p>`;
    return;
  }

  box.innerHTML = groups.map(({ g, items }) => {
    const itemsHtml = items.map(it => {
      const inCodex = codexNames.has(it.name.toLowerCase());
      const found = it._featuredId
        ? state.collected.has(it._featuredId)
        : state.libDiscovered.has(it._id);

      if (!found) {
        // Undiscovered — mirror the locked cards of the Knife Codex.
        return `
        <button type="button" class="lib-item locked" data-lib-id="${it._id}" data-featured="${it._featuredId ? '1' : ''}" title="Undiscovered — tap to reveal">
          <div class="lib-item-head">
            <span class="lib-name lib-locked-name">Undiscovered <span class="lib-kanji">秘</span></span>
            <span class="lib-badge lib-lock">🔒</span>
          </div>
          <div class="lib-trans">? ? ?</div>
          <p class="lib-note">Tap to inspect this blade and add it to your codex.</p>
        </button>`;
      }

      return `
        <button type="button" class="lib-item found${inCodex ? ' in-codex' : ''}" data-lib-id="${it._id}" data-featured="${it._featuredId ? '1' : ''}">
          <div class="lib-item-head">
            <span class="lib-name">${it.name} <span class="lib-kanji">${it.kanji}</span></span>
            ${inCodex ? '<span class="lib-badge">★ In the Codex</span>'
              : '<span class="lib-badge lib-found">✓ Discovered</span>'}
          </div>
          <div class="lib-trans">${it.jp}</div>
          <p class="lib-note">${it.note}</p>
        </button>`;
    }).join('');

    // Expand families automatically while searching, and keep any folder that
    // was already open so discovering a blade doesn't collapse it.
    const open = q || openGroups.has(g.title);
    return `
      <details class="lib-group" data-lib="${g.title}"${open ? ' open' : ''}>
        <summary>
          <span class="lib-g-em">${g.emoji}</span>
          <span class="lib-g-text">
            <span class="lib-g-title">${g.title} <span class="lib-g-kanji">${g.kanji}</span></span>
            <span class="lib-g-blurb">${g.blurb}</span>
          </span>
          <span class="lib-g-count">${items.length}</span>
          <span class="lib-chev" aria-hidden="true">⌄</span>
        </summary>
        <div class="lib-items">${itemsHtml}</div>
      </details>`;
  }).join('');

  $$('.lib-group', box).forEach(group => {
    group.addEventListener('toggle', () => {
      if (!group.open) return;
      const key = group.dataset.lib;
      if (state.readLibrary.has(key)) return;
      state.readLibrary.add(key);
      saveProgress();
      addXp(12, 'Read the Greater Codex');
    });
  });

  $$('.lib-item', box).forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.libId;
      if (item.dataset.featured) openModal(id);
      else openLibraryModal(id);
    });
  });
}

/* ---------- View router ---------- */
const VIEWS = ['home', 'codex', 'dojo', 'learn', 'profile'];

/* Switch the active top-level view and lazily (re)render its dynamic content. */
function switchView(name) {
  if (!VIEWS.includes(name)) name = 'home';
  state.view = name;

  $$('.view').forEach(v => {
    const on = v.dataset.view === name;
    v.hidden = !on;
    v.classList.toggle('is-active', on);
  });
  $$('.navlink').forEach(b => {
    const on = b.dataset.nav === name;
    b.classList.toggle('is-active', on);
    if (on) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });

  if (name === 'home') renderDashboard();
  if (name === 'codex') renderSteelGrid();
  if (name === 'dojo') renderDaily();
  if (name === 'learn') { renderWizard(); renderFixit(); renderAnatomy(); renderVs(); }
  if (name === 'profile') renderProfile();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function wireNav() {
  $$('.navlink').forEach(b => b.addEventListener('click', () => switchView(b.dataset.nav)));
}

/* ---------- Achievements ---------- */
/* Snapshot of the numbers each achievement's check() is evaluated against. */
function achContext() {
  return {
    knivesFound: discoveredKnives(),
    knivesTotal: totalKnives(),
    steelsFound: state.steelsRead.size,
    steelsTotal: state.steels.length,
    dojoRounds: state.dojo.rounds,
    perfectRuns: state.dojo.perfect,
    dailyStreak: state.daily.streak || 0
  };
}

/* Evaluate every achievement; unlock, persist and announce any newly earned. */
function checkAchievements() {
  const ctx = achContext();
  let unlocked = false;
  (CD.achievements || []).forEach(a => {
    if (!state.achievements.has(a.id) && typeof a.check === 'function' && a.check(ctx)) {
      state.achievements.add(a.id);
      unlocked = true;
      achToast(a);
    }
  });
  if (unlocked) {
    saveProgress();
    renderAchievements();
  }
}

/* A subtle, self-dismissing unlock notification. */
function achToast(a) {
  const zone = $('#ach-zone');
  if (!zone) return;
  const el = document.createElement('div');
  el.className = 'ach-toast';
  el.innerHTML =
    `<span class="ach-toast-ic">${a.icon}</span>` +
    `<span class="ach-toast-tx"><b>Achievement unlocked</b>${escapeHtml(a.title)}</span>`;
  zone.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 400);
  }, 4200);
}

function renderAchievements() {
  const box = $('#achievements');
  if (!box) return;
  box.innerHTML = (CD.achievements || []).map(a => {
    const got = state.achievements.has(a.id);
    return `
      <div class="ach ${got ? 'got' : 'locked'}">
        <span class="ach-ic">${got ? a.icon : '🔒'}</span>
        <div class="ach-tx">
          <div class="ach-title">${got ? escapeHtml(a.title) : 'Locked'}</div>
          <div class="ach-desc">${escapeHtml(a.desc)}</div>
        </div>
        ${got ? '<span class="ach-flag">✓</span>' : ''}
      </div>`;
  }).join('');
}

/* ---------- Steel Codex ---------- */
const STEEL_RATING_LABELS = {
  edgeRetention: 'Edge Retention',
  toughness: 'Toughness',
  sharpening: 'Ease of Sharpening',
  corrosion: 'Corrosion Resistance'
};

/* A compact 1–5 dot rating for the steel cards. */
function miniRating(label, val) {
  let dots = '';
  for (let i = 1; i <= 5; i++) dots += `<i class="${i <= val ? 'on' : ''}"></i>`;
  return `<div class="mini-rating"><span>${label}</span><div class="mini-dots">${dots}</div></div>`;
}

/* Animated 1–5 bars used inside the steel detail modal. */
function steelRatingRows(r) {
  return Object.entries(STEEL_RATING_LABELS).map(([key, label]) => {
    const val = r[key] || 0;
    return `
      <div class="stat-row">
        <div class="s-label"><span>${label}</span><span>${val}/5</span></div>
        <div class="s-bar"><i style="width:0%" data-w="${(val / 5) * 100}"></i></div>
      </div>`;
  }).join('');
}

function renderSteelGrid() {
  const grid = $('#steel-grid');
  if (!grid) return;
  const q = state.steelSearch.trim().toLowerCase();
  let list = state.steels;
  if (q) list = list.filter(s => `${s.name} ${s.jp} ${s.type} ${s.summary}`.toLowerCase().includes(q));

  if (!list.length) {
    grid.innerHTML = `<p class="empty-state">No steels match <b>“${escapeHtml(state.steelSearch.trim())}”</b>.</p>`;
    return;
  }

  grid.innerHTML = list.map((s, i) => {
    const studied = state.steelsRead.has(s.id);
    return `
      <article class="steel-card ${studied ? 'studied' : ''}" data-id="${s.id}" style="animation-delay:${i * 45}ms">
        <div class="steel-top">
          <span class="steel-em">${s.emoji}</span>
          <span class="steel-type ${s.reactive ? 'reactive' : 'stainless'}">${s.reactive ? 'Reactive' : 'Stainless'}</span>
        </div>
        <h4 class="steel-name">${s.name}</h4>
        <div class="steel-jp">${s.jp} · HRC ${s.hrc}</div>
        <p class="steel-sum">${escapeHtml(s.summary)}</p>
        <div class="steel-mini">
          ${miniRating('Edge', s.ratings.edgeRetention)}
          ${miniRating('Tough', s.ratings.toughness)}
          ${miniRating('Sharpen', s.ratings.sharpening)}
          ${miniRating('Rust✕', s.ratings.corrosion)}
        </div>
        ${studied ? '<span class="steel-check">✓ Studied</span>' : ''}
      </article>`;
  }).join('');

  $$('.steel-card', grid).forEach(c => c.addEventListener('click', () => openSteelModal(c.dataset.id)));
}

/* Reuse the shared detail modal to present a steel entry. */
function openSteelModal(id) {
  const st = state.steelById[id];
  if (!st) return;

  showAllBlocks();
  setKnifeOnly(false);
  $('#m-discovery').style.display = 'none';
  $('#modal-back .modal').classList.remove('discovered');
  // Steels have no "Not Ideal For" list — hide that shared block.
  $('#m-avoid').closest('.detail-block').style.display = 'none';

  $('#m-emoji').textContent = st.emoji;
  $('#m-name').innerHTML = `${st.name} <span class="kanji">${st.jp}</span>`;
  $('#m-role').textContent = st.type + (st.reactive ? ' · reactive carbon' : ' · low-maintenance');
  $('#m-trans').textContent = `HRC ${st.hrc}`;
  $('#m-purpose').textContent = st.summary;

  $('#m-stats').innerHTML = steelRatingRows(st.ratings);

  $('#m-best-title').textContent = 'Best For';
  $('#m-best').innerHTML = (st.bestFor || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');

  $('#m-specs-title').textContent = 'Characteristics';
  $('#m-specs').innerHTML = `<p class="d-text">${escapeHtml(st.characteristics)}</p>`;

  $('#m-tip').textContent = st.reactive
    ? 'Reactive steel — dry it promptly and wipe with a little camellia oil.'
    : 'Stainless steel — easy to live with; just skip the dishwasher.';

  state.modalId = id;
  state.modalKind = 'steel';

  $('#modal-back').classList.add('open');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    $$('#m-stats .s-bar i').forEach(bar => { bar.style.width = bar.dataset.w + '%'; });
  });

  if (!state.steelsRead.has(id)) {
    state.steelsRead.add(id);
    saveProgress();
    addXp(10, `Studied ${st.name}`);
    renderSteelGrid();
    checkAchievements();
    renderDashboard();
  }
}

/* Opens the shared detail modal for a Greater Codex (library-only) knife.
   These entries carry a single descriptive note rather than full stats, so the
   stats / best / avoid / specs blocks are hidden. First inspection discovers
   the blade and counts it toward the collection. */
function openLibraryModal(id) {
  const it = state.libById[id];
  if (!it) return;

  const isNew = !state.libDiscovered.has(id);

  showAllBlocks();
  setKnifeOnly(false);
  // Library entries only have a note — hide the data-driven blocks.
  ['#m-stats', '#m-best', '#m-avoid', '#m-specs'].forEach(sel => {
    const block = $(sel) && $(sel).closest('.detail-block');
    if (block) block.style.display = 'none';
  });

  $('#m-emoji').textContent = it._emoji;
  $('#m-name').innerHTML = `${escapeHtml(it.name)} <span class="kanji">${escapeHtml(it.kanji)}</span>`;
  $('#m-role').textContent = it._family;
  $('#m-trans').textContent = `“${it.jp}” · Greater Codex`;
  $('#m-purpose').textContent = it.note;
  $('#m-tip').textContent = 'Part of the wider world of Japanese blades — tap through the Greater Codex to discover them all.';

  state.modalId = id;
  state.modalKind = 'library';

  const modal = $('#modal-back .modal');
  modal.classList.toggle('discovered', isNew);
  $('#m-discovery').style.display = isNew ? '' : 'none';

  $('#modal-back').classList.add('open');
  document.body.style.overflow = 'hidden';

  if (isNew) {
    state.libDiscovered.add(id);
    noteDiscovery(it._emoji, it.name);
    saveProgress();
    addXp(8, `Discovered the ${it.name}`);
    renderLibrary();
    checkAchievements();
    renderDashboard();
    maybeCollectionComplete();
  }
}

/* ---------- My Knife Roll ---------- */
/* Ownership is stored as state.roll[id] = [ {length, steel, maker, angle,
   lastSharpened, notes}, ... ] so a knife can be owned more than once. */
function getRoll(id) {
  return Array.isArray(state.roll[id]) ? state.roll[id] : [];
}

/* One editable entry (a single physical knife) in the ownership form. */
function ownEntryHtml(entry, i) {
  const v = f => escapeHtml(entry[f] || '');
  return `
    <div class="own-entry" data-i="${i}">
      <div class="own-entry-head">
        <span class="own-entry-title">Knife #${i + 1}</span>
        <button type="button" class="own-remove" data-i="${i}">Remove</button>
      </div>
      <div class="own-grid">
        <label>Blade length<input type="text" data-field="length" value="${v('length')}" placeholder="e.g. 210 mm" autocomplete="off" /></label>
        <label>Steel<input type="text" data-field="steel" value="${v('steel')}" placeholder="e.g. VG10" autocomplete="off" /></label>
        <label>Maker<input type="text" data-field="maker" value="${v('maker')}" placeholder="e.g. Tojiro" autocomplete="off" /></label>
        <label>Sharpening angle<input type="text" data-field="angle" value="${v('angle')}" placeholder="e.g. 15° per side" autocomplete="off" /></label>
        <label>Last sharpened<input type="date" data-field="lastSharpened" value="${v('lastSharpened')}" /></label>
      </div>
      <label class="own-notes">Notes<textarea data-field="notes" rows="2" placeholder="Personal notes…">${v('notes')}</textarea></label>
    </div>`;
}

/* Render every ownership entry for the currently open knife. */
function renderOwnEntries(id) {
  const list = $('#m-own-list');
  if (!list) return;
  list.innerHTML = getRoll(id).map(ownEntryHtml).join('');
}

/* Load the ownership checkbox + entry forms for this knife. */
function bindOwnership(id) {
  const arr = getRoll(id);
  const chk = $('#m-own');
  const form = $('#m-own-form');
  if (chk) chk.checked = arr.length > 0;
  if (form) form.hidden = arr.length === 0;
  renderOwnEntries(id);
  const saved = $('#own-saved');
  if (saved) saved.textContent = '';
}

function flashOwnSaved() {
  const saved = $('#own-saved');
  if (saved) saved.textContent = 'Saved ✓';
}

function onOwnToggle() {
  const id = state.modalId;
  if (!id || state.modalKind !== 'knife') return;
  const owned = $('#m-own').checked;
  if (owned) {
    if (!getRoll(id).length) state.roll[id] = [{}];
  } else {
    delete state.roll[id];
  }
  $('#m-own-form').hidden = !owned;
  renderOwnEntries(id);
  saveProgress();
  renderRoll();
  renderDashboard();
}

function onOwnAdd() {
  const id = state.modalId;
  if (!id || state.modalKind !== 'knife') return;
  if (!Array.isArray(state.roll[id])) state.roll[id] = [];
  state.roll[id].push({});
  $('#m-own').checked = true;
  $('#m-own-form').hidden = false;
  renderOwnEntries(id);
  saveProgress();
  renderRoll();
  renderDashboard();
  // Focus the first field of the entry just added.
  const entries = $$('#m-own-list .own-entry');
  const last = entries[entries.length - 1];
  if (last) last.querySelector('input')?.focus();
}

function onOwnFieldChange(e) {
  const id = state.modalId;
  if (!id || state.modalKind !== 'knife') return;
  const input = e.target;
  const field = input.dataset.field;
  if (!field) return;
  const entryEl = input.closest('.own-entry');
  if (!entryEl) return;
  const i = +entryEl.dataset.i;
  const arr = state.roll[id];
  if (!Array.isArray(arr) || !arr[i]) return;
  arr[i][field] = input.value.trim();
  saveProgress();
  flashOwnSaved();
  renderRoll();
}

function onOwnListClick(e) {
  const btn = e.target.closest('.own-remove');
  if (!btn) return;
  const id = state.modalId;
  if (!id || state.modalKind !== 'knife') return;
  const arr = state.roll[id];
  if (!Array.isArray(arr)) return;
  arr.splice(+btn.dataset.i, 1);
  if (!arr.length) {
    delete state.roll[id];
    $('#m-own').checked = false;
    $('#m-own-form').hidden = true;
  }
  renderOwnEntries(id);
  saveProgress();
  renderRoll();
  renderDashboard();
}

function renderRoll() {
  const box = $('#knife-roll');
  if (!box) return;
  const cards = [];
  Object.entries(state.roll).forEach(([id, arr]) => {
    if (!Array.isArray(arr) || !arr.length) return;
    const k = state.byId[id];
    if (!k) return;
    arr.forEach((r, i) => {
      const facts = [
        r.length && `Length: ${escapeHtml(r.length)}`,
        r.steel && `Steel: ${escapeHtml(r.steel)}`,
        r.maker && `Maker: ${escapeHtml(r.maker)}`,
        r.angle && `Angle: ${escapeHtml(r.angle)}`,
        r.lastSharpened && `Sharpened: ${escapeHtml(r.lastSharpened)}`
      ].filter(Boolean);
      const title = arr.length > 1 ? `${k.name} <span class="roll-num">#${i + 1}</span>` : k.name;
      cards.push(`
        <article class="roll-card" data-id="${id}">
          <div class="roll-top"><span class="roll-em">${k.emoji}</span><h4>${title}</h4></div>
          ${facts.length ? `<ul class="roll-facts">${facts.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
          ${r.notes ? `<p class="roll-notes">“${escapeHtml(r.notes)}”</p>` : ''}
          <button class="btn ghost small roll-edit" data-id="${id}">Edit details</button>
        </article>`);
    });
  });
  if (!cards.length) {
    box.innerHTML = `<p class="empty-state">No knives in your roll yet. Open a Codex knife and toggle <b>“I own this knife”</b> to track its details.</p>`;
    return;
  }
  box.innerHTML = cards.join('');
  $$('.roll-edit', box).forEach(b => b.addEventListener('click', () => openModal(b.dataset.id)));
}

/* ---------- Find My Knife (wizard) ---------- */
function knifeSizeClass(k) {
  const m = (k.bladeLength || '').match(/\d+/);
  const n = m ? +m[0] : 180;
  if (n <= 150) return 'compact';
  if (n >= 240) return 'long';
  return 'medium';
}
const SIZE_ORDER = ['compact', 'medium', 'long'];

/* Score every knife (0–100) against the wizard answers via the compare matrix. */
function wizardScores(ans) {
  const M = CD.compareMatrix || {};
  const cutLabel = { veg: 'vegetables', meat: 'meat & poultry', fish: 'fish', mixed: 'all-round prep' };
  const techLabel = { rocking: 'rock-chopping', chopping: 'straight chopping', precision: 'precise slicing' };

  return state.knives.map(k => {
    const m = M[k.id];
    if (!m) return { k, score: 0, reasons: [] };
    const reasons = [];

    // Cuts (35)
    let cut;
    if (ans.cuts === 'mixed') cut = (m.veg + m.meat + m.fish) / 30;
    else cut = (m[ans.cuts] ?? 5) / 10;
    if (cut >= 0.8 && cutLabel[ans.cuts]) reasons.push(`strong at ${cutLabel[ans.cuts]}`);

    // Technique (25)
    let tech;
    if (ans.technique === 'any') tech = Math.max(m.rocking, m.chopping, m.precision) / 10;
    else tech = (m[ans.technique] ?? 5) / 10;
    if (ans.technique !== 'any' && tech >= 0.8 && techLabel[ans.technique]) reasons.push(`suits ${techLabel[ans.technique]}`);

    // Experience (20)
    let exp;
    if (ans.experience === 'beginner') {
      exp = m.beginner / 10;
      if (m.beginner >= 8) reasons.push('forgiving for beginners');
    } else if (ans.experience === 'advanced') {
      exp = 0.6 + 0.4 * (1 - m.beginner / 10);
      if (m.beginner <= 5) reasons.push('rewards experienced hands');
    } else {
      exp = 0.75;
    }

    // Size (20)
    const sc = knifeSizeClass(k);
    const dist = Math.abs(SIZE_ORDER.indexOf(sc) - SIZE_ORDER.indexOf(ans.size));
    const size = dist === 0 ? 1 : dist === 1 ? 0.5 : 0.2;
    if (dist === 0 && ans.size) reasons.push(`${ans.size} blade size`);

    const score = Math.round(cut * 35 + tech * 25 + exp * 20 + size * 20);
    return { k, score, reasons };
  }).sort((a, b) => b.score - a.score);
}

function renderWizard() {
  const box = $('#wizard');
  if (!box) return;
  const steps = CD.wizard || [];
  box.innerHTML = `
    <div class="wiz-questions">
      ${steps.map((s, si) => `
        <div class="wiz-q">
          <div class="wiz-q-title">${si + 1}. ${escapeHtml(s.q)}</div>
          <div class="wiz-opts">
            ${s.options.map(o => `
              <button class="wiz-opt" data-q="${s.id}" data-v="${o.value}">
                <span class="em">${o.emoji}</span><span>${escapeHtml(o.label)}</span>
              </button>`).join('')}
          </div>
        </div>`).join('')}
    </div>
    <div class="wiz-actions">
      <button class="btn" id="wiz-go" disabled>See my match</button>
      <button class="btn ghost" id="wiz-reset">Reset</button>
    </div>
    <div class="wiz-result" id="wiz-result"></div>`;

  const answers = {};
  const update = () => { $('#wiz-go').disabled = Object.keys(answers).length < steps.length; };
  $$('.wiz-opt', box).forEach(btn => btn.addEventListener('click', () => {
    const q = btn.dataset.q;
    answers[q] = btn.dataset.v;
    $$(`.wiz-opt[data-q="${q}"]`, box).forEach(b => b.classList.toggle('sel', b === btn));
    update();
  }));
  $('#wiz-go').addEventListener('click', () => showWizardResult(answers));
  $('#wiz-reset').addEventListener('click', renderWizard);
}

function showWizardResult(ans) {
  const ranked = wizardScores(ans);
  if (!ranked.length) return;
  const top = ranked[0];
  const alts = ranked.slice(1, 3);
  const res = $('#wiz-result');

  const card = (r, primary) => {
    const reasons = r.reasons.length ? r.reasons : ['a solid all-round fit'];
    return `
      <div class="wiz-pick ${primary ? 'primary' : ''}">
        <div class="wiz-pick-top">
          <span class="em">${r.k.emoji}</span>
          <div class="wiz-pick-id">
            <div class="wiz-pick-name">${r.k.name} <span class="kanji">${r.k.kanji || ''}</span></div>
            <div class="wiz-pick-role">${r.k.role || ''}</div>
          </div>
          <div class="wiz-pct">${r.score}%</div>
        </div>
        <div class="wiz-bar"><i style="width:${r.score}%"></i></div>
        <p class="wiz-why">Why: ${reasons.join(', ')}.</p>
        <button class="btn ghost small wiz-open" data-id="${r.k.id}">View in Codex</button>
      </div>`;
  };

  res.innerHTML = `
    <div class="wiz-result-head">Your best match</div>
    ${card(top, true)}
    <div class="wiz-result-head">Also consider</div>
    <div class="wiz-alts">${alts.map(a => card(a, false)).join('')}</div>`;
  res.classList.add('show');
  $$('.wiz-open', res).forEach(b => b.addEventListener('click', () => openModal(b.dataset.id)));
  res.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ---------- Fix My Knife ---------- */
function renderFixit() {
  const box = $('#fixit');
  if (!box) return;
  const items = CD.fixit || [];
  box.innerHTML = `
    <div class="fix-choices">
      ${items.map(f => `
        <button class="fix-choice" data-id="${f.id}">
          <span class="em">${f.icon}</span><span>${escapeHtml(f.title)}</span>
        </button>`).join('')}
    </div>
    <div class="fix-detail" id="fix-detail"></div>`;
  $$('.fix-choice', box).forEach(b => b.addEventListener('click', () => {
    $$('.fix-choice', box).forEach(x => x.classList.toggle('sel', x === b));
    showFixit(b.dataset.id);
  }));
}

function showFixit(id) {
  const f = (CD.fixit || []).find(x => x.id === id);
  if (!f) return;
  const d = $('#fix-detail');
  d.innerHTML = `
    <div class="fix-head">
      <span class="em">${f.icon}</span>
      <div><h4>${escapeHtml(f.title)}</h4><p>${escapeHtml(f.desc)}</p></div>
    </div>
    <div class="fix-grit">Recommended start: <b>${escapeHtml(f.grit)}</b></div>
    <ol class="fix-steps">${f.steps.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
    ${f.warning ? `<div class="fix-warn">⚠️ ${escapeHtml(f.warning)}</div>` : ''}`;
  d.classList.add('show');
}

/* ---------- Knife anatomy ---------- */
/* Interactive hotspots laid over the reference image (assets/knife-anatomy.png).
   x/y = centre of the hotspot as a percentage of the image; w/h size the
   invisible hit-area so it sits over the printed label. Some parts appear
   twice in the diagram (main view + magnified view) and so list two spots. */
const ANATOMY_HOTSPOTS = [
  // x/y = label centre (%), w/h = clickable size (%), tx/ty = where the arrow points (%)
  // --- main knife (top) ---
  { id: 'ejiri',    x: 5.0,  y: 20.5, w: 9,  h: 9,  tx: 12.8, ty: 20.6 },
  { id: 'e',        x: 21.0, y: 6.5,  w: 11, h: 10, tx: 22.4, ty: 13.8 },
  { id: 'kakumaki', x: 40.5, y: 7.0,  w: 13, h: 10, tx: 40.2, ty: 18.6 },
  { id: 'mei',      x: 54.0, y: 8.0,  w: 9,  h: 9,  tx: 54.9, ty: 17.2 },
  { id: 'mune',     x: 69.5, y: 6.5,  w: 9,  h: 10, tx: 70.1, ty: 17.6 },
  { id: 'shinogi',  x: 92.5, y: 19.5, w: 11, h: 8,  tx: 85.5, ty: 21.4 },
  { id: 'kissaki',  x: 92.5, y: 39.0, w: 12, h: 10, tx: 90.5, ty: 28.4 },
  { id: 'sori',     x: 69.0, y: 41.0, w: 13, h: 10, tx: 71.8, ty: 34.1 },
  { id: 'hasaki',   x: 80.5, y: 47.0, w: 13, h: 10, tx: 79.6, ty: 31.9 },
  { id: 'hamoto',   x: 52.0, y: 41.5, w: 11, h: 10, tx: 53.0, ty: 34.9 },
  { id: 'ago',      x: 40.0, y: 37.5, w: 9,  h: 9,  tx: 46.2, ty: 26.7 },
  { id: 'nakago',   x: 18.0, y: 34.0, w: 11, h: 10, tx: 25.9, ty: 24.5 },
  // --- magnified blade profile (lower-left) ---
  { id: 'nakago',   x: 27.5, y: 47.0, w: 7,  h: 8,  tx: 27.1, ty: 46.4 },
  { id: 'machi',    x: 16.5, y: 55.5, w: 9,  h: 8,  tx: 27.2, ty: 55.7 },
  { id: 'hagane',   x: 40.0, y: 62.0, w: 11, h: 8,  tx: 32.8, ty: 63.3 },
  { id: 'cladline', x: 41.0, y: 69.0, w: 11, h: 8,  tx: 33.7, ty: 69.9 },
  { id: 'jigane',   x: 40.0, y: 77.5, w: 10, h: 8,  tx: 27.9, ty: 78.1 },
  { id: 'shinogi',  x: 41.0, y: 88.5, w: 11, h: 8,  tx: 29.9, ty: 88.5 },
  { id: 'mune',     x: 16.0, y: 81.0, w: 9,  h: 9,  tx: 26.5, ty: 81.4 },
  // --- tip cross-section (lower-right) ---
  { id: 'hasaki',   x: 77.5, y: 47.0, w: 7,  h: 8,  tx: 72.2, ty: 52.1 },
  { id: 'kireha',   x: 82.0, y: 61.5, w: 9,  h: 8,  tx: 73.6, ty: 61.2 },
  { id: 'hira',     x: 81.5, y: 75.0, w: 9,  h: 8,  tx: 74.0, ty: 75.8 }
];

function renderAnatomy() {
  const box = $('#anatomy');
  if (!box) return;
  const byId = Object.fromEntries((CD.anatomy || []).map(p => [p.id, p]));

  const spots = ANATOMY_HOTSPOTS
    .filter(s => byId[s.id])
    .map((s, i) => `
      <button class="an-hot" data-id="${s.id}" data-i="${i}" data-tx="${s.tx}" data-ty="${s.ty}"
        style="left:${s.x}%;top:${s.y}%;width:${s.w}%;height:${s.h}%"
        aria-label="${escapeHtml(byId[s.id].name)}"></button>`).join('');

  // One focus dot per hotspot; a part shown in two views has two dots.
  const dots = ANATOMY_HOTSPOTS
    .filter(s => byId[s.id])
    .map(s => `<div class="an-dot" data-id="${s.id}" style="left:${s.tx}%;top:${s.ty}%"></div>`).join('');

  box.innerHTML = `
    <div class="anatomy-stage">
      <img class="anatomy-img" src="assets/knife-anatomy.png"
        alt="Labelled diagram of a Japanese knife showing handle, blade and clad construction"
        onerror="this.closest('.anatomy-stage').classList.add('img-missing')" />
      <div class="an-hotspots">${spots}</div>
      <div class="an-dots" id="an-dots">${dots}</div>
      <div class="an-missing">
        <p><b>Anatomy image not found.</b></p>
        <p>Save the diagram to <code>assets/knife-anatomy.png</code> to see it here.</p>
      </div>
    </div>
    <div class="anatomy-info" id="anatomy-info">
      <p>Hover or tap any label on the diagram to learn what that part of the knife does.</p>
    </div>`;

  $$('.an-hot', box).forEach(hot => {
    const show = () => showAnatomy(hot.dataset.id, hot);
    hot.addEventListener('click', show);
    hot.addEventListener('mouseenter', show);
    hot.addEventListener('focus', show);
  });
}

function showAnatomy(id, hot) {
  const p = (CD.anatomy || []).find(x => x.id === id);
  if (!p) return;
  // Light up every dot belonging to this part (some appear in two views).
  $$('#an-dots .an-dot').forEach(d => d.classList.toggle('show', d.dataset.id === id));
  $('#anatomy-info').innerHTML = `
    <div class="an-info-name">${escapeHtml(p.name)} <span class="an-jp">${escapeHtml(p.jp)}</span></div>
    <p>${escapeHtml(p.note)}</p>`;
}

/* ---------- Knife vs Knife ---------- */
function renderVs() {
  const box = $('#vs');
  if (!box || !state.knives.length) return;
  const opts = state.knives.map(k => `<option value="${k.id}">${k.name}</option>`).join('');
  const a = state.vsA && state.byId[state.vsA] ? state.vsA : state.knives[0].id;
  const b = state.vsB && state.byId[state.vsB] ? state.vsB : (state.knives[1] || state.knives[0]).id;
  state.vsA = a;
  state.vsB = b;
  box.innerHTML = `
    <div class="vs-selects">
      <select id="vs-a" aria-label="First knife">${opts}</select>
      <span class="vs-mid">vs</span>
      <select id="vs-b" aria-label="Second knife">${opts}</select>
    </div>
    <div class="vs-body" id="vs-body"></div>`;
  $('#vs-a').value = a;
  $('#vs-b').value = b;
  $('#vs-a').addEventListener('change', e => { state.vsA = e.target.value; renderVsBody(); });
  $('#vs-b').addEventListener('change', e => { state.vsB = e.target.value; renderVsBody(); });
  renderVsBody();
}

function renderVsBody() {
  const body = $('#vs-body');
  if (!body) return;
  const M = CD.compareMatrix || {};
  const ka = state.byId[state.vsA];
  const kb = state.byId[state.vsB];
  const ma = M[state.vsA] || {};
  const mb = M[state.vsB] || {};
  const metrics = CD.compareMetrics || [];
  body.innerHTML = `
    <div class="vs-heads">
      <div class="vs-head"><span class="em">${ka.emoji}</span>${ka.name}</div>
      <div class="vs-head"><span class="em">${kb.emoji}</span>${kb.name}</div>
    </div>
    ${metrics.map(mt => {
      const va = ma[mt.key] || 0;
      const vb = mb[mt.key] || 0;
      const da = mt.invert ? 10 - va : va;
      const db = mt.invert ? 10 - vb : vb;
      const aWin = da > db;
      const bWin = db > da;
      return `
        <div class="vs-row">
          <div class="vs-cell ${aWin ? 'win' : ''}"><div class="vs-bar"><i style="width:${da * 10}%"></i></div><span class="vs-num">${da}</span></div>
          <div class="vs-label">${mt.label}</div>
          <div class="vs-cell right ${bWin ? 'win' : ''}"><span class="vs-num">${db}</span><div class="vs-bar"><i style="width:${db * 10}%"></i></div></div>
        </div>`;
    }).join('')}`;
}

/* ---------- Home dashboard ---------- */
function continueRecommendation() {
  const today = todayKey();
  if (!(state.daily.done && state.daily.date === today)) {
    return { label: 'Your Daily Dojo is ready — five quick questions.', cta: 'Daily Dojo', action: () => switchView('dojo') };
  }
  if (state.collected.size < state.knives.length) {
    return { label: 'Discover the rest of the Codex.', cta: 'Open Codex', action: () => switchView('codex') };
  }
  if (state.steelsRead.size < state.steels.length) {
    return {
      label: 'Study the steels behind the blades.',
      cta: 'Steel Codex',
      action: () => { switchView('codex'); setTimeout(() => $('#steel-section')?.scrollIntoView({ behavior: 'smooth' }), 120); }
    };
  }
  return { label: 'Keep your instincts sharp in the Dojo.', cta: 'Enter Dojo', action: () => switchView('dojo') };
}

function renderDashboard() {
  const box = $('#dashboard');
  if (!box) return;

  const rank = rankFor(state.xp);
  const nxt = nextRank(state.xp);
  let pct = 100;
  let toNext = 'Top rank reached 🎉';
  if (nxt) {
    const span = nxt.min - rank.min;
    pct = Math.min(100, Math.round(((state.xp - rank.min) / span) * 100));
    toNext = `${nxt.min - state.xp} XP to ${nxt.name}`;
  }

  const found = discoveredKnives();
  const total = totalKnives();
  const steelFound = state.steelsRead.size;
  const steelTotal = state.steels.length;
  const owned = Object.values(state.roll).reduce((n, arr) => n + (Array.isArray(arr) ? arr.length : 0), 0);
  const streak = state.daily.streak || 0;
  const dailyDone = state.daily.done && state.daily.date === todayKey();

  const recent = state.recent || null;
  const rec = continueRecommendation();

  box.innerHTML = `
    <div class="dash-grid">
      <div class="dash-card dash-rank">
        <div class="dash-rank-top">
          <span class="dash-em">${rank.emoji}</span>
          <div><div class="dash-rank-name">${rank.name}</div><div class="dash-xp">${state.xp} XP</div></div>
        </div>
        <div class="dash-bar"><i style="width:${pct}%"></i></div>
        <div class="dash-sub">${toNext}</div>
      </div>
      <div class="dash-card">
        <div class="dash-metric">🔥 ${streak}</div>
        <div class="dash-mlabel">Daily streak</div>
        <div class="dash-sub">${dailyDone ? 'Done for today ✓' : 'Daily Dojo awaits'}</div>
      </div>
      <div class="dash-card">
        <div class="dash-metric">${found}<span class="dash-metric-sub">/${total}</span></div>
        <div class="dash-mlabel">Knives discovered</div>
        <div class="dash-bar sm"><i style="width:${total ? (found / total) * 100 : 0}%"></i></div>
        <div class="dash-sub">${steelFound}/${steelTotal} steels · ${owned} in your roll</div>
      </div>
      <div class="dash-card dash-recent">
        ${recent
          ? `<div class="dash-mlabel">Recently discovered</div><div class="dash-recent-em">${recent.emoji}</div><div class="dash-recent-name">${recent.name}</div>`
          : `<div class="dash-mlabel">Start discovering</div><div class="dash-recent-em">🔪</div><div class="dash-recent-name">Open the Codex</div>`}
      </div>
    </div>
    <div class="dash-cta">
      <div class="dash-cta-tx"><b>Continue learning</b><span>${rec.label}</span></div>
      <button class="btn" id="dash-continue">${rec.cta}</button>
    </div>`;

  const cont = $('#dash-continue');
  if (cont) cont.addEventListener('click', rec.action);
}

/* ---------- Boot ---------- */
async function init() {
  loadProgress();

  let data = null;
  try {
    // Prefer the JSON file (works when served over http/https).
    const res = await fetch('knives.json');
    if (!res.ok) throw new Error('Failed to load knives.json');
    data = await res.json();
  } catch (e) {
    // Fallback: embedded data lets the page run straight from file://
    if (window.KNIFE_DATA) {
      data = window.KNIFE_DATA;
    } else {
      $('#knife-grid').innerHTML =
        '<p style="color:var(--clay)">Could not load the knife codex. Make sure knives-data.js is present, or run this page from a local server.</p>';
      console.error(e);
      return;
    }
  }

  state.knives = data.knives;
  state.quiz = data.quiz;
  state.byId = Object.fromEntries(data.knives.map(k => [k.id, k]));

  // Fold the extended lore (history, geometry, care, steels, techniques,
  // similar knives) into each knife record so the detail view can read it.
  if (data.lore) {
    state.knives.forEach(k => {
      if (data.lore[k.id]) Object.assign(k, data.lore[k.id]);
    });
  }

  state.stones = data.stones || [];
  state.stoneById = Object.fromEntries(state.stones.map(s => [s.id, s]));

  // Steel Codex reference data + steel questions (from codex-data.js).
  state.steels = CD.steels || [];
  state.steelById = Object.fromEntries(state.steels.map(s => [s.id, s]));
  if (Array.isArray(CD.steelQuiz) && CD.steelQuiz.length) {
    state.quiz = state.quiz.concat(CD.steelQuiz);
  }

  // Guard against an outdated saved Dojo mode.
  if (!DOJO_MODES.some(m => m.id === state.dojoMode)) state.dojoMode = 'all';

  // Index every Greater Codex knife so the whole library is discoverable.
  buildLibraryIndex();

  // prune any collected ids that no longer exist
  state.collected = new Set([...state.collected].filter(id => state.byId[id]));
  // prune library discoveries that no longer exist
  state.libDiscovered = new Set([...state.libDiscovered].filter(id => state.libById[id]));
  // prune roll entries for removed knives
  Object.keys(state.roll).forEach(id => { if (!state.byId[id]) delete state.roll[id]; });

  renderFilters();
  renderGrid();
  renderLibrary();
  renderCompare();
  renderStoneCompare();
  renderDojoIntro();
  renderSteelGrid();
  renderDaily();
  renderProfile();
  renderDashboard();
  updateHud();
  checkAchievements();

  // events
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-back').addEventListener('click', e => {
    if (e.target === $('#modal-back')) closeModal();
  });
  $('#hud-rank').addEventListener('click', () => switchView('profile'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
  $('#cta-explore').addEventListener('click', () => switchView('codex'));
  $('#cta-dojo').addEventListener('click', () => switchView('dojo'));

  // Persistent navigation router.
  wireNav();

  // My Knife Roll ownership controls (single binding; reads state.modalId).
  $('#m-own').addEventListener('change', onOwnToggle);
  $('#own-add').addEventListener('click', onOwnAdd);
  $('#m-own-list').addEventListener('input', onOwnFieldChange);
  $('#m-own-list').addEventListener('click', onOwnListClick);

  // Live search — Codex grid, Greater Codex archive, Steel Codex.
  wireSearch('#codex-search', '#codex-search-clear', v => { state.search = v; renderGrid(); });
  wireSearch('#library-search', '#library-search-clear', v => { state.librarySearch = v; renderLibrary(); });
  wireSearch('#steel-search', '#steel-search-clear', v => { state.steelSearch = v; renderSteelGrid(); });
}

/* Bind an input + clear button to a filtering callback. */
function wireSearch(inputSel, clearSel, apply) {
  const input = $(inputSel);
  const clear = $(clearSel);
  if (!input) return;
  input.addEventListener('input', () => {
    clear.hidden = !input.value;
    apply(input.value);
  });
  clear.addEventListener('click', () => {
    input.value = '';
    clear.hidden = true;
    apply('');
    input.focus();
  });
}

document.addEventListener('DOMContentLoaded', init);
