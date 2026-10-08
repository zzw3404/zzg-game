// Fantasy presentation, sharing the original HUD selectors and combat events.
import { BRAND } from './theme.js';
import { SPELLS } from '../game/spells.js';
export const numeral = n => String(n);
export const WAVES = [
  { tt: '荒原伏兵', en: 'Raiders of the March' },
  { tt: '围攻', en: 'The Encirclement' },
  { tt: '黑铁战阵', en: 'The Iron Vanguard' },
  { tt: '失誓者', en: 'The Oathbreaker' },
];
export const BOSS_WAVE = { no: '最终遭遇', tt: '最后的誓约', en: 'The Last Oath' };
export const WAVE_EN = { '区域肃清': 'Area secured' };
export const BOSS_NAMES = {
  swordmaster: { name: '流亡剑士', sub: 'The Exiled Blade' },
  boss: { name: '流亡剑士', sub: 'The Exiled Blade' },
  bandit_heavy: { name: '黑铁重装卫兵', sub: 'The Iron Guard' },
  assassin: { name: '夜幕刺客', sub: 'The Nightstalker' },
};
export const CONTROLS = [
  ['W A S D', '移动', 'move'], ['Mouse', '视角', 'look'],
  ['LMB', '攻击', 'attack'], ['Hold LMB', '重击', 'heavy attack'],
  ['RMB', '格挡', 'block · timed parry'], ['Space', '闪避', 'dodge'],
  ['Shift', '奔跑', 'sprint'], ['Q · Tab', '锁定', 'lock on'],
  ['1 / 2 / 3', '选择法术', 'select spell'], ['E', '施法', 'cast spell'],
  ['F', '拔剑 / 收剑', 'draw · sheathe'], ['Esc', '暂停', 'pause'],
];
export const HINT = [0, 2, 4, 5, 8, 9];
export const VICTORY = {
  lines: ['契约完成', '黑暗暂歇，余烬未熄。'],
  en: 'CONTRACT FULFILLED', src: 'EMBER OATH', go: ['再次挑战', 'challenge again'],
};
export const DEFEAT = {
  lines: ['誓约未竟', '重燃余烬，再赴战场。'],
  en: 'THE OATH ENDURES', src: 'EMBER OATH', go: ['重新挑战', 'try again'],
};
const esc = s => String(s).replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const FILTERS = '';
export const HUD_HTML = `
<div class="lyr marks"></div><div class="lyr fxl"></div><div class="edge"></div><div class="qi"></div>
<div class="play vitals">
  <div class="focus" aria-label="法力"><div class="wash"></div><div class="rt m"></div><div class="r m"></div><div class="pulse m"></div><div class="g">◆</div></div>
  <div class="vital-stack">
    <div class="vital-caption"><span>生命</span><small>VITALITY</small></div>
    <div class="health" aria-label="生命值"><div class="tr m"></div><div class="gh m"></div><div class="fl m"></div></div>
    <div class="spellbar" aria-label="火系法术">${[1,2,3].map(i => `<div class="spell${i === 1 ? ' selected' : ''}" data-spell="${i}"><kbd>${i}</kbd><b>${SPELLS[i].name}</b><i>${['','⅓','⅔','全部'][i]}</i></div>`).join('')}</div>
  </div>
</div>
<div class="play boss"><div class="nm"></div><div class="sb"></div><div class="bar"><div class="tr m"></div><div class="gh m"></div><div class="fl m"></div></div><div class="po"><div class="a m"></div><div class="b m"></div></div></div>
<div class="ret"><div class="e m"></div><div class="d"></div></div>
<div class="banner"><div class="wash"></div><div class="no"></div><div class="tt"></div><div class="ru m"></div><div class="en"></div><img class="seal" alt=""></div>
<div class="hint">${HINT.map(i => `<kbd>${CONTROLS[i][0]}</kbd><span>${CONTROLS[i][1]}<i>${CONTROLS[i][2]}</i></span>`).join('')}</div>
<div class="scr title">
  <div class="shade"></div><div class="title-frame"></div>
  <div class="title-content">
    <img class="seal" alt="火焰盾徽">
    <div class="brand-en">${BRAND.en}</div><div class="brand-cn">${BRAND.name}</div>
    <div class="title-divider"><i></i><span>◆</span><i></i></div>
    <div class="col"><div class="region-caption">远征目的地</div><div class="tt">灰烬荒原</div><div class="tg">${BRAND.tagline}</div></div>
    <div class="en"><b>ASHEN MARCH</b><i></i></div>
    <div class="go" role="button" tabindex="0" aria-label="开始冒险"><div class="ln m"></div><div class="t"><b>开始冒险</b><i>CLICK OR ENTER TO BEGIN</i></div><div class="ln r m"></div></div>
  </div>
  <div class="title-footer"><span>REAL-TIME ACTION RPG</span><span>以余烬为证</span></div>
</div>
<div class="scr pause"><div class="shade"></div><div class="pn">
  <div class="hd"><span>暂停</span><small>THE CAMPFIRE</small><div class="pause-note">整备片刻，再赴旅程。</div></div>
  <div class="mn">
    <button data-act="resume"><b>继续旅程</b><i>RESUME</i></button>
    <button data-act="restart"><b>重新挑战</b><i>RESTART</i></button>
    <button data-act="controls"><b>操作指南</b><i>CONTROLS</i></button>
    <div class="vol"><b>音量</b><div class="sl"><div class="tr m"></div><div class="fl m"></div></div><i>VOLUME</i></div>
    <div class="qual"><b>画质</b><span class="qo" data-q="low">流畅</span><span class="qo" data-q="med">均衡</span><span class="qo" data-q="high">极致</span><i>QUALITY</i></div>
    <div class="ctl">${CONTROLS.map(([k, zh, en]) => `<kbd>${k}</kbd><span>${zh}<i>${en}</i></span>`).join('')}</div>
  </div>
</div><div class="ft">${BRAND.en} · ${BRAND.name}</div></div>
<div class="scr end victory"><div class="shade"></div><div class="body"></div><div class="tr"></div><div class="st"></div><div class="go" data-act="restart"></div></div>
<div class="scr end defeat"><div class="shade"></div><div class="body"></div><div class="tr"></div><div class="go" data-act="restart"></div><div class="go home" data-act="home"><b>返回城镇</b><i>RETURN TO STONEGATE</i></div></div>`;
export function fillEnding(root, story, crestUrl) {
  root.querySelector('.body').innerHTML = (crestUrl ? `<img class="seal" src="${crestUrl}" alt="">` : '') + story.lines.map((l, i) => `<div class="ln${i ? ' sm' : ''}" style="--i:${i}">${esc(l)}</div>`).join('');
  root.querySelector('.tr').innerHTML = `${story.en}<small>${esc(story.src)}</small>`;
  root.querySelector('.go').innerHTML = `<b>${esc(story.go[0])}</b><i>${esc(story.go[1])}</i>`;
}
export { esc };
