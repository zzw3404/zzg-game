<div align="center">

# 长风 · Long Wind

**一个在浏览器里运行的实时武侠动作游戏 —— 全部代码由 Claude Opus 5.5 编写，第一版在一天一夜里完成**

*A real-time wuxia action game in the browser. Every line of code written by Claude Opus 5.5 — the first playable version in about a day.*

### [▶ 在线试玩 Play in browser](https://jbang2004.github.io/long-wind/)

<img src="docs/media/steppe.jpg" width="100%" alt="第一章 长风：黄昏草原">

<img src="docs/media/bamboo.jpg" width="49.5%" alt="第二章 竹林夜雨"> <img src="docs/media/town.jpg" width="49.5%" alt="第三章 长街灯火">

</div>

---

## 这是什么

一名剑客，三章旅程，纯 three.js / WebGL，打开网页就能玩，不需要安装。

| 章 | 场景 | Boss |
|---|---|---|
| 一 · 长风 | 黄昏逆光的金色草原，风吹草浪，孤树与石碑 | 断刀客 |
| 二 · 竹林夜雨 | 雨夜竹林，闪电、积水倒影、石灯笼 | 夜枭（会隐身闪现的刺客） |
| 三 · 长街灯火 | 江南古镇长街，五百盏灯笼，河道石桥，会惊慌躲避的市民 | 寒山客 · 戏台前决战 |

战斗：轻重连击、格挡与完美弹反、闪避无敌帧、架势崩溃与处决、剑气、击飞击倒、锁定、弓手/盾兵/枪兵/刺客等不同敌人。

## 它是怎么做出来的

**我没有写代码。** 我只用中文向 Claude Code（Opus 5.5）描述想要什么、试玩、提意见；设计、编码、调试、测试、性能优化都由 AI 完成。Opus 5.5 作为总负责，把工作拆给多个并行的子代理（地形、草、天空、角色、战斗、音频、UI……），用一份接口契约（[CONTRACTS.md](CONTRACTS.md)）和美术圣经（[docs/BIBLE.md](docs/BIBLE.md)）让它们协同，再亲自集成、截图验收、返工。

**真实时间线**（北京时间，来自会话记录）：

| 时间 | 进展 |
|---|---|
| 9/24 17:29 | 第一条提示："用 three.js 参考这个网站的视觉效果，实现一个剑客在草原上战斗的游戏，要求极致的逼真，极致的美学设计" |
| 9/24 晚 | 草原、草浪、天空、后期管线、程序化角色、战斗系统、敌人波次 —— 第一个可玩版本 |
| 9/24 深夜 – 9/25 凌晨 | 反复打磨剑客动作；从一段中国剑演示视频中提取姿态做动作捕捉并重定向到骨骼 |
| 9/25 上午 | 用 Tripo AI 生成角色模型与动画并接入；跳斩、空中翻滚斜劈等招式；第一轮性能优化；敌人模型 |
| 9/25 中午 | 打击感：顿帧、震屏、方向受击、击飞击倒、合成打击音效和喊杀声；逐个角色排查不自然动作 |
| 9/25 下午 | 画质档位、TAA 超分辨率、找出 GC 卡顿根因；关卡系统 + 第二章「竹林夜雨」+ Boss 夜枭 |
| 9/25 21:12 | 第三章「长街灯火」：古镇、河道、市民 AI，第一版完成 |
| 9/26 上午 | 开源，部署在线试玩 |
| 9/27 凌晨 – 上午 | 接入 Mixamo 动作捕捉（主角、全部敌人、市民）；手臂与手腕的解剖修正、空中脚型；手机 / 平板触屏操作 |

第一版合计墙钟约 **28 小时**，其中 AI 实际工作约 **19 小时**；之后仍在继续打磨。

**一些数字**

- 约 **38,000 行** JavaScript / GLSL，151 个源文件，只有一个运行时依赖（three.js）
- 音乐使用两首原创凯尔特风格循环曲；打击声、雨声、雷声、人声、市井喧哗仍由 WebAudio 实时合成
- 地形、草、竹林、古镇建筑、天气、市民都是程序化生成
- 角色动作以 Mixamo 动作捕捉为主：AI 把动作转换、重定向到骨骼，再用 IK 修正手臂、手腕和脚步；部分招式是程序化关键帧
- 30 项无头玩法测试（`npm test`）

**AI 自己查出来的几个有意思的问题**

- *所有敌人一起闪白*：多个敌人共用同一份 GLB 材质，一个被打中，全部变白。改成每个角色克隆材质。
- *打起来就卡顿*：追到根因是 V8 —— three.js 的矩阵数组在加载 GLB 时被"泛化"成通用数组，之后每次矩阵乘法都在分配 HeapNumber，每秒约 80 MB 垃圾。把矩阵存储换成 Float64Array 后分配量降到原来的约 1/4（见 [src/core/matrixFix.js](src/core/matrixFix.js)）。
- *枪兵横扫时枪头插进地里*：两个关键帧方向夹角超过 110°，插值走了"近路"穿过地面。重写了起手方向。

**人做了什么**：提出方向和审美要求、试玩并指出哪里不自然、录了一段参考视频、登录 Tripo 账号并授权 AI 使用额度、登录 Mixamo 账号供 AI 下载动作。

## 操作

### 主城与战斗音乐

- **《石闸暮光 · Stonegate at Dusk》**：舒缓的竖琴、鲁特琴与长笛，3/4 拍、72 BPM。主城、标题、探索与胜利时播放。
- **《余烬冲锋 · Ember Charge》**：哨笛、鲁特琴与战鼓，6/8 拍。敌人波次和 Boss 战时播放。
- 游戏用专门渲染的 80 秒 / 40 秒循环版本，混响与乐器尾音跨循环边界保留；进出战斗渐变切换。
- 曲目位于 `public/assets/music/`，完整试听与可编辑 MIDI 位于 `audio-previews/`。音乐跟随原有总音量、静音、暂停滤波与重击压低背景音乐的控制。
- 浏览器要求先有一次点击、触屏或按键才能播放声音。进入主城后按移动键即可开始。
- 原创编曲和乐器音色均由离线脚本合成，没有使用第三方歌曲或演奏录音。脚本位于 `tools/audio/`；安装该目录 `requirements.txt` 的依赖后，可运行 `render-stonegate.py` 和 `render-celtic-battle.py` 重做音频。游戏运行本身不需要 Python。

| 键 | 动作 | | 键 | 动作 |
|---|---|---|---|---|
| WASD | 移动 | | 鼠标左键 | 斩（按住：重击） |
| 鼠标 | 视角 | | 鼠标右键 | 格挡（命中瞬间：弹反） |
| Space | 闪避 | | Shift | 疾跑 |
| Q / Tab | 锁定 | | 1 / 2 / 3 | 选择火系法术 |
| E | 释放选中法术 | | F | 拔剑 / 收剑 |
| Esc | 暂停（可切换画质与章节） | | | |

**火系法术**：1「三逼火柱」消耗三分之一法术条，主角重击落地后在身边升起三道火柱，敌人接触火柱会受到伤害；2「六逼火粒」消耗三分之二法术条，向前方扇形射出六道小火球，近距离可多发命中；3「九逼火斩」消耗整条法术条，释放带火焰的剑气。九逼火斩命中后仍会施加灼烧：持续 4 秒，每 0.5 秒损失 4 点生命，再次命中只刷新时间。灼烧期间不显示持续燃烧贴图。火焰素材位于 `public/assets/fx/Fire01.png`，法术数值在 `src/game/spells.js` 与 `src/game/combat.js`，视觉尺寸在 `src/fx/fire.js` 调整。

**手机 / 平板**：触屏设备自动显示水墨风格的虚拟按键 —— 左手拇指在屏幕左侧任意位置按下即出现摇杆（推过外圈为疾跑），右侧空白处滑动转视角；右下角：斩（按住蓄力重击）、闪、格（命中瞬间按下弹反）、法术、锁、剑；右上角有 1/2/3 法术选择和暂停。建议横屏游玩。`?touch=1` 强制显示，`?touch=0` 关闭。

**录屏模式**：`H` 隐藏界面 · `O` 环绕运镜 · `T` 慢动作。

常用网址参数：`?level=steppe|bamboo|town` 选章 · `?demo=1` AI 自动战斗（适合录素材）· `?hud=0` 无界面 · `?q=low|med|high` 画质。

**石城 · 中世纪小城（无战斗）**：`?scene=citadel` 进入一座独立的城墙小镇 —— 长方形的城墙、四面各一座带双塔的门楼（东 / 西 / 南 / 北四门，拱券门洞、升起的闸门、敞开的木门）、四角圆塔，城里有十字街与市集广场、半木结构民居、教堂钟塔、公会堂、客栈、铁匠铺、谷仓、水井、市集棚、菜园，还有三十来个赶集闲逛的市民。**这里没有敌人、没有波次，主角收剑入鞘，只在城里走走看看。**

七处"功能建筑"，各有独立的招牌与陈设：

| 建筑 | 位置 | 认得出来的细节 |
|---|---|---|
| 武器商店 | 大街北侧西段 | 货台、遮阳披檐、挂招牌（剑形图案）、门外兵器架、磨刀石、箭杆桶 |
| 护甲商店 | 大街北侧西段 | 石砌底层、盾牌架（圆盾）、胸甲与头盔立架、木桶 |
| 魔药商店 | 大街北侧西段 | 药罐货架、研钵、悬挂草药、门外大锅 |
| 酒馆 | 大街南侧 | 拱形大门、大招牌（酒杯图案）、门外长桌长凳、成堆酒桶、后侧马厩与拴马桩 |
| 教堂 | 西北街区，钟塔朝广场 | 中殿 + 扶壁 + 尖拱窗 + 圆花窗、门廊、钟塔与尖顶（风向标）、围墙墓地与紫杉 |
| 练习场 | 东南街区（夯土场） | 木栏围场、四个草人、三个箭靶、木桩、兵器架与盾架、饮水槽、旗帜 |
| 军队大营 | 东门外大路旁 | 木栅栏营寨、七顶帐篷、营火（三脚架吊锅）、望楼与梯子、军旗、木箱酒桶辎重 |

- `&view=west|east|north|south|street|cross|square|church|wall|aerial|top` 固定机位看图（此时不创建主角）
- `&game=0` 与 `view` 同效；`&crowd=0|N` 市民数量；`&state=title` 从标题页进入（点一下开始逛）
- `&mood=afternoon|golden|ember|blue|night` 时间；黄昏之后城门与广场的火把、各家的窗户会亮起来
- **四门出去是四个副本**（`src/ui/gates.js` 的 `DESTINATIONS` 表）：走出城门再往前约 6–34 米会弹出确认界面
  （目的地名 / 一句风味文本 / `E` 前往 · `Esc` 留下）。确认后保存装备并进入对应场景。
  **主城是中枢：任何一关打完都回城**（不再自动接下一章）—— 胜利页的印章是 `回城 / 返回石闸堡`，
  打过关卡的 5 秒后按任意键同样回城；奖励写在胜利页上（首通给，之后只记通关次数）。失败页也留了一个 `回城`。
  三个副本暂时用原三章演示：**西门 → 长风草原（steppe）**、**北门 → 竹林夜雨（bamboo）**、
  **东门 → 长街灯火（town）**、**南门 → 枯林圣堂（hollow）**。
- **存档**（`src/game/save.js`，localStorage 键 `wx.save`）：银两 / 武器等级 / 护甲 / 伤药 / 各副本通关次数与奖励是否已领。
  进城时自动套用到主角身上，购买与喝药即时写回；清掉存档就等于重开。
- 项目方向转向**西幻**：设定与命名走西幻（石闸堡 Stonegate 是主城，四门通往四个副本），但**界面文字仍是中文**；
  店招与掌柜：兵器铺 · 铁手布兰、甲匠铺 · 锻炉的莫德、药剂铺 · 鹪鹩长老
- 该场景有自己的关卡数据 `src/levels/citadel.js`（只有布局/地形/生物群系，`waves` 为空），不参与三章流程
- **可以进店**：兵器铺 / 甲胄铺 / 药铺 都是能走进去的房子（临街石阶、敞开的门、室内柜台与货架），柜台后有建模的掌柜
  （程序化人物 + Mixamo 待机动作，会转头看你）。走到柜台前 `E` 交谈，面板里 `1/2/3` 购买，`E` 或 `Esc` 离开
- **装备数值是真的生效**：`武器等级` 1→3 使剑招伤害 ×1.0/1.25/1.5/1.8，`护甲` 0→3 减伤 0/15/30/45%，
  `金创药` 按 `G` 服用回血 45（数值在 `src/game/player.js` 的 `gear` / `armourCut` / `weaponMul` / `heal()`）。
  左下角常驻一行 `甲 · 剑 Lv · 药 ×N · 银`；起始 260 文，价格见 `src/ui/shop.js`。`&shops=0` 关掉整套商店系统
- 房屋由 `src/world/citadel-build.js` 这套building kit 生成：墙是带真实洞口的实体（门洞能看进去），
  窗有窗台/窗框/百叶/玻璃，木构架只落在实墙上，悬挑二层压在牛腿上，屋顶是带檐口与山墙的板壳（山墙在
  正确的轴上），烟囱立在屋面上

## 本地运行

打开 `http://127.0.0.1:5173/` 默认进入主城石闸堡，主角出生在城内西侧主街，可以先在商店整备，再从四座城门选择战斗区域。

### 单手刀重甲兵 · 上传的板甲骑士

`bandit_heavy` 已改用 `public/assets/models/enemy-heavy-knight.glb`，持盾兵仍使用自己的模型。骑士身高比例在 `src/character/humanoid.js` 的 `bandit_heavy.scale` 中设为 `1.30`，比之前的 `1.08` 大约增加 20%；骨骼和受击胶囊同步缩放，移动碰撞半径在 `src/game/enemy.js` 中为 `0.6`。上传的短刃随手部动作运动，并沿用原来的有效刀长。

上传的原始 GLB 没有骨骼，且刀与身体是一张网格。`tools/rig-heavy.mjs` 按该骑士的关节位置拆出短刃、近似绑定骨骼并校正为 T 姿势，再接上原有重甲兵动作。模型保留贴图，网格从 411,800 个三角面简化到 87,500 个；转换后的文件约 4.6 MB。这是试用绑定，手指保留原模型的握拳形状。

- 实战：`http://127.0.0.1:5173/?scene=hollow&level=hollow&wave=3&nointro` 直接进入有重甲兵的第三轮。
- 动作预览：`http://127.0.0.1:5173/?scene=anim&mesh=char&kind=bandit_heavy&play=enemyHeavy&view=three&dist=7`。
- 重新转换：在项目根目录运行 `npm run rig:heavy`。脚本读取根目录中上传的原文件，不修改它。

### 枯林圣堂 · 石材与四轮战斗

`http://127.0.0.1:5173/?scene=hollow` 直接进入，也可以从石闸堡南门前往。开始后沿金色目标圆环推进；清完当前轮才解锁下一轮，跨房间时等主角到达再刷敌人。

| 轮次 | 战斗区域 | 敌人 |
|---|---|---|
| 墓园伏兵 | 墓园入口 | 2 名刀匪、1 名枪兵 |
| 断墙围猎 | 圣堂南门前 | 盾兵、刀匪、枪兵、弓手各 1 名 |
| 中殿残影 | 教堂中殿 | 重装刀匪、盾兵、枪兵、弓手各 1 名 |
| 祭坛守誓 | 东端祭坛前 | 枯林守誓者（剑术首领，半血后进入第二阶段） |

战败或暂停菜单重开，会回到当前轮的安全出生点。击败最后的首领后才通关，首通奖励 220 金与 2 瓶治疗药水；胜利页回城。此前已经领取过圣堂奖励的存档保留领取记录。

圣堂专用材质在 `src/world/hollow-mat.js`，使用项目本地已有的 Poly Haven CC0 石墙颜色、法线与 ARM（遮蔽 / 粗糙度）贴图，保留石材颗粒、灰浆凹槽、墙根潮湿及苔痕。关卡配置与敌人出生点在 `src/levels/hollow.js`；墓碑、倒木与碎石生成会避开主要战斗区域。

运行 `npm run test:hollow` 可单独检查圣堂材质、实际地图出生点净空、波次转场、首领通关和重开；这些检查也包含在 `npm test` 中。

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm test         # 玩法测试
npm run build    # 静态站点输出到 dist/
```

推荐桌面版 Chrome / Edge，独立显卡更佳；卡顿时在暂停菜单切到"流畅"。

---

## English

**Long Wind** is a third-person wuxia action game running in the browser (three.js / WebGL, no install). Three chapters — a golden-hour steppe, a bamboo forest in a night storm, and a lantern-lit canal town full of townsfolk who scatter when swords are drawn — with light/heavy combos, parries, dodges, posture breaks and executions, launches and knockdowns, and five enemy types plus bosses.

**No human wrote the code.** The author described what they wanted in Chinese, played the builds, and gave feedback; Claude Opus 5.5 in Claude Code did the design, code, debugging, tests and performance work, coordinating parallel sub-agents through an interface contract ([CONTRACTS.md](CONTRACTS.md)) and an art bible ([docs/BIBLE.md](docs/BIBLE.md)). From the first prompt (Sep 24, 17:29 CST) to the third chapter (Sep 25, 21:12 CST): ~28 hours wall clock, ~19 hours of active agent time for the first version; polishing continued afterwards (motion capture, anatomical arm fixes, touch controls).

- ~38k lines of JS/GLSL in 151 files; one runtime dependency (three.js)
- Zero audio files: music, impacts, rain, thunder, voices and crowd noise are synthesized live with WebAudio
- Terrain, grass, bamboo, the town, weather and townsfolk are procedural
- Character motion is mostly Adobe Mixamo motion capture, converted and retargeted by the agent, with IK fixes for arms, wrists and feet; some moves are procedural keyframes
- Character models were generated with Tripo AI (see [CREDITS.md](CREDITS.md))

**Phones and tablets** get on-screen ink-brush controls: a floating left thumb-stick (push past the rim to sprint), drag on the right to look, and a fan of 斩 strike (hold: heavy) · 闪 dodge · 格 block/parry · 火 fire slash · 锁 lock · 剑 draw buttons; landscape recommended (`?touch=1` forces them, `?touch=0` hides them).

**Record mode:** `H` hides the HUD, `O` orbit camera, `T` slow motion. URL: `?level=steppe|bamboo|town`, `?demo=1` (AI plays), `?hud=0`, `?q=low|med|high`.

**石城 · the walled town (no combat):** `?scene=citadel` loads a standalone medieval town — a rectangular curtain wall with a twin-towered gatehouse in the middle of each side (west, east, north and south: arched passage, raised portcullis, doors folded open), round towers at the corners, two streets crossing at a market square, half-timbered houses, a church with a bell tower, the guild hall, an inn, a smithy, a barn, a well, market stalls and kitchen gardens, plus thirty townsfolk going about their day. No enemies, no waves: the hero keeps his sword sheathed and simply walks. `&view=west|east|north|south|street|cross|square|church|wall|aerial|top` gives fixed camera bookmarks, `&crowd=N`, `&mood=…` (the gate torches and windows light up at dusk), `&state=title`. Its level data is `src/levels/citadel.js` and it is deliberately kept out of the three-chapter journey.

## 地图建模与碰撞

本地新增地图：`?scene=citadel`（石闸堡）、`?scene=hollow`（枯林圣堂）。地图入口、墙体、围栏、柜台和长条障碍采用与模型相同坐标和朝向的碰撞体；地面石板、骨头和低矮装饰保持可通行。圣堂南面的教堂入口与墓园大门、小路相连。

碰撞公共逻辑在 `src/world/collision.js`：圆形适用于树干、圆塔；矩形使用 `shape: 'box'`、半尺寸 `hx/hz`、`yaw`，`y0/y1` 为绝对世界高度。建筑墙片通过 `boxFromBuilder` 同步模型与碰撞，避免漏算平移或旋转。玩家、敌人、村民、相机和植被阻挡都支持这两种形状。快速人物移动沿路径分步处理，避免穿过薄围栏。

运行 `npm test` 检查战斗及地图，或 `npm run test:maps` 单独检查地图的门洞、地形净空、墙体、旋转坐标和快速移动碰撞。继续建模时修改 `src/world/citadel.js`、`src/world/citadel-build.js` 或 `src/world/hollow.js`。

## License

Source code: [MIT](LICENSE). Third-party assets keep their own licenses — the Poly Haven textures/models are CC0; the character models in `public/assets/models/` (generated with Tripo AI) and the motion capture in `public/assets/anims/mixamo.glb` (from Adobe Mixamo) are **not** MIT-licensed. See [CREDITS.md](CREDITS.md).

源代码采用 MIT 协议；角色模型（Tripo AI 生成）和动作捕捉（Adobe Mixamo）不在 MIT 范围内，请勿单独提取或再分发，详见 [CREDITS.md](CREDITS.md)。
