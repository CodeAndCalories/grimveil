import { ftexts, setFtexts } from '../core/state.js';

const ICONS = {
  dmgout: '⚔️', hit: '⚔️', miss: '⚔️', kill: '⚔️', death: '⚔️',
  loot: '🎒',
  lvlup: '✨', skill: '✨', xp: '✨',
  info: '💬', sys: '💬', cook: '💬', bank: '💬', shop: '💬',
};

const FILTER_GROUPS = {
  combat: new Set(['dmgout', 'hit', 'miss', 'kill', 'death']),
  loot:   new Set(['loot']),
  skills: new Set(['skill', 'lvlup', 'xp', 'cook', 'bank', 'shop', 'gather']),
};

let _filter = 'all';

function initFilters() {
  document.querySelectorAll('.logfilter').forEach(btn => {
    btn.addEventListener('click', () => {
      _filter = btn.dataset.filter;
      document.querySelectorAll('.logfilter').forEach(b =>
        b.classList.toggle('active', b.dataset.filter === _filter));
      applyFilter();
    });
  });
}

function applyFilter() {
  const log = document.getElementById('chatlog');
  Array.from(log.children).forEach(el => {
    const t = el.dataset.type || '';
    el.style.display =
      _filter === 'all' || (FILTER_GROUPS[_filter]?.has(t)) ? '' : 'none';
  });
}

let _filtersReady = false;

export function chat(text, type = 'info') {
  if (!_filtersReady) { initFilters(); _filtersReady = true; }

  const icon = ICONS[type] || '💬';
  const d = document.createElement('div');
  d.className = `ln ${type} new`;
  d.dataset.type = type;
  d.textContent = `${icon} ${text}`;

  if (_filter !== 'all' && !FILTER_GROUPS[_filter]?.has(type)) {
    d.style.display = 'none';
  }

  const log = document.getElementById('chatlog');
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  d.addEventListener('animationend', () => d.classList.remove('new'), { once: true });
  while (log.children.length > 120) log.removeChild(log.firstChild);
}

export function ftext(sx, sy, text, color, dur = 900) {
  ftexts.push({ sx, sy, text, color, dur, t: 0 });
}
