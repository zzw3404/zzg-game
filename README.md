# 余烬誓约 · ZZG Game

这是目前在本地使用的西幻动作游戏定制版本。源代码、模型、动画、地图贴图和两首原创音乐均包含在仓库中，克隆后可以本地运行。

基于 [jbang2004/long-wind](https://github.com/jbang2004/long-wind) 改造，保留原项目署名、LICENSE 和素材说明。原项目介绍及完整开发记录见 [PROJECT-HISTORY.md](PROJECT-HISTORY.md)。

## 当前版本

- 默认从主城 **石闸堡 Stonegate** 开始，可以移动、进入商店、购买装备与药剂。
- 主城四门通往灰烬荒原、雨夜密林、暮光市镇和枯林圣堂；胜利后返回主城。
- 西幻风格的加载页、HUD、菜单、商店与关卡界面。
- 三种可通过数字键 1 / 2 / 3 选择的火系法术：火柱、六发火球和火焰剑气。
- 石材质的破败教堂，四轮按区域触发的敌人战斗，以及地图/门洞/建筑的碰撞修正。
- 重甲单手刀敌人使用上传的板甲骑士模型，已经绑定动画骨骼并放大。
- 两首原创凯尔特风格配乐自动切换：主城用竖琴、鲁特琴、长笛；战斗用哨笛、鲁特琴、战鼓。
- 装备、银两、药剂及通关奖励使用浏览器 localStorage 保存。

## 本地运行

使用 Node.js 22.12 或更高版本（也可使用 Node.js 24），然后运行：

~~~powershell
git clone https://github.com/zzw3404/zzg-game.git
cd zzg-game
npm ci
npm run dev
~~~

打开 **http://127.0.0.1:5173/**，默认进入主城。Windows 也可以双击根目录的 **start-game.cmd**。

浏览器需要一次点击、触屏或按键才能开始播放音频；进入主城后按移动键即可。

## 操作

| 按键 | 动作 |
|---|---|
| WASD / 鼠标 | 移动 / 转动视角 |
| 鼠标左键 / 按住左键 | 轻攻击 / 蓄力重击 |
| 鼠标右键 | 格挡与弹反 |
| Space / Shift | 闪避 / 疾跑 |
| F / Q 或 Tab | 拔剑收剑 / 锁定 |
| 1 / 2 / 3 | 选择火系法术 |
| E | 施法；主城靠近商店或城门时交互 |
| Esc | 暂停、音量、画质与关卡菜单 |

## 代码与素材位置

| 路径 | 内容 |
|---|---|
| src/ | 完整游戏源代码 |
| src/audio/music.js | 主城/战斗曲加载、循环和渐变切换 |
| src/game/spells.js | 三种法术的配置 |
| src/levels/、src/world/ | 五个区域、场景建模、材质与碰撞 |
| public/assets/models/ | 主角与所有敌人模型，包括定制重甲骑士 |
| public/assets/anims/mixamo.glb | 游戏使用的动作动画 |
| public/assets/music/ | 两首音乐的 OGG 循环文件和 MP3 解码备用文件 |
| public/assets/ph/、public/assets/fx/、public/assets/ui/ | 场景贴图/石块、火焰贴图和 UI 素材 |
| audio-previews/ | 两首音乐的完整试听、WAV 母带、MIDI 与检查报告 |
| tools/audio/ | 原创音乐生成脚本及 Python 依赖清单 |
| tools/rig-heavy.mjs | 上传重甲模型的骨骼绑定、刀身分离和网格精简脚本 |
| tripo_convert_41c53f10-4275-44d5-a15e-d95289829c2b.glb | 上传的原始模型，保留供重新加工 |

游戏运行和构建直接使用仓库中的素材，不需要现场下载模型或生成音频。

### 重新生成音乐或重甲模型

游戏运行不需要 Python。只有重新渲染音乐时才需要安装 tools/audio/requirements.txt 的依赖：

~~~powershell
python -m pip install -r tools/audio/requirements.txt
python tools/audio/render-stonegate.py
python tools/audio/render-celtic-battle.py
~~~

重新生成重甲骑士模型：

~~~powershell
npm run rig:heavy
~~~

## 测试与构建

~~~powershell
npm test
npm run build
npm run preview
~~~

npm test 包含战斗与法术、地图碰撞、教堂材质及区域战斗的 59 项检查。构建产物位于 dist/。

推送后 GitHub Actions 自动进行测试和构建。GitHub Pages 部署工作流可手动运行；源码同步不要求启用 Pages。

## 来源与素材说明

- 原项目：[jbang2004/long-wind](https://github.com/jbang2004/long-wind)。
- 保留 [LICENSE](LICENSE) 与 [CREDITS.md](CREDITS.md)，模型、动画、字体和场景素材的来源及使用条款说明见 CREDITS.md。
- 两首音乐为本次定制编写的原创旋律与合成乐器音色，没有采用第三方歌曲或演奏录音。
