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

const RANKS = [
  { min: 0,   name: 'Apprentice',  emoji: '🌱' },
  { min: 120, name: 'Line Cook',   emoji: '🍳' },
  { min: 280, name: 'Sous Chef',   emoji: '🔪' },
  { min: 480, name: 'Head Chef',   emoji: '👨‍🍳' },
  { min: 720, name: 'Itamae',      emoji: '🍣' },
  { min: 1000, name: 'Blade Master', emoji: '🏯' }
];

const STORE_KEY = 'yjk-progress-v1';

// How many questions are drawn (at random) from the pool each round.
const QUIZ_LENGTH = 12;

const state = {
  knives: [],
  quiz: [],          // full question pool
  round: [],         // the randomized subset for the current run
  byId: {},
  filter: 'all',
  collected: new Set(),
  xp: 0,
  quizIndex: 0,
  quizScore: 0,
  quizActive: false
};

/* ---------- Persistence ---------- */
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.xp = data.xp || 0;
    state.collected = new Set(data.collected || []);
  } catch (e) { /* ignore corrupt store */ }
}
function saveProgress() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      xp: state.xp,
      collected: [...state.collected]
    }));
  } catch (e) { /* storage may be unavailable */ }
}

/* ---------- Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

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
  return { label: opt, emoji: keywordEmoji(opt) };
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
  $('#hud-collected').textContent = state.collected.size;
  $('#hud-total').textContent = state.knives.length;
  $('#hud-rank').textContent = `${rank.emoji} ${rank.name}`;

  let pct = 100;
  if (nxt) {
    const span = nxt.min - rank.min;
    pct = Math.min(100, Math.round(((state.xp - rank.min) / span) * 100));
  }
  $('#hud-xp-fill').style.width = pct + '%';
}

/* ---------- Codex ---------- */
function renderFilters() {
  const rarities = ['all', ...new Set(state.knives.map(k => k.rarity))];
  const box = $('#filters');
  box.innerHTML = rarities.map(r => {
    const label = r === 'all' ? 'All Blades' : RARITY_LABEL[r] || r;
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
  const list = state.filter === 'all'
    ? state.knives
    : state.knives.filter(k => k.rarity === state.filter);

  grid.innerHTML = list.map((k, i) => {
    const collected = state.collected.has(k.id);
    const color = `var(--rarity-${k.rarity})`;
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

/* ---------- Modal ---------- */
function openModal(id) {
  const k = state.byId[id];
  if (!k) return;

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
  $('#m-avoid').innerHTML = k.avoid.map(t => `<span class="tag">${t}</span>`).join('');

  $('#m-specs').innerHTML = `
    <div class="spec-row"><span class="k">Blade length</span><span class="v">${k.bladeLength}</span></div>
    <div class="spec-row"><span class="k">Edge type</span><span class="v">${k.edge}</span></div>
    <div class="spec-row"><span class="k">Profile</span><span class="v">${k.profile}</span></div>
    <div class="spec-row"><span class="k">Difficulty</span><span class="v">${diffDots(k.difficulty)}</span></div>`;

  $('#m-tip').textContent = k.tip;

  $('#modal-back').classList.add('open');
  document.body.style.overflow = 'hidden';

  // animate stat bars
  requestAnimationFrame(() => {
    $$('#m-stats .s-bar i').forEach(bar => { bar.style.width = bar.dataset.w + '%'; });
  });

  // first discovery reward
  if (!state.collected.has(id)) {
    state.collected.add(id);
    saveProgress();
    addXp(20, `Discovered the ${k.name}`);
    renderGrid();
    if (state.collected.size === state.knives.length) {
      setTimeout(() => toast('🏯 Codex complete — every blade collected!'), 400);
    }
  }
}

function closeModal() {
  $('#modal-back').classList.remove('open');
  document.body.style.overflow = '';
}

/* ---------- Dojo / Quiz ---------- */
function startQuiz() {
  // Draw a random subset and shuffle each question's options.
  const pool = shuffle(state.quiz).slice(0, Math.min(QUIZ_LENGTH, state.quiz.length));
  state.round = pool.map(q => ({ ...q, options: shuffle(q.options) }));

  state.quizIndex = 0;
  state.quizScore = 0;
  state.quizActive = true;
  renderQuestion();
  $('#dojo').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    const isCorrect = opt === q.answer;
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
      <span class="quiz-score">Score: <b>${state.quizScore}</b> / ${total}</span>
      <button class="btn ghost small" id="quiz-skip">Skip</button>
    </div>`;

  $$('#answers .answer-btn').forEach(btn => {
    btn.addEventListener('click', () => answerQuestion(btn));
  });
  $('#quiz-skip').addEventListener('click', nextQuestion);
}

function answerQuestion(chosenBtn) {
  const q = state.round[state.quizIndex];
  const buttons = $$('#answers .answer-btn');
  buttons.forEach(b => { b.disabled = true; });

  const correctLabel = optionMeta(q.answer).label;
  const isCorrect = chosenBtn.dataset.correct === 'true';
  const feedback = $('#quiz-feedback');

  if (isCorrect) {
    chosenBtn.classList.add('correct');
    state.quizScore++;
    feedback.className = 'quiz-feedback';
    feedback.textContent = `✓ Correct — ${correctLabel} is the right answer.`;
    addXp(15, 'Correct answer');
  } else {
    chosenBtn.classList.add('wrong');
    buttons.find(b => b.dataset.correct === 'true')?.classList.add('correct');
    feedback.className = 'quiz-feedback miss';
    feedback.textContent = `✗ The right answer is ${correctLabel}.`;
  }

  const foot = $('.quiz-foot');
  const isLast = state.quizIndex === state.round.length - 1;
  foot.innerHTML = `
    <span class="quiz-score">Score: <b>${state.quizScore}</b> / ${state.round.length}</span>
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

  let title, emoji, note;
  if (pct === 1) { title = 'Flawless — Itamae!'; emoji = '🏯'; note = 'A perfect run across blades and stones.'; }
  else if (pct >= 0.75) { title = 'Sharp instincts.'; emoji = '🍣'; note = 'A confident grasp of the codex.'; }
  else if (pct >= 0.5) { title = 'Coming along.'; emoji = '🔪'; note = 'Solid basics — a little more practice.'; }
  else { title = 'Keep training.'; emoji = '🌱'; note = 'Revisit the codex and try again.'; }

  addXp(score * 5 + (pct === 1 ? 25 : 0), 'Dojo complete');

  $('#quiz-stage').innerHTML = `
    <div class="quiz-result">
      <div class="rank-emoji">${emoji}</div>
      <h4>${title}</h4>
      <p>${note}<br />You scored <b>${score}</b> of <b>${total}</b>.</p>
      <button class="btn" id="quiz-restart">Train Again</button>
    </div>`;
  $('#quiz-restart').addEventListener('click', startQuiz);
}

function renderDojoIntro() {
  $('#quiz-stage').innerHTML = `
    <div class="quiz-result">
      <div class="rank-emoji">🥢</div>
      <h4>Ready to test your eye?</h4>
      <p>${QUIZ_LENGTH} random tasks each run — blades, whetstone grits, strops, and knife care. Answers earn XP and rank you up.</p>
      <button class="btn" id="quiz-begin">Begin Training</button>
    </div>`;
  $('#quiz-begin').addEventListener('click', startQuiz);
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

  // prune any collected ids that no longer exist
  state.collected = new Set([...state.collected].filter(id => state.byId[id]));

  renderFilters();
  renderGrid();
  renderCompare();
  renderDojoIntro();
  updateHud();

  // events
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-back').addEventListener('click', e => {
    if (e.target === $('#modal-back')) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
  $('#cta-explore').addEventListener('click', () =>
    $('#codex').scrollIntoView({ behavior: 'smooth' }));
  $('#cta-dojo').addEventListener('click', () =>
    $('#dojo').scrollIntoView({ behavior: 'smooth' }));
}

document.addEventListener('DOMContentLoaded', init);
