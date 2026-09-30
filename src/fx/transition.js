// Paw-shaped iris wipe between scenes (like the show's transitions).
const PAW = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#000">' +
  '<ellipse cx="50" cy="66" rx="24" ry="20"/><ellipse cx="22" cy="42" rx="10" ry="13" transform="rotate(-20 22 42)"/>' +
  '<ellipse cx="40" cy="26" rx="10" ry="13" transform="rotate(-6 40 26)"/><ellipse cx="60" cy="26" rx="10" ry="13" transform="rotate(6 60 26)"/>' +
  '<ellipse cx="78" cy="42" rx="10" ry="13" transform="rotate(20 78 42)"/></g></svg>')}")`;

const el = document.createElement('div');
el.className = 'iris';
el.style.setProperty('--paw', PAW);
document.body.append(el);

let busy = false;
const frame = () => new Promise((r) => requestAnimationFrame(r));

function run(from, to, ms, easing) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      const k = easing(p);
      el.style.setProperty('--s', `${from + (to - from) * k}vmax`);
      if (p < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** Close the paw iris, run `swap` (build the next scene) while covered, then open it again. */
export async function pawWipe(swap) {
  if (busy) return false;
  busy = true;
  el.classList.add('on');
  el.classList.remove('full');
  await run(320, 0, 520, (t) => t * t);
  el.classList.add('full');
  await swap();
  await frame(); await frame(); // let the new scene render once while covered
  el.classList.remove('full');
  await run(0, 320, 700, (t) => 1 - Math.pow(1 - t, 3));
  el.classList.remove('on');
  busy = false;
  return true;
}
export const wiping = () => busy;
