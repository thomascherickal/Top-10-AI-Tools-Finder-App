let TOOLS = [];

/* ══════════════════════════════════════════════════════════════════
   DATABASE PARSER
   ══════════════════════════════════════════════════════════════════ */
async function loadDatabase() {
  try {
    const response = await fetch('tools_db.txt');
    if (!response.ok) {
      throw new Error(`Failed to fetch database: ${response.statusText}`);
    }
    const text = await response.text();
    const blocks = text.split('==================================================');
    const parsedTools = [];
    
    for (const block of blocks) {
      const lines = block.split('\n');
      const tool = {
        reviews: []
      };
      let hasData = false;
      
      for (const line of lines) {
        const trimLine = line.trim();
        if (!trimLine) continue;
        
        const colonIndex = trimLine.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = trimLine.slice(0, colonIndex).trim();
        const value = trimLine.slice(colonIndex + 1).trim();
        
        hasData = true;
        
        if (key === 'ID') tool.id = parseInt(value, 10);
        else if (key === 'NAME') tool.name = value;
        else if (key === 'CATEGORY') tool.category = value;
        else if (key === 'BUDGET') tool.budget = parseFloat(value) || 0;
        else if (key === 'FREE_TIER') tool.freeTier = value.toLowerCase() === 'yes';
        else if (key === 'LATENCY') tool.latency = value;
        else if (key === 'TEAM_SIZE') tool.teamSize = value;
        else if (key === 'URL') tool.url = value;
        else if (key === 'SCORE') tool.score = parseInt(value, 10) || 0;
        else if (key === 'COSTS') tool.costs = value;
        else if (key === 'DESCRIPTION') tool.desc = value;
        else if (key === 'REVIEW_POSITIVE_1') {
          const parts = splitReview(value);
          tool.reviews.push({ type: 'positive', source: parts.source, text: parts.text });
        }
        else if (key === 'REVIEW_POSITIVE_2') {
          const parts = splitReview(value);
          tool.reviews.push({ type: 'positive', source: parts.source, text: parts.text });
        }
        else if (key === 'REVIEW_NEGATIVE_1') {
          const parts = splitReview(value);
          tool.reviews.push({ type: 'negative', source: parts.source, text: parts.text });
        }
      }
      if (hasData && tool.id) {
        parsedTools.push(tool);
      }
    }
    TOOLS = parsedTools;
    return TOOLS;
  } catch (error) {
    console.error('Error loading tools database:', error);
    document.getElementById('rmeta').textContent = '⚠️ Error loading tool database. Ensure you are running on a local server.';
  }
}

function splitReview(reviewStr) {
  const parts = reviewStr.split(':');
  if (parts.length > 1) {
    return {
      source: parts[0].trim(),
      text: parts.slice(1).join(':').trim()
    };
  }
  return {
    source: 'User Review',
    text: reviewStr
  };
}

/* ══════════════════════════════════════════════════════════════════
   SCORING ENGINE
   ══════════════════════════════════════════════════════════════════ */
function scoreTool(t, C) {
  let s = 0;
  const { budget, latency, cats, kw, team, freeOnly } = C;

  // Hard filter: free-only
  if (freeOnly && !t.freeTier) return null;

  // Budget ($200 slider position represents $200+/mo uncapped)
  if (budget < 200 && t.budget > budget) {
    if (!t.freeTier) return null;
    s -= 5; // Free tier bail-out penalty if it's over absolute budget but has free tier
  } else {
    const diff = budget - t.budget;
    s += diff === 0 ? 30 : (diff > 0 && diff <= 20) ? 25 : 18;
  }

  // Latency (25 pts)
  if (latency !== 'Any') {
    const lm = { Low: 3, Medium: 2, High: 1 };
    const tl = lm[t.latency] || 1, wl = lm[latency] || 1;
    if (t.latency === latency) s += 25;
    else if (tl > wl) s += 14;   // Faster than needed
    else s -= 10;
  } else {
    s += 14;
  }

  // Category (hard filter if selection made)
  if (cats.length > 0 && !cats.includes(t.category)) return null;
  s += 20;

  // Keyword (up to 30 pts)
  if (kw && kw.length > 1) {
    const k = kw.toLowerCase();
    const hay = [
      t.name, 
      t.desc, 
      t.category, 
      t.costs,
      t.reviews.map(r => r.text).join(' ')
    ].join(' ').toLowerCase();
    
    // Simple count of hits
    const hits = (hay.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    s += hits === 0 ? -20 : Math.min(hits * 8, 30);
  }

  // Team size (15 pts)
  if (team !== 'Any') {
    if (t.teamSize === 'Any') s += 10;
    else if (t.teamSize === team) s += 15;
    else s -= 5;
  }

  // Free tier bonus on tight budget
  if (budget <= 20 && t.freeTier) s += 5;

  return Math.max(s, 1);
}

/* ══════════════════════════════════════════════════════════════════
   UI HELPERS & RETRIEVERS
   ══════════════════════════════════════════════════════════════════ */
function getRadio(id) {
  for (const b of document.querySelectorAll(`#${id} .rbtn`)) {
    if (b.classList.contains('act')) return b.dataset.v;
  }
  return 'Any';
}

function getCats() {
  const a = [];
  document.querySelectorAll('#cat-g input:checked').forEach(cb => a.push(cb.value));
  return a.length === 12 ? [] : a; // empty array means search all
}

/* ══════════════════════════════════════════════════════════════════
   MODAL MANAGER
   ══════════════════════════════════════════════════════════════════ */
function openToolModal(toolId) {
  const tool = TOOLS.find(t => t.id === toolId);
  if (!tool) return;

  const modal = document.getElementById('tool-modal');
  if (!modal) return;

  // Title and subtitle area
  modal.querySelector('.modal-title').textContent = tool.name;
  modal.querySelector('.modal-subtitle').innerHTML = `
    <span class="cat-pill">${tool.category}</span>
    ${tool.freeTier ? '<span class="free-badge">✓ Free tier available</span>' : ''}
  `;

  // Description
  modal.querySelector('.modal-desc').textContent = tool.desc;

  // Costs details section
  modal.querySelector('#modal-costs').textContent = tool.costs || 'No additional costs details provided.';

  // Metadata Grid
  const metaGrid = modal.querySelector('.modal-grid');
  metaGrid.innerHTML = `
    <div class="modal-meta-item">
      <span class="modal-meta-label">Base Cost</span>
      <span class="modal-meta-value" style="color:var(--amber)">${tool.budget === 0 ? 'Free' : `$${tool.budget}/mo`}</span>
    </div>
    <div class="modal-meta-item">
      <span class="modal-meta-label">Latency</span>
      <span class="modal-meta-value">${tool.latency}</span>
    </div>
    <div class="modal-meta-item">
      <span class="modal-meta-label">Team Support</span>
      <span class="modal-meta-value">${tool.teamSize || 'Any'}</span>
    </div>
    <div class="modal-meta-item">
      <span class="modal-meta-label">Expert Score</span>
      <span class="modal-meta-value" style="color:var(--green)">${tool.score}%</span>
    </div>
  `;

  // Reviews list
  const reviewsContainer = modal.querySelector('#modal-reviews');
  if (tool.reviews && tool.reviews.length > 0) {
    reviewsContainer.innerHTML = tool.reviews.map(r => `
      <div class="review ${r.type === 'positive' ? 'pos' : 'neg'}">
        <div class="rev-meta">
          <span class="rev-type ${r.type === 'positive' ? 'pos' : 'neg'}">${r.type === 'positive' ? '✓ Positive' : '✗ Negative'}</span>
          <span class="rev-source">· ${r.source}</span>
        </div>
        <div class="rev-text">"${r.text}"</div>
      </div>
    `).join('');
  } else {
    reviewsContainer.innerHTML = '<div class="no-rev">No user reviews available yet for this tool.</div>';
  }

  // Call to action button
  const visitBtn = modal.querySelector('.modal-btn-visit');
  visitBtn.href = tool.url;
  visitBtn.innerHTML = `↗ Visit ${tool.name}`;

  modal.showModal();
}

/* ══════════════════════════════════════════════════════════════════
   SEARCH & FILTER LOGIC
   ══════════════════════════════════════════════════════════════════ */
function runSearch() {
  const C = {
    budget: +document.getElementById('bgt').value,
    latency: getRadio('lat-g'),
    team: getRadio('tm-g'),
    cats: getCats(),
    kw: document.getElementById('kw').value.trim(),
    freeOnly: document.getElementById('ft-cb').checked
  };

  const scored = TOOLS
    .map(t => {
      const s = scoreTool(t, C);
      return s !== null ? { t, s } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.s - a.s)
    .slice(0, 10);

  renderResults(scored, C);
}

function resetAll() {
  document.getElementById('bgt').value = 20;
  document.getElementById('bgt-lbl').textContent = '$20/mo';
  document.getElementById('kw').value = '';
  document.getElementById('ft-cb').checked = false;
  document.getElementById('ft-tog').classList.remove('act');
  document.querySelectorAll('.rbtn').forEach(b => b.classList.toggle('act', b.dataset.v === 'Any'));
  document.querySelectorAll('#cat-g .chi').forEach(c => {
    c.classList.add('act');
    c.querySelector('input').checked = true;
  });
  document.getElementById('results').innerHTML = `
    <div class="placeholder">
      <div class="ph-icon">🎯</div>
      <div class="ph-txt">Set your project constraints in the panel<br>and hit <strong style="color:var(--cyan)">Find My Top 10 Tools</strong><br>to get scored, ranked recommendations with real user reviews.</div>
    </div>`;
  document.getElementById('mc').textContent = '—';
  document.getElementById('rmeta').textContent = 'Configure constraints and click Find';
}

/* ══════════════════════════════════════════════════════════════════
   RENDER UI
   ══════════════════════════════════════════════════════════════════ */
const RNKS = ['', '#1 BEST', '#2', '#3', '#4', '#5', '#6', '#7', '#8', '#9', '#10'];
const RCLS = ['', 'rank-gold', 'rank-silver', 'rank-silver', 'rank-bronze', 'rank-bronze', 'rank-bronze', '', '', '', ''];

function renderResults(scored, C) {
  const el = document.getElementById('results');
  document.getElementById('mc').textContent = scored.length;
  document.getElementById('rmeta').textContent = `Scored ${TOOLS.length} tools · top ${scored.length} matches shown · ${new Date().toLocaleTimeString()}`;

  if (!scored.length) {
    el.innerHTML = `
      <div class="placeholder">
        <div class="ph-icon">⚠️</div>
        <div class="ph-txt">No tools match your strict criteria. Try relaxing budget or category filters.</div>
      </div>`;
    return;
  }

  const top = scored[0].s;
  const kw = C.kw.toLowerCase();
  el.innerHTML = `<div class="cards" id="clist"></div>`;
  const list = document.getElementById('clist');

  scored.forEach(({ t, s }, i) => {
    const rank = i + 1;
    const pct = Math.round((s / top) * 100);
    const budget = t.budget === 0 ? 'Free' : `$${t.budget}/mo`;

    // Highlight key use cases (matching search query if any)
    const keywords_list = [t.category, t.latency, t.teamSize + ' Team'];
    const ucs = keywords_list.map(u => {
      const hit = kw && u.toLowerCase().includes(kw);
      return `<span class="uc${hit ? ' hit' : ''}">${u}</span>`;
    }).join('');

    const revHTML = buildReviews(t.reviews);

    const card = document.createElement('div');
    card.className = 'card';
    card.setAttribute('data-id', t.id);
    card.innerHTML = `
      <div class="card-bar" style="width:${pct}%"></div>
      <div class="card-body">
        <div class="card-l">
          <div class="card-top">
            <span class="rank-badge ${RCLS[rank]}">${RNKS[rank]}</span>
            <span class="card-name">${t.name}</span>
            <span class="cat-pill">${t.category}</span>
          </div>
          <div class="card-desc">${t.desc}</div>
          <div class="uc-row">${ucs}</div>
          <a class="card-link" href="${t.url}" target="_blank" rel="noopener" onclick="event.stopPropagation();">↗ ${t.url.replace('https://', '')}</a>
        </div>
        <div class="card-r">
          <span class="match-score">${pct}%</span>
          <span class="match-lbl">Match</span>
          <div class="card-meta">
            <div class="meta-row"><span class="meta-k">Budget</span><span class="meta-v">${budget}</span></div>
            <div class="meta-row"><span class="lat-dot ${t.latency}"></span><span class="meta-k">${t.latency} latency</span></div>
            ${t.freeTier ? '<span class="free-badge">✓ Free tier</span>' : ''}
          </div>
        </div>
      </div>
      <button class="reviews-toggle" onclick="event.stopPropagation(); toggleRevs(this);">
        <span>📣 User Reviews (${t.reviews.length})</span>
        <span class="rev-arrow">▾</span>
      </button>
      <div class="reviews-body">${revHTML}</div>`;
      
    // Add Click listener to open modal popup
    card.addEventListener('click', () => openToolModal(t.id));
    
    list.appendChild(card);
  });
}

function buildReviews(revs) {
  if (!revs || !revs.length) return `<div class="no-rev">No reviews found for this tool.</div>`;
  return revs.map(r => `
    <div class="review ${r.type === 'positive' ? 'pos' : 'neg'}">
      <div class="rev-meta">
        <span class="rev-type ${r.type === 'positive' ? 'pos' : 'neg'}">${r.type === 'positive' ? '✓ Positive' : '✗ Negative'}</span>
        <span class="rev-source">· ${r.source}</span>
      </div>
      <div class="rev-text">"${r.text}"</div>
    </div>`).join('');
}

window.toggleRevs = function(btn) {
  const body = btn.nextElementSibling;
  const arrow = btn.querySelector('.rev-arrow');
  const open = body.classList.toggle('show');
  arrow.classList.toggle('open', open);
};

/* ══════════════════════════════════════════════════════════════════
   EXPLORER GRID (ALL 300 TOOLS)
   ══════════════════════════════════════════════════════════════════ */
function renderGrid(cat = 'All') {
  const list = cat === 'All' ? TOOLS : TOOLS.filter(t => t.category === cat);
  const container = document.getElementById('tgrid');
  
  container.innerHTML = list.map(t => {
    const bgt = t.budget === 0 ? 'Free' : `$${t.budget}/mo`;
    const pos = t.reviews.filter(r => r.type === 'positive').length;
    const neg = t.reviews.filter(r => r.type === 'negative').length;
    return `
      <div class="mc" data-id="${t.id}" title="Click to view full explanation, pricing and reviews">
        <div class="mc-name">${t.name}</div>
        <div class="mc-cat">${t.category}</div>
        <div class="mc-row">
          <span class="mc-bgt">${bgt}</span>
          <span class="mc-lat"><span class="lat-dot ${t.latency}"></span>${t.latency}</span>
        </div>
        <div class="mc-rev">👍 ${pos} · 👎 ${neg} reviews</div>
      </div>`;
  }).join('');
  
  // Attach click listener to explorer grid items
  container.querySelectorAll('.mc').forEach(el => {
    el.addEventListener('click', () => {
      const toolId = parseInt(el.getAttribute('data-id'), 10);
      openToolModal(toolId);
    });
  });
}

/* ══════════════════════════════════════════════════════════════════
   INIT & EVENT LISTENERS
   ══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Fetch & Parse database
  await loadDatabase();
  
  // 2. Initialize bottom explorer grid and update counters
  const categoriesList = document.querySelectorAll('#all-cf .cf');
  categoriesList.forEach(btn => {
    const c = btn.getAttribute('data-c');
    const count = c === 'All' ? TOOLS.length : TOOLS.filter(t => t.category === c).length;
    btn.textContent = `${c === 'All' ? 'All' : c} (${count})`;
  });
  
  renderGrid('All');
  
  // 3. Event listeners for inputs
  // Budget live label
  document.getElementById('bgt').addEventListener('input', function () {
    const v = +this.value;
    document.getElementById('bgt-lbl').textContent = v === 0 ? 'Free only' : v >= 200 ? '$200+/mo' : `$${v}/mo`;
  });

  // Radio button selectors
  document.querySelectorAll('.rbtn').forEach(b => {
    b.addEventListener('click', function () {
      this.closest('[id$="-g"]').querySelectorAll('.rbtn').forEach(x => x.classList.remove('act'));
      this.classList.add('act');
    });
  });

  // Checkbox pill button selectors
  document.querySelectorAll('.chi').forEach(c => {
    c.addEventListener('click', function (e) {
      if (e.target.tagName === 'INPUT') return;
      const cb = this.querySelector('input');
      cb.checked = !cb.checked;
      this.classList.toggle('act', cb.checked);
    });
  });

  // Free tier checkbox toggle
  document.getElementById('ft-tog').addEventListener('click', function (e) {
    if (e.target.tagName === 'INPUT') return;
    const cb = document.getElementById('ft-cb');
    cb.checked = !cb.checked;
    this.classList.toggle('act', cb.checked);
  });

  // Search keyword trigger via enter
  document.getElementById('kw').addEventListener('keydown', e => {
    if (e.key === 'Enter') runSearch();
  });

  // Explorer bottom category bar switches
  document.querySelectorAll('#all-cf .cf').forEach(b => {
    b.addEventListener('click', function () {
      document.querySelectorAll('#all-cf .cf').forEach(x => x.classList.remove('act'));
      this.classList.add('act');
      renderGrid(this.dataset.c);
    });
  });

  // Bind main buttons
  document.querySelector('.btn-find').addEventListener('click', runSearch);
  document.querySelector('.btn-reset').addEventListener('click', resetAll);

  // Reusable Native Modal dialog controls
  const modal = document.getElementById('tool-modal');
  if (modal) {
    modal.querySelector('.modal-close').addEventListener('click', () => modal.close());
    modal.addEventListener('click', (e) => {
      const rect = modal.getBoundingClientRect();
      const isInDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!isInDialog) {
        modal.close();
      }
    });
  }
});
