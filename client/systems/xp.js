import { SK, P, CAM } from '../core/state.js';
import { chat, ftext } from '../ui/chat.js';
import { renderSkills } from '../ui/sidebar.js';
import { TS } from '../../shared/constants.js';
import { giveXP as _giveXP } from './SkillSystem.js';

export function giveXP(skill, amt) {
  const { leveledUp, newLevel } = _giveXP(P, skill, amt);
  if (leveledUp) {
    chat(`🎉 Level up! ${SK[skill].label} is now ${newLevel}!`, 'lvlup');
    ftext(P.x * TS - CAM.x + TS / 2, P.y * TS - CAM.y - 14, 'LEVEL UP!', '#f0c050', 2000);
  }
  ftext(P.x * TS - CAM.x + TS / 2 + 10, P.y * TS - CAM.y - 4, `+${amt}xp`, '#38b860', 1000);
  if (document.getElementById('tab-skills').classList.contains('active')) renderSkills();
}
