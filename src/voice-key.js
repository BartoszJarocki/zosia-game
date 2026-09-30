// Stable file name for a spoken line (shared by the game and the clip generator).
export function voiceKey(text, voiceId = '', model = '') {
  const s = `${voiceId}|${model}|${text.trim()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Clip key for the current voice setup: changing voice, model or settings re-records everything. */
export const clipKey = (text, cfg) => voiceKey(text, cfg.voiceId, `${cfg.voiceModel}|${JSON.stringify(cfg.voiceSettings || {})}`);
