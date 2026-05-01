import { ftexts, setFtexts } from '../core/state.js';

export function chat(text, type = 'info') {
  const d = document.createElement('div');
  d.className = 'ln ' + type;
  d.textContent = text;
  const log = document.getElementById('chatlog');
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  while (log.children.length > 120) log.removeChild(log.firstChild);
}

export function ftext(sx, sy, text, color, dur = 900) {
  ftexts.push({ sx, sy, text, color, dur, t: 0 });
}
