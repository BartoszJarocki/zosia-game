// #parent: a read-only page for grown-ups (what she knows, from play). Never shown during normal play.
import { getSkills, levelFor } from '../progress.js';
import { badges, MISSIONS } from '../ui.js';
import { CONFIG, showLetter } from '../config.js';
import { LEVELS, ALL_LETTERS, MISSION_INFO, maxLevel } from '../levels/data.js';
import { LETTER_SKILLS, NUMBER_SKILLS, FEW, itemReports, overview, maxNumber } from './report.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pct = (x) => `${Math.round(x * 100)}%`;
const secs = (s) => (s == null ? '–' : `${s.toFixed(1)} s`);
const label = (item) => (/^\d+$/.test(item) ? item : showLetter(item));

function bar(row) {
  const tip = `${row.attempts}× solved · ${row.firstTryPct}% first try · ${row.assistPct}% with help · ${secs(row.avgLatencyS)}`;
  return `<div class="pv-row${row.few ? ' few' : ''}" title="${esc(tip)}">
    <span class="pv-skill">${esc(row.label)}</span>
    <span class="pv-bar"><i style="width:${Math.round(row.mastery * 100)}%"></i></span>
    <span class="pv-pct">${pct(row.mastery)}</span>
    <span class="pv-meta">${row.attempts}× · ${row.firstTryPct}% first try · ${row.assistPct}% help · ${secs(row.avgLatencyS)}${row.confusions.length ? ` · mixes up with ${row.confusions.map((c) => esc(label(c))).join(', ')}` : ''}</span>
  </div>`;
}

function grid(reports) {
  const seen = reports.filter((r) => r.seen), unseen = reports.filter((r) => !r.seen);
  return `${seen.length ? `<div class="pv-grid">${seen.map((r) => `
    <div class="pv-card"><b class="pv-item">${esc(label(r.item))}</b>${r.rows.map(bar).join('')}</div>`).join('')}</div>` : ''}
    ${unseen.length ? `<p class="pv-unseen"><span class="pv-none">Not practised yet:</span> ${unseen.map((r) => `<b>${esc(label(r.item))}</b>`).join(' ')}</p>` : ''}`;
}

const chips = (list) => (list.length
  ? list.map((x) => `<span class="pv-chip">${esc(label(x.item))} <small>${esc(x.label)} · ${pct(x.mastery)}</small></span>`).join('')
  : '<span class="pv-none">nothing yet</span>');

export function showParentView({ onClose }) {
  const skills = getSkills();
  const o = overview(skills);
  const nums = Array.from({ length: maxNumber(LEVELS) }, (_, i) => i + 1);
  const got = badges.get();
  const name = esc(CONFIG.childName || 'Your child');

  const page = document.createElement('div');
  page.className = 'parent-view';
  page.innerHTML = `
    <header class="pv-head">
      <h1>${name}'s progress</h1>
      <button class="pv-close">Back to the game</button>
    </header>
    <p class="pv-note">Estimates from play, not a test. Mastery moves a little with every answer: right first time without help counts most,
      answers after a clue or a reveal count less. Faded rows have fewer than ${FEW} answers, so there is not much to go on yet.</p>

    <section class="pv-sum">
      <div><b>${o.attempts}</b><span>questions solved</span></div>
      <div><b>${o.firstTryPct}%</b><span>right first time</span></div>
      <div><b>${o.assistPct}%</b><span>needed some help</span></div>
      <div><b>${secs(o.avgLatencyS)}</b><span>average answer time</span></div>
      <div><b>${o.familiar}</b><span>items she knows well</span></div>
    </section>

    <section><h2>Missions</h2><div class="pv-missions">${Object.keys(MISSIONS).map((k) => `
      <div class="pv-mission"><span>${esc(MISSION_INFO[k]?.title || k)}</span>
        <span class="pv-stars">${'★'.repeat(levelFor(k))}<i>${'★'.repeat(Math.max(0, maxLevel(k) - levelFor(k)))}</i></span>
        <small>${got[k] || 0} badge${got[k] === 1 ? '' : 's'}</small></div>`).join('')}</div></section>

    <section class="pv-two">
      <div><h2>Worth practising</h2><div class="pv-chips">${chips(o.difficult)}</div></div>
      <div><h2>Lately</h2><div class="pv-chips">${chips(o.recent)}</div></div>
    </section>

    <section><h2>Letters</h2>${grid(itemReports(skills, LETTER_SKILLS, [...ALL_LETTERS]))}</section>
    <section><h2>Numbers</h2>${grid(itemReports(skills, NUMBER_SKILLS, nums))}</section>
  `;
  page.querySelector('.pv-close').addEventListener('click', onClose);
  document.body.appendChild(page);
  return page;
}
