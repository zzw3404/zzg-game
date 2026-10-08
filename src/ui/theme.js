// Presentation metadata only. Level IDs, encounters and combat data remain the game's source of truth.
export const BRAND = { name: '余烬誓约', en: 'EMBER OATH', tagline: '以余烬为证，向黑暗前行。' };
export const REGIONS = {
  steppe: { title: '灰烬荒原', en: 'ASHEN MARCH', tagline: '落日之下，旧日誓言仍在燃烧。' },
  bamboo: { title: '雨夜密林', en: 'THE NIGHTWOOD', tagline: '循着雷光，穿过密林。' },
  town: { title: '暮光市镇', en: 'DUSKFALL', tagline: '灯火将熄，守住最后的街道。' },
  hollow: { title: '枯林圣堂', en: 'HOLLOW CHAPEL', tagline: '穿过断墙，揭开祭坛的秘密。' },
  citadel: { title: '石闸堡', en: 'STONEGATE', tagline: '整备行装，选择下一段旅程。' },
};

const LABELS = {
  '风起': ['荒原伏兵', 'Raiders of the March'],
  '草动': ['围攻', 'The Encirclement'],
  '枪林': ['黑铁战阵', 'The Iron Vanguard'],
  '剑鸣': ['失誓者', 'The Oathbreaker'],
  '云散': ['余烬将熄', 'Fading Embers'],
  '雁回': ['归途', 'The Return'],
  '长风': ['最后的誓约', 'The Last Oath'],
  '夜雨': ['雨中伏击', 'Ambush in the Rain'],
  '竹影': ['密林猎手', 'Hunters in the Dark'],
  '惊雷': ['雷霆战线', 'The Thunderfront'],
  '断岳': ['黑铁卫队', 'The Iron Guard'],
  '夜枭': ['夜幕刺客', 'The Nightstalker'],
  '灯市': ['市镇危机', 'Duskfall Under Siege'],
  '惊鸿': ['突袭', 'The Raid'],
  '檐上': ['高处的威胁', 'Death from Above'],
  '戏台': ['决战广场', 'Duel in the Square'],
  '寒山客': ['流亡剑士', 'The Exiled Blade'],
  '断刀客': ['失誓骑士', 'The Oathless Knight'],
};
export function displayLabel(title, sub = '') {
  const label = LABELS[title];
  return label ? { title: label[0], sub: label[1] } : { title, sub };
}
