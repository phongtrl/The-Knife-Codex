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
  { min: 0,   name: 'Apprentice',  emoji: '🌱' },
  { min: 120, name: 'Line Cook',   emoji: '🍳' },
  { min: 280, name: 'Sous Chef',   emoji: '🔪' },
  { min: 480, name: 'Head Chef',   emoji: '👨‍🍳' },
  { min: 720, name: 'Itamae',      emoji: '🍣' },
  { min: 1000, name: 'Knife Master', emoji: '🏯' }
];

const STORE_KEY = 'yjk-progress-v1';

// How many questions are drawn (at random) from the pool each round.
const QUIZ_LENGTH = 12;

const state = {
  knives: [],
  quiz: [],          // full question pool
  round: [],         // the randomized subset for the current run
  byId: {},
  stones: [],        // whetstone grit tiers
  stoneById: {},
  filter: 'all',
  collected: new Set(),
  readStones: new Set(),   // whetstone tiers whose detail was opened
  readLibrary: new Set(),  // Greater Codex families that were expanded
  xp: 0,
  seenQuiz: new Set(),   // scenarios already shown in the Dojo
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
    state.readStones = new Set(data.readStones || []);
    state.readLibrary = new Set(data.readLibrary || []);
    state.seenQuiz = new Set(data.seenQuiz || []);
  } catch (e) { /* ignore corrupt store */ }
}
function saveProgress() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      xp: state.xp,
      collected: [...state.collected],
      readStones: [...state.readStones],
      readLibrary: [...state.readLibrary],
      seenQuiz: [...state.seenQuiz]
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

/* ---------- Ranks modal ---------- */
function renderRanks() {
  const current = rankFor(state.xp);
  const nxt = nextRank(state.xp);

  $('#ranks-next').innerHTML = nxt
    ? `Next rank is <b>${nxt.emoji} ${nxt.name}</b> — <b>${nxt.min - state.xp}</b> XP to go.`
    : `You've reached the top rank — <b>${current.emoji} ${current.name}</b>. 🎉`;

  $('#ranks-list').innerHTML = RANKS.map(r => {
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
}

function openRanks() {
  renderRanks();
  $('#ranks-back').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeRanks() {
  $('#ranks-back').classList.remove('open');
  document.body.style.overflow = '';
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
    <div class="spec-row"><span class="k">Knife length</span><span class="v">${k.bladeLength}</span></div>
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
    addXp(15, `Discovered the ${k.name}`);
    renderGrid();
    if (state.collected.size === state.knives.length) {
      setTimeout(() => toast('🏯 Codex complete — every knife collected!'), 400);
    }
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

  $('#m-specs').innerHTML = `
    <div class="spec-row"><span class="k">Grit range</span><span class="v">${s.grit}</span></div>
    <div class="spec-row"><span class="k">Tier</span><span class="v">${s.tier}</span></div>
    <div class="spec-row"><span class="k">Stage</span><span class="v">${s.stage}</span></div>
    <div class="spec-row"><span class="k">Preparation</span><span class="v">${s.soak}</span></div>
    <div class="spec-row"><span class="k">Fineness</span><span class="v">${diffDots(s.fineness)}</span></div>`;

  $('#m-tip').textContent = s.tip;

  $('#modal-back').classList.add('open');
  document.body.style.overflow = 'hidden';

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
function startQuiz() {
  // Only draw questions not seen in previous training rounds.
  let unseen = state.quiz.filter(q => !state.seenQuiz.has(q.scenario));
  // Once every question has been seen, reset the pool so training can continue.
  if (unseen.length === 0) {
    state.seenQuiz.clear();
    unseen = state.quiz.slice();
  }
  const pool = shuffle(unseen).slice(0, Math.min(QUIZ_LENGTH, unseen.length));
  state.round = pool.map(q => ({ ...q, options: shuffle(q.options) }));
  pool.forEach(q => state.seenQuiz.add(q.scenario));
  saveProgress();

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
  const accepted = acceptedAnswers(q);
  const buttons = $$('#answers .answer-btn');
  buttons.forEach(b => { b.disabled = true; });

  const isCorrect = chosenBtn.dataset.correct === 'true';
  const feedback = $('#quiz-feedback');

  // Reveal every acceptable answer in green.
  buttons.forEach(b => { if (b.dataset.correct === 'true') b.classList.add('correct'); });

  const correctLabels = accepted.map(a => optionMeta(a).label);

  if (isCorrect) {
    state.quizScore++;
    feedback.className = 'quiz-feedback';
    feedback.textContent = accepted.length > 1
      ? `✓ Correct — ${formatList(correctLabels, 'and')} all work here.`
      : `✓ Correct — ${correctLabels[0]} is the right answer.`;
    addXp(9, 'Correct answer');
  } else {
    chosenBtn.classList.add('wrong');
    feedback.className = 'quiz-feedback miss';
    feedback.textContent = accepted.length > 1
      ? `✗ Any of ${formatList(correctLabels, 'or')} works here.`
      : `✗ The right answer is ${correctLabels[0]}.`;
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
  if (pct === 1) { title = 'Flawless — Itamae!'; emoji = '🏯'; note = 'A perfect run across knives and stones.'; }
  else if (pct >= 0.75) { title = 'Sharp instincts.'; emoji = '🍣'; note = 'A confident grasp of the codex.'; }
  else if (pct >= 0.5) { title = 'Coming along.'; emoji = '🔪'; note = 'Solid basics — a little more practice.'; }
  else { title = 'Keep training.'; emoji = '🌱'; note = 'Revisit the codex and try again.'; }

  if (pct === 1) addXp(12, 'Perfect round');

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
      <p>${QUIZ_LENGTH} random tasks each run — knives, whetstone grits, strops, and knife care. Answers earn XP and rank you up.</p>
      <button class="btn" id="quiz-begin">Begin Training</button>
    </div>`;
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

function renderLibrary() {
  const box = $('#library');
  if (!box) return;
  const codexNames = new Set(state.knives.map(k => k.name.toLowerCase()));

  box.innerHTML = LIBRARY.map(g => {
    const items = g.items.map(it => {
      const inCodex = codexNames.has(it.name.toLowerCase());
      return `
        <div class="lib-item${inCodex ? ' in-codex' : ''}">
          <div class="lib-item-head">
            <span class="lib-name">${it.name} <span class="lib-kanji">${it.kanji}</span></span>
            ${inCodex ? '<span class="lib-badge">★ In the Codex</span>' : ''}
          </div>
          <div class="lib-trans">${it.jp}</div>
          <p class="lib-note">${it.note}</p>
        </div>`;
    }).join('');

    return `
      <details class="lib-group" data-lib="${g.title}">
        <summary>
          <span class="lib-g-em">${g.emoji}</span>
          <span class="lib-g-text">
            <span class="lib-g-title">${g.title} <span class="lib-g-kanji">${g.kanji}</span></span>
            <span class="lib-g-blurb">${g.blurb}</span>
          </span>
          <span class="lib-g-count">${g.items.length}</span>
          <span class="lib-chev" aria-hidden="true">⌄</span>
        </summary>
        <div class="lib-items">${items}</div>
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

  state.stones = data.stones || [];
  state.stoneById = Object.fromEntries(state.stones.map(s => [s.id, s]));

  // prune any collected ids that no longer exist
  state.collected = new Set([...state.collected].filter(id => state.byId[id]));

  renderFilters();
  renderGrid();
  renderLibrary();
  renderCompare();
  renderStoneCompare();
  renderDojoIntro();
  updateHud();

  // events
  $('#modal-close').addEventListener('click', closeModal);
  $('#modal-back').addEventListener('click', e => {
    if (e.target === $('#modal-back')) closeModal();
  });
  $('#hud-rank').addEventListener('click', openRanks);
  $('#ranks-close').addEventListener('click', closeRanks);
  $('#ranks-back').addEventListener('click', e => {
    if (e.target === $('#ranks-back')) closeRanks();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeRanks(); }
  });
  $('#cta-explore').addEventListener('click', () =>
    $('#codex').scrollIntoView({ behavior: 'smooth' }));
  $('#cta-dojo').addEventListener('click', () =>
    $('#dojo').scrollIntoView({ behavior: 'smooth' }));
}

document.addEventListener('DOMContentLoaded', init);
