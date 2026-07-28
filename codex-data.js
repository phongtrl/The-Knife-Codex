/* ============================================================
   The Knife Codex — extended reference data
   Static datasets that power the newer views: the Steel Codex,
   knife anatomy, the Knife-vs-Knife matrix, achievements, the
   Find-My-Knife wizard, the Fix-My-Knife assistant, and the
   extra Steel quiz questions.

   Loaded as a plain <script> (window.CODEX_DATA) so it is always
   available, even when the page is opened straight from file://.
   Ratings use a 1–5 scale unless noted (rendered as dots).
   ============================================================ */
window.CODEX_DATA = {

  /* ---------- Steel Codex ----------
     ratings: edgeRetention, toughness, sharpening (ease of), corrosion
     all on a 1–5 scale. `reactive` marks carbon steels that patina/rust. */
  steels: [
    {
      id: 'shirogami-1', name: 'Shirogami #1', jp: 'White #1 · 白紙一号',
      type: 'Carbon', reactive: true, hrc: '62–64',
      summary: 'The purest high-carbon steel — takes a screaming edge, but wants a careful owner.',
      characteristics: 'A very pure high-carbon steel with almost no alloying. It sharpens easily on natural and synthetic stones and reaches an extremely keen, refined edge — the traditional choice for single-bevel sushi knives. In return it is reactive and demands prompt drying and oiling.',
      ratings: { edgeRetention: 5, toughness: 2, sharpening: 5, corrosion: 1 },
      bestFor: ['Single-bevel slicers', 'Sushi & sashimi knives', 'Sharpening purists'],
      emoji: '⚪'
    },
    {
      id: 'shirogami-2', name: 'Shirogami #2', jp: 'White #2 · 白紙二号',
      type: 'Carbon', reactive: true, hrc: '61–63',
      summary: 'The friendly carbon steel — a hair tougher and more forgiving than White #1.',
      characteristics: 'Slightly more carbon-lean than White #1, which trades a touch of ultimate keenness for better toughness and forgiveness. Sharpens beautifully and is a favourite for gyutos and nakiris among cooks who don\'t mind a little upkeep.',
      ratings: { edgeRetention: 4, toughness: 3, sharpening: 5, corrosion: 1 },
      bestFor: ['Everyday carbon knives', 'Learning to sharpen', 'Gyuto & nakiri'],
      emoji: '⚪'
    },
    {
      id: 'aogami-1', name: 'Aogami #1', jp: 'Blue #1 · 青紙一号',
      type: 'Carbon', reactive: true, hrc: '62–64',
      summary: 'White #1 with chromium and tungsten added — longer edge life, a bit more work to sharpen.',
      characteristics: 'Blue #1 takes White #1 and adds chromium and tungsten for wear resistance. The result holds an edge noticeably longer and reaches high hardness, at the cost of being slightly slower on the stones. Still reactive, but a touch more corrosion-resistant than white steels.',
      ratings: { edgeRetention: 5, toughness: 3, sharpening: 3, corrosion: 2 },
      bestFor: ['Long slicing sessions', 'High-hardness edges', 'Enthusiasts'],
      emoji: '🔵'
    },
    {
      id: 'aogami-2', name: 'Aogami #2', jp: 'Blue #2 · 青紙二号',
      type: 'Carbon', reactive: true, hrc: '61–63',
      summary: 'The all-round blue steel — tough, long-lasting and still easy to bring back.',
      characteristics: 'The most balanced of the blue steels: good edge retention from its tungsten and chromium, plus better toughness than the #1 grade. A superb workhorse steel for gyutos, debas and camp knives that still sharpens without a fight.',
      ratings: { edgeRetention: 4, toughness: 4, sharpening: 4, corrosion: 2 },
      bestFor: ['Workhorse gyutos', 'Deba & butchery', 'Balanced performance'],
      emoji: '🔵'
    },
    {
      id: 'aogami-super', name: 'Aogami Super', jp: 'Blue Super · 青紙スーパー',
      type: 'Carbon', reactive: true, hrc: '63–65',
      summary: 'The carbon steel that holds an edge like a stainless powder steel.',
      characteristics: 'Extra carbon plus more chromium, tungsten and molybdenum push edge retention to the top of the carbon world while reaching very high hardness. It rewards a skilled sharpener with a long-lasting, keen edge — but is less forgiving and still reactive.',
      ratings: { edgeRetention: 5, toughness: 3, sharpening: 3, corrosion: 2 },
      bestFor: ['Maximum carbon edge life', 'Experienced sharpeners', 'Hard, keen edges'],
      emoji: '🔷'
    },
    {
      id: 'ginsan', name: 'Ginsan (Silver #3)', jp: 'Gin-3 · 銀三',
      type: 'Stainless', reactive: false, hrc: '60–62',
      summary: 'Carbon-like sharpening feel, stainless peace of mind.',
      characteristics: 'A high-carbon stainless steel that behaves on the stones much like a white steel — easy to sharpen to a very keen edge — while resisting rust. A brilliant bridge for carbon lovers who want lower maintenance.',
      ratings: { edgeRetention: 3, toughness: 3, sharpening: 4, corrosion: 4 },
      bestFor: ['Carbon feel, no rust', 'Sushi knives', 'Low-maintenance keenness'],
      emoji: '🥈'
    },
    {
      id: 'vg10', name: 'VG10', jp: 'V-Gold 10 · ブイ金十号',
      type: 'Stainless', reactive: false, hrc: '60–61',
      summary: 'The dependable stainless all-rounder found on countless Japanese knives.',
      characteristics: 'A vanadium-alloyed stainless steel with an excellent balance of edge retention, sharpness and corrosion resistance. Extremely common, well understood, and easy to live with — often clad in softer stainless as a Damascus core.',
      ratings: { edgeRetention: 4, toughness: 3, sharpening: 3, corrosion: 5 },
      bestFor: ['Everyday stainless knives', 'Damascus cores', 'Low upkeep'],
      emoji: '✨'
    },
    {
      id: 'sg2', name: 'SG2 / R2', jp: 'Powder Stainless · 粉末鋼',
      type: 'Powder stainless', reactive: false, hrc: '63–64',
      summary: 'Fine-grained powder steel with superb edge retention and rust resistance.',
      characteristics: 'A powder-metallurgy stainless steel (SG2 and R2 are near-identical) with a very fine, even grain. It reaches high hardness, holds a keen edge for a long time and resists corrosion — though its hardness makes it a little harder to sharpen and more chip-prone than tougher steels.',
      ratings: { edgeRetention: 5, toughness: 2, sharpening: 2, corrosion: 5 },
      bestFor: ['Long edge retention', 'Premium stainless', 'Fine push-cutting'],
      emoji: '💠'
    },
    {
      id: 'hap40', name: 'HAP40', jp: 'Powder HSS · ハップ40',
      type: 'Semi-stainless (powder HSS)', reactive: true, hrc: '64–67',
      summary: 'A high-speed tool steel that holds an edge almost impossibly long.',
      characteristics: 'A powder high-speed steel with extreme wear resistance and very high attainable hardness — its edge retention is legendary. It is semi-stainless (lightly reactive), noticeably stubborn to sharpen, and best suited to cooks who value ultimate edge life.',
      ratings: { edgeRetention: 5, toughness: 4, sharpening: 2, corrosion: 3 },
      bestFor: ['Marathon edge retention', 'Production kitchens', 'Diamond/ceramic stones'],
      emoji: '⚙️'
    },
    {
      id: 'zdp189', name: 'ZDP-189', jp: 'Super Steel · ゼッドディーピー',
      type: 'Powder stainless', reactive: false, hrc: '64–67',
      summary: 'Extreme hardness and edge retention — brittle, and demanding to sharpen.',
      characteristics: 'A super-high-carbon powder stainless steel taken to extraordinary hardness. Edge retention and keenness are exceptional, but toughness is low (it chips if abused) and it is hard work on the stones. A specialist steel for careful hands.',
      ratings: { edgeRetention: 5, toughness: 1, sharpening: 1, corrosion: 4 },
      bestFor: ['Extreme edge retention', 'Push-cut specialists', 'Careful owners'],
      emoji: '💎'
    }
  ],

  /* ---------- Knife anatomy ----------
     x/y are percentage positions of the hotspot over the SVG diagram. */
  anatomy: [
    { id: 'tip',    name: 'Tip',    jp: '切先 · Kissaki', x: 90, y: 30,
      note: 'The pointed front of the blade. Used for fine, detailed work — scoring, piercing, and delicate cuts.' },
    { id: 'spine',  name: 'Spine',  jp: '峰 · Mine', x: 52, y: 20,
      note: 'The thick, unsharpened top of the blade. Its thickness sets the knife\'s stiffness; you can rest a guiding finger here.' },
    { id: 'edge',   name: 'Edge',   jp: '刃 · Ha', x: 55, y: 74,
      note: 'The sharpened cutting line running the length of the blade. This is what you refine on the stones.' },
    { id: 'heel',   name: 'Heel',   jp: '刃元 · Hamoto', x: 30, y: 74,
      note: 'The rear corner of the edge, nearest the handle. The strongest part of the edge — used for powering through tougher food.' },
    { id: 'choil',  name: 'Choil',  jp: '顎 · Ago', x: 25, y: 62,
      note: 'The unsharpened notch where the edge meets the handle. A pinch-grip anchor and a safe place to rest a finger.' },
    { id: 'shinogi', name: 'Shinogi', jp: '鎬 · Shinogi', x: 60, y: 46,
      note: 'The ridge line between the flat face and the bevel, most pronounced on single-bevel knives. It defines the bevel\'s width and look.' },
    { id: 'tang',   name: 'Tang',   jp: '中子 · Nakago', x: 13, y: 46,
      note: 'The part of the blade steel that extends into the handle. It anchors the blade and balances the knife.' },
    { id: 'handle', name: 'Handle', jp: '柄 · Wa-e', x: 6, y: 46,
      note: 'The grip. Traditional Japanese "wa" handles are light wood in D, oval or octagonal shapes, shifting balance toward the blade.' }
  ],

  /* ---------- Knife-vs-Knife matrix ----------
     Per codex knife id, all metrics on a 1–10 scale.
     maintenance = how demanding upkeep is (higher = more work).
     beginner = beginner-friendliness (higher = easier to live with). */
  compareMatrix: {
    gyuto:    { veg: 8, meat: 8, fish: 6, precision: 7, rocking: 9, chopping: 7, maintenance: 4, beginner: 9 },
    santoku:  { veg: 9, meat: 7, fish: 6, precision: 7, rocking: 3, chopping: 8, maintenance: 3, beginner: 10 },
    nakiri:   { veg: 10, meat: 3, fish: 3, precision: 8, rocking: 1, chopping: 10, maintenance: 4, beginner: 8 },
    petty:    { veg: 6, meat: 6, fish: 5, precision: 9, rocking: 4, chopping: 4, maintenance: 3, beginner: 9 },
    sujihiki: { veg: 2, meat: 9, fish: 8, precision: 9, rocking: 2, chopping: 2, maintenance: 5, beginner: 6 },
    yanagiba: { veg: 1, meat: 4, fish: 10, precision: 10, rocking: 1, chopping: 1, maintenance: 8, beginner: 3 },
    deba:     { veg: 2, meat: 5, fish: 10, precision: 6, rocking: 2, chopping: 6, maintenance: 7, beginner: 4 },
    honesuki: { veg: 3, meat: 8, fish: 6, precision: 8, rocking: 2, chopping: 5, maintenance: 5, beginner: 5 },
    kiritsuke:{ veg: 8, meat: 8, fish: 8, precision: 8, rocking: 4, chopping: 7, maintenance: 7, beginner: 4 },
    bunka:    { veg: 8, meat: 8, fish: 6, precision: 8, rocking: 4, chopping: 8, maintenance: 4, beginner: 7 }
  },
  compareMetrics: [
    { key: 'veg', label: 'Vegetables' },
    { key: 'meat', label: 'Meat' },
    { key: 'fish', label: 'Fish' },
    { key: 'precision', label: 'Precision' },
    { key: 'rocking', label: 'Rocking' },
    { key: 'chopping', label: 'Chopping' },
    { key: 'beginner', label: 'Beginner-friendly' },
    { key: 'maintenance', label: 'Low maintenance', invert: true }
  ],

  /* ---------- Achievements ----------
     `check` receives a small context object and returns true when unlocked. */
  achievements: [
    { id: 'first-knife', icon: '🌱', title: 'First Blade', desc: 'Discover your first knife.',
      check: c => c.knivesFound >= 1 },
    { id: 'ten-knives', icon: '🔟', title: 'Collector', desc: 'Discover ten knives.',
      check: c => c.knivesFound >= 10 },
    { id: 'first-dojo', icon: '🥢', title: 'Student', desc: 'Complete your first Dojo round.',
      check: c => c.dojoRounds >= 1 },
    { id: 'perfect-dojo', icon: '💯', title: 'Flawless', desc: 'Score 100% on a Dojo round.',
      check: c => c.perfectRuns >= 1 },
    { id: 'streak-7', icon: '🔥', title: 'Devoted', desc: 'Reach a 7-day Daily Dojo streak.',
      check: c => c.dailyStreak >= 7 },
    { id: 'all-knives', icon: '🏯', title: 'Master of Blades', desc: 'Discover every knife in the Codex.',
      check: c => c.knivesFound >= c.knivesTotal && c.knivesTotal > 0 },
    { id: 'all-steels', icon: '💠', title: 'Metallurgist', desc: 'Study every steel in the Steel Codex.',
      check: c => c.steelsFound >= c.steelsTotal && c.steelsTotal > 0 }
  ],

  /* ---------- Find My Knife wizard ---------- */
  wizard: [
    {
      id: 'cuts', q: 'What do you cut most?',
      options: [
        { value: 'veg', label: 'Vegetables', emoji: '🥬' },
        { value: 'meat', label: 'Meat & poultry', emoji: '🍗' },
        { value: 'fish', label: 'Fish & seafood', emoji: '🐟' },
        { value: 'mixed', label: 'A bit of everything', emoji: '🍽️' }
      ]
    },
    {
      id: 'technique', q: 'How do you like to cut?',
      options: [
        { value: 'rocking', label: 'Rocking on the board', emoji: '🌊' },
        { value: 'chopping', label: 'Straight up-and-down chopping', emoji: '⬇️' },
        { value: 'precision', label: 'Fine, precise slicing', emoji: '🎯' },
        { value: 'any', label: 'No strong preference', emoji: '🤷' }
      ]
    },
    {
      id: 'experience', q: 'How experienced are you?',
      options: [
        { value: 'beginner', label: 'New to Japanese knives', emoji: '🌱' },
        { value: 'intermediate', label: 'Comfortable and improving', emoji: '🍳' },
        { value: 'advanced', label: 'Confident — bring on a challenge', emoji: '🏯' }
      ]
    },
    {
      id: 'size', q: 'Preferred blade size?',
      options: [
        { value: 'compact', label: 'Compact & nimble', emoji: '🍓' },
        { value: 'medium', label: 'Medium all-rounder', emoji: '🔪' },
        { value: 'long', label: 'Long & slicing', emoji: '📏' }
      ]
    }
  ],

  /* ---------- Fix My Knife assistant ---------- */
  fixit: [
    {
      id: 'dull', icon: '😐', title: 'Dull edge',
      desc: 'Cuts poorly but the edge looks intact — no visible damage.',
      grit: 'Start on a medium #1000 stone',
      steps: [
        'Soak a medium (#1000) whetstone until it stops bubbling.',
        'Hold a steady ~15° angle per side and sharpen until you raise a burr along the whole edge.',
        'Flip and repeat on the other side until the burr moves across.',
        'Refine on a fine (#3000–#5000) stone to clean up the edge.',
        'Finish with a few light stropping passes to remove the burr.'
      ],
      warning: null
    },
    {
      id: 'small-chips', icon: '🩹', title: 'Small chips',
      desc: 'Tiny nicks you can feel with a fingernail but barely see.',
      grit: 'Medium #1000, or coarse #400 if stubborn',
      steps: [
        'Assess the depth — small chips usually clear on a #1000 stone.',
        'Sharpen at a slightly higher angle until the chips disappear into a fresh burr.',
        'If they resist, drop to a coarse #400 stone briefly, then return to #1000.',
        'Progress up through fine grits to restore a smooth edge.',
        'Strop to finish.'
      ],
      warning: null
    },
    {
      id: 'major-chips', icon: '🪓', title: 'Major chips',
      desc: 'Deep chips or a broken tip that need real steel removed.',
      grit: 'Coarse #120–#400 for reprofiling',
      steps: [
        'Use a coarse (#120–#400) stone to grind the edge down past the deepest chip.',
        'Keep the blade cool and check the edge line stays even along its length.',
        'Rebuild the bevel on a medium stone, then refine through the finer grits.',
        'Expect to lose a little blade height — go slowly and check often.'
      ],
      warning: 'Large chips remove significant steel and can distort the edge line. If the damage is deep or near the tip, a professional sharpener will get a cleaner, more even result.'
    },
    {
      id: 'rust', icon: '🟤', title: 'Rust',
      desc: 'Orange rust spots, mostly on carbon or reactive steel.',
      grit: 'Rust eraser / fine abrasive — not a bevel stone',
      steps: [
        'Tackle rust early — wipe the blade dry first.',
        'Use a rust eraser or fine abrasive (a wine cork with a mild powder works) and rub along the blade.',
        'For stubborn spots, a paste of baking soda can help lift surface rust.',
        'Dry thoroughly and apply a thin coat of camellia (tsubaki) or food-safe mineral oil.',
        'Distinguish rust (orange, flaky) from patina (grey/blue, stable) — patina is protective and can stay.'
      ],
      warning: 'Deep pitting rust that has eaten into the steel may need professional attention and can leave permanent marks.'
    },
    {
      id: 'poor-cutting', icon: '🍅', title: 'Poor cutting performance',
      desc: 'Feels sharp to the touch but drags, wedges, or crushes food.',
      grit: 'Deburr / strop first, then consider thinning',
      steps: [
        'First rule out a lingering burr — strop the edge and re-test on paper or a tomato.',
        'If it still wedges, the blade may need thinning behind the edge on a coarse–medium stone.',
        'Check your board: glass or stone surfaces dull an edge quickly.',
        'A light touch-up on a fine stone often restores clean, effortless cuts.'
      ],
      warning: 'Thinning the blade behind the edge changes the knife\'s geometry. If you\'re unsure, leave thinning to an experienced sharpener.'
    },
    {
      id: 'bent-tip', icon: '📍', title: 'Damaged or bent tip',
      desc: 'A snapped, rolled, or bent tip.',
      grit: 'Coarse stone to reshape the tip',
      steps: [
        'For a rolled tip, gently realign it and refine on a fine stone.',
        'For a broken tip, reshape the profile on a coarse stone, blending the spine down to a new point.',
        'Rebuild the edge through the grits so the new tip matches the rest of the blade.'
      ],
      warning: 'Reshaping a tip is delicate and easy to get wrong. For a valued knife, a professional repair preserves the profile far better.'
    }
  ],

  /* ---------- Extra Dojo questions: the Steel category ----------
     `cat:'steel'` lets the categorizer route these to the Steel focus. */
  steelQuiz: [
    { cat: 'steel', why: 'Shirogami (white) is a very pure carbon steel that sharpens to an exceptionally keen, refined edge.', scenario: 'Which steel is a very pure high-carbon steel prized for taking an extremely keen edge?', answer: 'Shirogami (White steel)', options: ['Shirogami (White steel)', 'VG10', 'Ginsan', 'ZDP-189'] },
    { cat: 'steel', why: 'Aogami (blue) is white steel plus chromium and tungsten, which boosts wear resistance and edge life.', scenario: 'Which family adds chromium and tungsten to carbon steel for longer edge retention?', answer: 'Aogami (Blue steel)', options: ['Aogami (Blue steel)', 'Shirogami (White steel)', 'Ginsan', '440C'] },
    { cat: 'steel', why: 'Ginsan is a stainless steel that sharpens much like white carbon steel — carbon feel without the rust.', scenario: 'You want a carbon-like sharpening feel but without the rust worry. Which steel?', answer: 'Ginsan (Silver #3)', options: ['Ginsan (Silver #3)', 'Shirogami #1', 'Aogami Super', 'Blue #2'] },
    { cat: 'steel', why: 'VG10 is the common, well-balanced stainless found on countless Japanese knives — easy to live with.', scenario: 'Which stainless steel is the common, dependable all-rounder on countless Japanese knives?', answer: 'VG10', options: ['VG10', 'Aogami #1', 'HAP40', 'Shirogami #2'] },
    { cat: 'steel', why: 'SG2/R2 is a powder-metallurgy stainless with a very fine grain and long edge retention.', scenario: 'Which powder stainless steel is known for a very fine grain and long edge retention?', answer: 'SG2 / R2', options: ['SG2 / R2', 'White #2', 'Blue #2', 'Ginsan'] },
    { cat: 'steel', why: 'HAP40 is a powder high-speed steel — its edge retention is legendary, but it is stubborn to sharpen.', scenario: 'Which steel is famous for near-legendary edge retention but is very stubborn to sharpen?', answer: 'HAP40', options: ['HAP40', 'White #1', 'Ginsan', 'VG10'] },
    { cat: 'steel', why: 'ZDP-189 reaches extreme hardness for huge edge retention, but low toughness means it chips if abused.', scenario: 'Which super-hard powder steel offers extreme edge retention but low toughness (chips if abused)?', answer: 'ZDP-189', options: ['ZDP-189', 'Aogami #2', 'White #2', 'Ginsan'] },
    { cat: 'steel', why: 'Reactive steels are carbon steels: they patina and can rust, so they need drying and oiling.', scenario: 'A knife marked "reactive" is most likely made of which type of steel?', answer: 'Carbon steel', options: ['Carbon steel', 'VG10 stainless', 'Ginsan stainless', 'SG2 powder stainless'] },
    { cat: 'steel', why: 'Aogami Super holds an edge about as long as premium powder stainless, while still being a carbon steel.', scenario: 'Which carbon steel holds an edge about as long as a premium stainless powder steel?', answer: 'Aogami Super', options: ['Aogami Super', 'White #2', 'White #1', 'Ginsan'] },
    { cat: 'steel', why: 'White #2 trades a little ultimate keenness for more toughness, making it more forgiving than White #1.', scenario: 'Between White #1 and White #2, which is slightly tougher and more forgiving?', answer: 'White #2', options: ['White #2', 'White #1', 'Neither — they are identical', 'Both are stainless'] },
    { cat: 'steel', why: 'Corrosion resistance is how well a steel shrugs off rust — highest in stainless steels like VG10.', scenario: 'Which property describes how well a steel resists rust and corrosion?', answer: 'Corrosion resistance', options: ['Corrosion resistance', 'Edge retention', 'Toughness', 'Hardness (HRC)'] },
    { cat: 'steel', why: 'Harder, higher-HRC steels hold an edge longer but become more brittle — they trade away toughness.', scenario: 'A very hard, high-HRC steel typically trades away which property?', answer: 'Toughness (chip resistance)', options: ['Toughness (chip resistance)', 'Edge retention', 'Sharpness', 'Corrosion resistance'] }
  ]
};
