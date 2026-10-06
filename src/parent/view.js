// The grown-ups' page: what she knows (from play), her sessions, and developer tools. Opened with #parent or a
// 3-second press on the badge shelf; never shown during normal play. Anything that erases needs a long press.
import { getSkills, getSessions, levelFor, dev as progressDev } from '../progress.js';
import { SKILLS } from '../learning/events.js';
import { badges, MISSIONS } from '../ui.js';
import * as ui from '../ui.js';
import { CONFIG, showLetter } from '../config.js';
import { LEVELS, ALL_LETTERS, MISSION_INFO, maxLevel } from '../levels/data.js';
import { LETTER_SKILLS, NUMBER_SKILLS, FEW, itemReports, overview, maxNumber, sessionStats, recentChanges, totalAssisted } from './report.js';

import { setDevNext } from './next.js';

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

function sessionsList(recent) {
  if (!recent.length) return '<span class="pv-none">nothing yet</span>';
  return `<ul class="pv-sessions">${recent.slice(-6).reverse().map((s) => {
    const mins = Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000));
    const when = new Date(s.startedAt).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const names = s.missions.map((k) => esc(MISSION_INFO[k]?.title || k)).join(' → ');
    return `<li><b>${esc(when)}</b> · about ${mins} min · ${names}${s.finale ? ' · finale ✓' : ''}${s.early ? ' · wound down early' : ''}</li>`;
  }).join('')}</ul>`;
}

const chips = (list) => (list.length
  ? list.map((x) => `<span class="pv-chip">${esc(label(x.item))} <small>${esc(x.label)} · ${pct(x.mastery)}</small></span>`).join('')
  : '<span class="pv-none">nothing yet</span>');

function changesList(list) {
  if (!list.length) return '<span class="pv-none">nothing yet</span>';
  return `<div class="pv-chips">${list.map((c) => `<span class="pv-chip ${c.delta > 0 ? 'up' : 'down'}">${esc(label(c.item))} <small>${esc(c.label)} · ${pct(c.from)} → ${pct(c.to)}</small></span>`).join('')}</div>`;
}

function devTools() {
  const kinds = Object.keys(MISSIONS);
  return `<details class="pv-dev"><summary>Developer tools</summary>
    <p class="pv-note">For testing. Buttons marked "hold" need a long press (about 1.5 s) so nothing is erased by accident.</p>
    <h3>Mission levels</h3>
    <div class="pv-levels">${kinds.map((k) => `<div><span>${esc(MISSION_INFO[k]?.title || k)}</span>
      <button data-lvl="${k}" data-d="-1">−</button><b data-show="${k}">${levelFor(k)}</b>/${maxLevel(k)}<button data-lvl="${k}" data-d="1">+</button></div>`).join('')}</div>
    <div class="pv-row-btns"><button class="pv-hold" data-act="maxAll">All missions to the top level (hold)</button></div>
    <h3>Next trip to the island</h3>
    <div class="pv-row-btns">
      <button data-next="lost-kitten">Lost kitten</button>
      <button data-next="balloons-escaping">Balloons escaping</button>
      <button data-next="finale">Lookout alarm → finale</button>
    </div>
    <h3>Mastery</h3>
    <div class="pv-row-btns">
      <select class="pv-skill-pick">${SKILLS.map((k) => `<option>${k}</option>`).join('')}</select>
      <input class="pv-item-pick" placeholder="item, e.g. B or 4" size="10">
      <input class="pv-val-pick" type="number" min="0" max="1" step="0.1" value="0.8" style="width:5em">
      <button data-act="setMastery">Set</button>
    </div>
    <h3>Erase</h3>
    <div class="pv-row-btns">
      <button class="pv-hold" data-act="clearMastery">Clear mastery (hold)</button>
      <button class="pv-hold" data-act="clearWorld">Clear the island (hold)</button>
      <button class="pv-hold danger" data-act="reset">Reset all progress (hold)</button>
    </div>
    <p class="pv-done" aria-live="polite"></p>
  </details>`;
}

/** Long press (ms) to run fn; a bar fills while holding, letting go early cancels. */
function holdToConfirm(btn, fn, ms = 1500) {
  let t = null;
  const stop = () => { clearTimeout(t); t = null; btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.style.setProperty('--hold', `${ms}ms`);
    btn.classList.add('holding');
    t = setTimeout(() => { stop(); fn(); }, ms);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
}

function wireDevTools(page, rerender) {
  const done = (msg) => { const p = page.querySelector('.pv-done'); if (p) p.textContent = msg; };
  page.querySelectorAll('[data-lvl]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.lvl;
    const lvl = progressDev.setLevel(k, levelFor(k) + Number(b.dataset.d));
    page.querySelector(`[data-show="${k}"]`).textContent = lvl;
    done(`${MISSION_INFO[k]?.title || k}: level ${lvl}`);
  }));
  page.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => {
    setDevNext(b.dataset.next);
    done(`Next time the island opens: ${b.textContent}. Tap "Back to the game".`);
  }));
  page.querySelector('[data-act="setMastery"]')?.addEventListener('click', () => {
    const skill = page.querySelector('.pv-skill-pick').value;
    const item = page.querySelector('.pv-item-pick').value.trim().toUpperCase();
    const v = Math.max(0, Math.min(1, Number(page.querySelector('.pv-val-pick').value)));
    if (!item) return done('Type an item first (a letter or a number).');
    progressDev.setMastery(skill, item, v);
    done(`${skill} ${item} = ${Math.round(v * 100)}%`);
    rerender();
  });
  const actions = {
    maxAll: () => { Object.keys(MISSIONS).forEach((k) => progressDev.setLevel(k, maxLevel(k))); done('All missions at the top level.'); rerender(); },
    clearMastery: () => { progressDev.clearSkills(); done('Mastery cleared.'); rerender(); },
    clearWorld: () => { progressDev.clearWorld(); done('The island is back to the start.'); },
    reset: () => { progressDev.resetAll(); done('Everything reset.'); rerender(); },
  };
  page.querySelectorAll('.pv-hold').forEach((b) => holdToConfirm(b, actions[b.dataset.act]));
}

export function showParentView({ onClose }) {
  const skills = getSkills();
  const o = overview(skills);
  const nums = Array.from({ length: maxNumber(LEVELS) }, (_, i) => i + 1);
  const got = badges.get();
  const name = esc(CONFIG.childName || 'Your child');
  const sessions = getSessions();
  const ss = sessionStats(sessions);

  const page = document.createElement('div');
  page.className = 'parent-view';
  page.innerHTML = `
    <header class="pv-head">
      <h1>${name}'s progress <small class="pv-build">${esc(ui.buildLabel())}</small></h1>
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
      <div><b>${sessions.count}</b><span>play sessions</span></div>
      <div><b>${ss.avgMinutes == null ? '–' : `${ss.avgMinutes} min`}</b><span>a session, on average</span></div>
      <div><b>${totalAssisted(skills)}</b><span>answers with some help</span></div>
    </section>

    <section class="pv-two">
      <div><h2>Recent sessions</h2>${sessionsList(sessions.recent)}</div>
      <div><h2>Changed lately</h2>${changesList(recentChanges(sessions))}</div>
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

    <section>${devTools()}</section>
  `;
  page.querySelector('.pv-close').addEventListener('click', onClose);
  // after a developer action: redraw the page, keeping the tools open
  wireDevTools(page, () => { const open = page.querySelector('.pv-dev')?.open; page.remove(); const p = showParentView({ onClose }); if (open) p.querySelector('.pv-dev').open = true; p.scrollTop = p.scrollHeight; });
  document.body.appendChild(page);
  return page;
}
