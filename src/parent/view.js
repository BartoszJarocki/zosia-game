// The grown-ups' page: what she knows (from play), her sessions, and developer tools. Opened with #parent or a
// 3-second press on the badge shelf; never shown during normal play. Anything that erases needs a long press.
import { getSkills, getSessions, levelFor, assistFor, dev as progressDev } from '../progress.js';
import { SKILLS } from '../learning/events.js';
import { badges, MISSIONS } from '../ui.js';
import * as ui from '../ui.js';
import { CONFIG, showLetter } from '../config.js';
import { LEVELS, ALL_LETTERS, MISSION_INFO, maxLevel } from '../levels/data.js';
import { LETTER_SKILLS, NUMBER_SKILLS, COMPARE_SKILLS, COMPARE_ITEMS, FEW, itemReports, overview, maxNumber, sessionStats, recentChanges, totalAssisted, itemLabel, neverAsked, missionStatus } from './report.js';
import { HOME_TASKS } from '../lang/pl.js';
import { weekTaskKinds } from '../session/home-task.js';

import { setDevNext } from './next.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const pct = (x) => `${Math.round(x * 100)}%`;
const secs = (s) => (s == null ? '–' : `${s.toFixed(1)} s`);
const label = (item) => (/^\d+$/.test(item) ? item : showLetter(item));
const SAVE_KEY = 'pup-patrol-progress';
/** The saved progress as stored (for the copy button, and each mission's good runs and last run). */
function readSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } }

function bar(row) {
  const chance = row.chancePct ? ` (a guess: ${row.chancePct}%)` : '';
  const tip = `${row.attempts}× solved · ${row.firstTryPct}% first try${chance} · ${row.assistPct}% with help · ${secs(row.avgLatencyS)}`;
  return `<div class="pv-row${row.few ? ' few' : ''}" title="${esc(tip)}">
    <span class="pv-skill">${esc(row.label)}</span>
    <span class="pv-bar"><i style="width:${Math.round(row.mastery * 100)}%"></i></span>
    <span class="pv-pct">${pct(row.mastery)}</span>
    <span class="pv-meta">${row.attempts}× · ${row.firstTryPct}% first try${chance} · ${row.assistPct}% help · ${secs(row.avgLatencyS)}${row.confusions.length ? ` · mixes up with ${row.confusions.map((c) => esc(label(c))).join(', ')}` : ''}</span>
  </div>`;
}

function grid(reports, name = (r) => label(r.item)) {
  const seen = reports.filter((r) => r.seen), unseen = reports.filter((r) => !r.seen);
  return `${seen.length ? `<div class="pv-grid">${seen.map((r) => `
    <div class="pv-card"><b class="pv-item">${esc(name(r))}</b>${r.rows.map(bar).join('')}</div>`).join('')}</div>` : ''}
    ${unseen.length ? `<p class="pv-unseen"><span class="pv-none">Not practised yet:</span> ${unseen.map((r) => `<b>${esc(name(r))}</b>`).join(' ')}</p>` : ''}`;
}

/** Each mission: its stars, how far to the next one, the last run, whether the next run is gentler. */
function missionCards(got) {
  const saved = readSave()?.missions || {};
  return Object.keys(MISSIONS).map((k) => {
    const m = missionStatus({ level: levelFor(k), max: maxLevel(k), good: saved[k]?.good ?? 0, lastAcc: saved[k]?.lastAcc ?? null, runs: got[k] || 0, need: CONFIG.goodRunsPerLevel, gentle: assistFor(k) });
    return `<div class="pv-mission"><span>${esc(MISSION_INFO[k]?.title || k)}</span>
      <span class="pv-stars">${'★'.repeat(m.level)}<i>${'★'.repeat(Math.max(0, m.max - m.level))}</i></span>
      <small>Level ${m.level} of ${m.max} · ${esc(m.next)}</small>
      <small>${esc(m.last)} · ${m.gentle ? '<b class="pv-gentle">gentle mode on</b> (the last run was hard)' : 'gentle mode off'} · ${got[k] || 0} badge${got[k] === 1 ? '' : 's'}</small></div>`;
  }).join('');
}

/** "Misja w domu": what Chase asked her to do at home this week (the same lines she heard). */
function homeTasks(sessions) {
  const kinds = weekTaskKinds(sessions.recent, HOME_TASKS);
  if (!kinds.length) return '<span class="pv-none">At the end of a session Chase gives her one small thing to do at home. Nothing yet this week.</span>';
  return `<ul class="pv-tasks">${kinds.map((k) => `<li>„${esc(HOME_TASKS[k])}” <small>after ${esc(MISSION_INFO[k]?.title || k)}</small></li>`).join('')}</ul>`;
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
  ? list.map((x) => `<span class="pv-chip">${esc(x.name)} <small>${esc(x.label)} · ${pct(x.mastery)}</small></span>`).join('')
  : '<span class="pv-none">nothing yet</span>');

function changesList(list) {
  if (!list.length) return '<span class="pv-none">nothing yet</span>';
  return `<div class="pv-chips">${list.map((c) => `<span class="pv-chip ${c.delta > 0 ? 'up' : 'down'}">${esc(c.name)} <small>${esc(c.label)} · ${pct(c.from)} → ${pct(c.to)}</small></span>`).join('')}</div>`;
}

function devTools() {
  const kinds = Object.keys(MISSIONS);
  return `<div class="pv-dev" hidden><h2>Developer tools</h2>
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
  </div>`;
}

/** The whole save (progress + badges) as JSON on the clipboard, so a parent can share it. */
async function copyProgress(btn) {
  const text = JSON.stringify({ progress: readSave(), badges: badges.get(), build: ui.buildLabel(), copiedAt: new Date().toISOString() });
  const done = (msg) => { btn.textContent = msg; setTimeout(() => { btn.textContent = 'Copy progress'; }, 2500); };
  try {
    await navigator.clipboard.writeText(text);
    return done('Copied ✓');
  } catch {}
  // no clipboard access: put it in a box, selected, to copy by hand
  const box = document.createElement('textarea');
  box.className = 'pv-copybox';
  box.value = text;
  btn.closest('.pv-head').after(box);
  box.select();
  done(document.execCommand?.('copy') ? 'Copied ✓' : 'Select and copy below');
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
  const never = neverAsked(skills, ALL_LETTERS);

  const page = document.createElement('div');
  page.className = 'parent-view';
  page.innerHTML = `
    <header class="pv-head">
      <h1>${name}'s progress <small class="pv-build">${esc(ui.buildLabel())}</small></h1>
      <span class="pv-head-btns"><button class="pv-copy">Copy progress</button><button class="pv-close">Back to the game</button></span>
    </header>
    <p class="pv-note">Estimates from play, not a test. Mastery moves a little with every answer: right first time without help counts most,
      answers after a clue or a reveal count less. Faded rows have fewer than ${FEW} answers, so there is not much to go on yet.
      "A guess" is how often tapping at random would be right first time on the same questions.</p>

    <section class="pv-sum">
      <div><b>${o.attempts}</b><span>questions solved</span></div>
      <div><b>${o.firstTryPct}%</b><span>right first time (a guess: ${o.chancePct}%)</span></div>
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

    <section><h2>This week, try at home</h2>${homeTasks(sessions)}</section>

    <section><h2>Missions</h2><div class="pv-missions">${missionCards(got)}</div></section>

    <section class="pv-two">
      <div><h2>Worth practising</h2><div class="pv-chips">${chips(o.difficult)}</div></div>
      <div><h2>Lately</h2><div class="pv-chips">${chips(o.recent)}</div></div>
    </section>

    <section><h2>Letters</h2>${never.length ? `<p class="pv-never">Never asked yet: <b>${never.length} of ${ALL_LETTERS.length}</b> letters (${never.map((l) => esc(label(l))).join(' ')}). New letters come in as she levels up.</p>` : ''}
      ${grid(itemReports(skills, LETTER_SKILLS, [...ALL_LETTERS]))}</section>
    <section><h2>Numbers</h2>${grid(itemReports(skills, NUMBER_SKILLS, nums))}</section>
    <section><h2>More, less, the same <small class="pv-build">Pup Picnic</small></h2>${grid(itemReports(skills, COMPARE_SKILLS, COMPARE_ITEMS), (r) => itemLabel('comparison', r.item))}</section>

    <p class="pv-devlink"><button class="pv-link">Developer tools</button></p>
    ${devTools()}
  `;
  page.querySelector('.pv-close').addEventListener('click', onClose);
  page.querySelector('.pv-copy').addEventListener('click', (e) => copyProgress(e.currentTarget));
  const tools = page.querySelector('.pv-dev');
  page.querySelector('.pv-link').addEventListener('click', () => { tools.hidden = !tools.hidden; if (!tools.hidden) tools.scrollIntoView({ behavior: 'smooth' }); });
  // after a developer action: redraw the page, keeping the tools open
  wireDevTools(page, () => { const open = !tools.hidden; page.remove(); const p = showParentView({ onClose }); if (open) p.querySelector('.pv-dev').hidden = false; p.scrollTop = p.scrollHeight; });
  document.body.appendChild(page);
  return page;
}
