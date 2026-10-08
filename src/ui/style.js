// Dark steel, parchment lettering and heraldic details. DOM/event contracts stay compatible with gameplay.
export const HUD_CSS = /* css */`
.wx{position:absolute;inset:0;overflow:hidden;pointer-events:none;user-select:none;color:#e9deca;
 --ink:#e9deca;--ink-hi:#fff0d5;--ink-dim:#ada391;--verm:#b85e3f;--verm-hi:#ef9b62;--sumi:#11151a;--gold:#d7b779;
 --f-serif:'Noto Serif SC','Microsoft YaHei',serif;--f-latin:'Cormorant Garamond',Georgia,serif;--f-brush:var(--f-serif);
 --ease-ink:cubic-bezier(.22,.61,.36,1);--ease-brush:var(--ease-ink);font-family:var(--f-serif);-webkit-font-smoothing:antialiased}
.wx *,.wx *:before,.wx *:after{box-sizing:border-box}.wx i{font-style:normal}.wx .lyr{position:absolute;inset:0;pointer-events:none}
.wx .m{mask-repeat:no-repeat;mask-size:100% 100%;mask-position:center}.wx .seal{display:block;object-fit:contain;filter:drop-shadow(0 3px 12px #0008)}
.wx .play{opacity:0;transition:opacity .35s}.wx[data-state=playing] .play{opacity:1}.wx[data-state=paused] .play{opacity:.18}
/* Player: small steel frame, red vitality, amber mana, three readable spell slots. */
.wx .vitals{position:absolute;left:clamp(18px,3.2vw,56px);bottom:clamp(18px,4vh,44px);display:flex;align-items:center;gap:14px;
 --s:1;padding:14px 18px 14px 12px;border:1px solid #a084514a;background:linear-gradient(110deg,#11151af2,#11151ac2);box-shadow:0 8px 28px #0004}
.wx .vitals:after{content:'';position:absolute;inset:4px;border:1px solid #c2a77418;pointer-events:none}
.wx .focus{position:relative;width:64px;height:64px;flex:none;--f:0}
.wx .focus>*{position:absolute;inset:0}.wx .focus .rt{border:2px solid #ad93693f;border-radius:50%}
.wx .focus .r{background:conic-gradient(from 0deg,#dabb7c calc(var(--f)*100%),transparent 0);border-radius:50%;mask:radial-gradient(transparent 63%,#000 65%,#000 71%,transparent 73%)}
.wx .focus .g{display:grid;place-items:center;font:24px/1 Georgia,serif;color:#d7b779;text-shadow:0 0 16px #d5954530}
.wx .focus .g:after{content:'法力';position:absolute;bottom:10px;font:9px/1 var(--f-serif);letter-spacing:.16em;color:#ada391}
.wx .focus .wash{inset:12px;background:radial-gradient(#d69f4930,transparent 70%);opacity:var(--f)}
.wx .focus .pulse{border:1px solid var(--gold);border-radius:50%;opacity:0}.wx .focus.fill .pulse{animation:wx-enso-pulse .8s ease-out}
.wx .focus.full .g{color:#fff0c9;text-shadow:0 0 14px #ffd383}.wx .focus.full .r{filter:drop-shadow(0 0 5px #dbb471)}
.wx .vital-stack{width:330px}.wx .vital-caption{display:flex;justify-content:space-between;margin-bottom:7px;color:#bdad90;font-size:10px;letter-spacing:.16em}
.wx .vital-caption small{font:11px/1 var(--f-latin);letter-spacing:.22em}
.wx .health{position:relative;height:9px;width:100%;border:1px solid #b99a6155;--v:1;--gh:1;overflow:hidden;background:#070a0d}
.wx .health>*{position:absolute;inset:1px}.wx .health .fl{background:linear-gradient(90deg,#71343b,#ba5b50);transform:scaleX(var(--v));transform-origin:left}
.wx .health .gh{background:#d4a67677;transform:scaleX(var(--gh));transform-origin:left}.wx .health.low .fl{animation:wx-low 1s infinite alternate}.wx .health.hit{animation:wx-shake .3s}
.wx .spellbar{display:flex;gap:6px;margin-top:11px}.wx .spell{flex:1;display:grid;grid-template-columns:16px 1fr;gap:3px 4px;padding:6px 7px;
 border:1px solid #c6a66a24;background:#0a0c1066;color:#8c8679;transition:color .2s,border-color .2s}
.wx .spell kbd{font:600 16px/1 var(--f-latin);grid-row:span 2;align-self:center}.wx .spell b{font:500 12px/1.3 var(--f-serif);white-space:nowrap}
.wx .spell i{font:9px/1 var(--f-serif);opacity:.7}.wx .spell.ready{color:#c7b99f}.wx .spell.selected{color:#ead19d;border-color:#d7b7798c;background:linear-gradient(120deg,#634b2538,#11151a);box-shadow:inset 0 -1px #d7b77955}
/* Boss and posture: clean frames instead of painted strokes. */
.wx .boss.play{position:absolute;left:50%;top:30px;transform:translateX(-50%);width:min(480px,46vw);text-align:center;opacity:0;--v:1;--gh:1;--p:0}
.wx .boss.play.on{opacity:1}.wx[data-state]:not([data-state=playing]) .boss.play{opacity:0}
.wx .boss .nm{font:500 23px/1.5 var(--f-serif);letter-spacing:.12em;color:#f1dfb9;text-shadow:0 2px 10px #000}
.wx .boss .sb{font:12px/1.5 var(--f-latin);letter-spacing:.2em;text-transform:uppercase;color:#c5b38f;text-shadow:0 1px 4px #000}
.wx .boss .bar{position:relative;height:11px;margin:9px 0 0;border:1px solid #bb9e665e;background:#0d1016b8;overflow:hidden}
.wx .boss .bar>*{position:absolute;inset:2px}.wx .boss .bar .fl{background:linear-gradient(90deg,#81433d,#d3ad73);transform:scaleX(var(--v));transform-origin:left}
.wx .boss .bar .gh{background:#e5c99a66;transform:scaleX(var(--gh));transform-origin:left}.wx .boss .po{position:relative;height:3px;width:65%;margin:6px auto;background:#05080c88}
.wx .boss .po>*{position:absolute;height:100%;width:calc(50%*var(--p));background:#b87446}.wx .boss .po .a{right:50%}.wx .boss .po .b{left:50%}
.wx .boss.danger .po>*{background:#ffbd77;box-shadow:0 0 7px #dc863b}.wx .boss.broken .po{animation:wx-break .6s}.wx .boss.phase .nm{animation:wx-phase 1.4s}
/* Enemy markers, targeting and feedback, using the existing animation/event hooks. */
.wx .mk{position:absolute;left:0;top:0;width:82px;height:16px;margin:-8px 0 0 -41px;opacity:0;transition:opacity .25s;--v:1;--p:0}
.wx .mk.on{opacity:.85}.wx .mk .tr,.wx .mk .fl{position:absolute;top:0;height:5px;left:0;right:0}
.wx .mk .tr{background:#0e131ace;border:1px solid #baa57555}.wx .mk .fl{background:#d3c0a0;transform:scaleX(var(--v));transform-origin:left;height:3px;top:1px}
.wx .mk .po{position:absolute;top:8px;left:16%;right:16%;height:2px;background:#de945b;transform:scaleX(var(--p))}
.wx .mk .wr,.wx .mk .bk{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);opacity:0;text-shadow:0 0 8px #000;font:bold 22px/1 var(--f-serif);color:#ffb96d;white-space:nowrap}
.wx .mk .bk{font-size:11px;color:#f1dcaf}.wx .mk .wr.go,.wx .mk .bk.go{animation:wx-danger .85s forwards}
.wx .mk .gl{position:absolute;inset:-10px;background:radial-gradient(#ffe4a966,transparent 70%);opacity:0}.wx .mk .gl.go{animation:wx-glint .45s}
.wx .mk .x{display:none}.wx .mk.dead{opacity:0;transition:opacity .6s}
.wx .ret{position:absolute;left:0;top:0;width:48px;height:48px;margin:-24px;opacity:0;transition:opacity .2s}.wx .ret.on{opacity:1}
.wx .ret .e{position:absolute;inset:0;border:1px solid #e0bc76;clip-path:polygon(0 0,35% 0,35% 4%,4% 4%,4% 35%,0 35%,0 0,100% 0,100% 35%,96% 35%,96% 4%,65% 4%,65% 0,100% 0,100% 100%,65% 100%,65% 96%,96% 96%,96% 65%,100% 65%,100% 100%,0 100%,0 65%,4% 65%,4% 96%,35% 96%,35% 100%,0 100%);box-shadow:0 0 4px #000}
.wx .ret .d{position:absolute;top:50%;left:50%;width:3px;height:3px;margin:-1.5px;background:#fff0c2;transform:rotate(45deg)}
.wx .fx{position:absolute;width:80px;height:80px;margin:-40px;opacity:0;pointer-events:none;background:var(--gold);mask:var(--t-splat) center/contain no-repeat}
.wx .fx.tick{width:110px;height:12px;margin:-6px 0 0 -55px;mask:var(--t-tick) center/contain no-repeat}.wx .fx.enso{width:100px;height:100px;margin:-50px;mask:var(--t-enso) center/contain no-repeat}
.wx .fx.sealfx{width:36px;height:42px;margin:0;background:transparent;mask:none}.wx .fx.go{animation:var(--anim) forwards}
.wx .edge{position:absolute;inset:0;background:radial-gradient(ellipse,transparent 50%,#7c242280 100%);opacity:0;--low:0}
.wx .edge.hurt{animation:wx-hurt .9s}.wx .edge.low{opacity:calc(.4*var(--low));animation:wx-lowedge 1.6s ease-in-out infinite alternate}
.wx .qi{position:absolute;inset:0;box-shadow:inset 0 -80px 90px -70px #e99b58;opacity:0}.wx .qi.go{animation:wx-hurt .75s}
/* Encounter notices are compact enough to keep the action visible. */
.wx .banner{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);opacity:0;text-align:center;min-width:300px;padding:18px 40px 15px;white-space:nowrap;background:linear-gradient(100deg,transparent,#10141bd9 18%,#10141bd9 82%,transparent);transition:opacity .35s}
.wx .banner.on{opacity:1}.wx .banner.off{animation:wx-dissolve .8s forwards}.wx .banner .wash{display:none}
.wx .banner .no{font:10px/1.5 var(--f-serif);letter-spacing:.3em;color:#d3b37a}.wx .banner .tt{font:500 clamp(24px,3vw,38px)/1.5 var(--f-serif);letter-spacing:.12em;color:#f0e0bd}
.wx .banner .ru{height:1px;width:160px;margin:7px auto;background:linear-gradient(90deg,transparent,#b99a61,transparent)}
.wx .banner .en{font:12px/1.5 var(--f-latin);text-transform:uppercase;letter-spacing:.18em;color:#b4a285}.wx .banner .seal{position:absolute;width:29px;height:36px;left:50%;top:-25px;transform:translateX(-50%)}
.wx .hint{position:absolute;right:clamp(18px,3.2vw,56px);bottom:clamp(18px,4vh,44px);display:grid;grid-template-columns:auto auto;gap:5px 12px;padding:12px 16px;
 color:#d4c6ad;background:#11151ab8;border-left:1px solid #a0845155;opacity:0;transition:opacity .6s;font-size:11px}.wx .hint.on{opacity:.9}
.wx kbd{font:600 12px/1.4 Georgia,serif;color:#d7b779}.wx .hint span i{display:none}
/* All modal screens share steel framing and restrained transitions. */
.wx .scr{position:absolute;inset:0;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .5s,visibility .5s;z-index:6}
.wx .scr.on{opacity:1;visibility:visible;pointer-events:auto}.wx .shade{position:absolute;inset:0;background:#080b10b8}
.wx .title .shade{background:linear-gradient(90deg,#090d12ed 0%,#0b111acc 35%,#0b111a4d 65%,#0001)}
.wx .title-frame{position:absolute;left:6vw;top:7vh;bottom:9vh;width:min(520px,46vw);border:1px solid #c0a37329;background:linear-gradient(110deg,#171c2280,transparent);box-shadow:inset 0 0 0 5px #03060922}
.wx .title-frame:before,.wx .title-frame:after{content:'';position:absolute;width:22px;height:22px;border-color:#d7b779;border-style:solid;opacity:.75}
.wx .title-frame:before{left:-1px;top:-1px;border-width:1px 0 0 1px}.wx .title-frame:after{right:-1px;bottom:-1px;border-width:0 1px 1px 0}
.wx .title-content{position:absolute;left:9.5vw;top:48%;transform:translateY(-50%);width:min(420px,39vw);text-align:center}
.wx .title .seal{width:70px;height:78px;margin:0 auto 17px}.wx .brand-en{font:600 clamp(34px,4.8vw,70px)/.98 var(--f-latin);letter-spacing:.07em;color:#eee0c3;text-shadow:0 4px 30px #0004}
.wx .brand-cn{font:500 clamp(22px,2.8vw,35px)/1.6 var(--f-serif);letter-spacing:.32em;padding-left:.32em;margin-top:14px;color:#dfc99f}
.wx .title-divider{display:flex;align-items:center;gap:12px;width:78%;margin:24px auto;color:#baa071;font-size:8px}.wx .title-divider i{height:1px;flex:1;background:linear-gradient(90deg,transparent,#b99a6180)}.wx .title-divider i:last-child{transform:scaleX(-1)}
.wx .region-caption{font-size:9px;letter-spacing:.3em;color:#998e7b;margin-bottom:8px}.wx .title .tt{font:500 22px/1.5 var(--f-serif);letter-spacing:.16em;color:#ebdfca}
.wx .title .tg{font:11px/1.8 var(--f-serif);color:#b3a691;margin-top:7px;letter-spacing:.06em}.wx .title .en b{font:12px/2 var(--f-latin);letter-spacing:.2em;color:#9f927a}
.wx .title .en i{display:none}.wx .title .go{display:flex;align-items:center;justify-content:center;margin:31px auto 0;min-height:56px;border:1px solid #c6a76e78;background:linear-gradient(110deg,#91703f22,#d7b77910,#91703f22);cursor:pointer;transition:background .2s,border-color .2s}
.wx .title .go:hover,.wx .title .go:focus-visible{background:#b68f5030;border-color:#edcc8d;outline:1px solid #edcc8d66;outline-offset:4px}
.wx .go b{display:block;font:500 16px/1.6 var(--f-serif);letter-spacing:.16em;color:#ead5af}.wx .go i{display:block;font:9px/1.5 Georgia,serif;letter-spacing:.16em;color:#a8977d}
.wx .title .go .ln{display:none}.wx .title-footer{position:absolute;left:6vw;right:6vw;bottom:4vh;display:flex;justify-content:space-between;color:#af9f825e;font:10px/1 Georgia,serif;letter-spacing:.18em}
.wx .pause .pn{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:flex;gap:42px;width:min(850px,88vw);max-height:88vh;overflow:auto;
 padding:34px 40px;border:1px solid #b99a615e;background:linear-gradient(125deg,#171c22f5,#10141bf5);box-shadow:0 20px 70px #0007}
.wx .pause .hd{flex:0 0 185px;border-right:1px solid #b99a612b;padding-right:24px}.wx .pause .hd span{font:500 36px/1.4 var(--f-serif);letter-spacing:.14em}
.wx .pause .hd small{display:block;font:14px/1.6 var(--f-latin);letter-spacing:.15em;color:#b89d6d;margin-top:7px}.wx .pause-note{font-size:11px;line-height:1.8;color:#998d78;margin-top:25px}
.wx .pause .mn{flex:1;min-width:0}.wx .pause button{appearance:none;background:none;border:0;border-bottom:1px solid #baa57528;color:var(--ink);font-family:inherit;cursor:pointer;width:100%;display:flex;align-items:center;justify-content:space-between;padding:12px 3px;text-align:left}
.wx .pause button b{font-size:17px;font-weight:500;letter-spacing:.1em}.wx .pause button i{font:11px/1 var(--f-latin);letter-spacing:.17em;color:#aa987b}.wx .pause button:hover,.wx .pause button:focus-visible{color:#ffdf9e;background:#ba97520d;outline:none;border-color:#d7b77988}
.wx .vol,.wx .qual{display:flex;align-items:center;gap:12px;margin-top:22px;font-size:12px}.wx .vol>b,.wx .qual>b{font-weight:400;color:#bcad93;min-width:30px}.wx .vol>i,.wx .qual>i{margin-left:auto;font:10px/1 var(--f-latin);letter-spacing:.1em;color:#8f8069}
.wx .sl{position:relative;flex:1;max-width:180px;height:20px;cursor:pointer;--v:.8}.wx .sl .tr,.wx .sl .fl{position:absolute;top:9px;left:0;height:3px;width:100%;background:#9b855344}.wx .sl .fl{background:#d7b779;transform:scaleX(var(--v));transform-origin:left}
.wx .sl:after{content:'';position:absolute;width:7px;height:7px;top:7px;left:calc(var(--v)*100% - 4px);background:#eed7a4;transform:rotate(45deg)}
.wx .qo{padding:5px 8px;border:1px solid #a38c5e30;color:#aaa18e;cursor:pointer;white-space:nowrap;font-size:11px}.wx .qo.on{color:#edce95;border-color:#d7b77990;background:#91703f22}.wx .qo:hover{color:#ffe7bb;border-color:#bba06c}
.wx .qual.chap{flex-wrap:wrap;gap:8px;margin-top:16px}.wx .chap i{display:none}.wx .chap b{width:100%;font-size:10px;letter-spacing:.18em}
.wx .ctl{display:none;grid-template-columns:90px 1fr 90px 1fr;gap:10px 13px;margin-top:20px;padding-top:16px;border-top:1px solid #b99a6133;font-size:11px}
.wx .show-ctl .ctl{display:grid}.wx .ctl span i{display:block;font:10px/1.5 var(--f-latin);color:#968a75}.wx .pause .ft{position:absolute;bottom:3vh;left:0;right:0;text-align:center;font:11px/1.4 var(--f-latin);letter-spacing:.25em;color:#b5a18166}
.wx .end{text-align:center}.wx .end .shade{background:radial-gradient(ellipse at 50% 42%,#151a21e3,#06090deb)}
.wx .end .body{position:absolute;left:5%;right:5%;top:15vh}.wx .end .seal{width:80px;height:92px;margin:0 auto 20px}.wx .end .ln{font:500 clamp(26px,4vw,48px)/1.5 var(--f-serif);letter-spacing:.18em;color:#efdaba}.wx .end .ln.sm{font:12px/1.8 var(--f-serif);letter-spacing:.1em;color:#baad95;margin-top:9px}
.wx .end .tr{position:absolute;top:49%;left:5%;right:5%;color:#c7ab79;font:18px/1.5 var(--f-latin);letter-spacing:.16em}.wx .end .tr small{display:block;font-size:10px;color:#7e7669;margin-top:7px}
.wx .end .st{position:absolute;top:60%;left:50%;transform:translateX(-50%);display:flex;gap:55px}.wx .st b{display:block;font:32px/1 var(--f-latin);font-weight:500;color:#ebd7ae}.wx .st i{display:block;font-size:10px;letter-spacing:.12em;color:#a59579;margin-top:8px;white-space:nowrap}
.wx .end .go{position:absolute;top:76%;left:50%;transform:translateX(-50%);width:220px;padding:12px 20px;border:1px solid #c6a76e70;background:#9a75351f;cursor:pointer}
.wx .end .go:hover{background:#af895138;border-color:#edcc8d}.wx .end .go.home{top:88%;padding:6px 16px;border-color:#b99a612b;background:transparent}.wx .end .go.home b{font-size:12px}
.wx .reward{position:absolute;top:70%;left:8%;right:8%;font-size:11px;line-height:1.6;color:#bba77f;letter-spacing:.06em}
.wx .combo{position:absolute;right:5vw;top:34%;opacity:0;display:flex;align-items:baseline;gap:8px;transition:opacity .4s}.wx .combo.on{opacity:1}.wx .combo .n{font:600 50px/1 var(--f-latin);color:#efddba;text-shadow:0 2px 12px #0007}.wx .combo .l{font-size:11px;letter-spacing:.1em;color:#c4b291}.wx .combo.hot .n{color:#eebf76}.wx .combo.pop{animation:wx-combo .22s}
@keyframes wx-shake{20%,60%{transform:translateX(-3px)}40%,80%{transform:translateX(3px)}}
@keyframes wx-low{to{filter:brightness(1.5)}}@keyframes wx-lowedge{to{opacity:calc(.7*var(--low))}}
@keyframes wx-hurt{0%,100%{opacity:0}18%{opacity:.85}}@keyframes wx-glint{10%{opacity:1}100%{opacity:0}}
@keyframes wx-danger{0%{opacity:0}12%,65%{opacity:1}100%{opacity:0}}@keyframes wx-enso-pulse{15%{opacity:1}100%{opacity:0;transform:scale(1.4)}}
@keyframes wx-tick{15%{opacity:1;transform:var(--tf)}100%{opacity:0;transform:var(--tf) scaleX(1.2)}}
@keyframes wx-splat{10%{opacity:.8;transform:var(--tf) scale(.8)}100%{opacity:0;transform:var(--tf) scale(1.1)}}
@keyframes wx-ensofx{15%{opacity:.9;transform:var(--tf) scale(.6)}100%{opacity:0;transform:var(--tf) scale(1.2)}}
@keyframes wx-sealfx{15%,65%{opacity:1}100%{opacity:0}}@keyframes wx-dissolve{to{opacity:0;transform:translate(-50%,-60%)}}
@keyframes wx-phase{20%{color:#ffc88d;text-shadow:0 0 16px #ff9f59}100%{color:#f1dfb9}}@keyframes wx-break{to{opacity:0;transform:scaleX(1.2)}}
@keyframes wx-breathe{50%{opacity:.5}}@keyframes wx-combo{0%{transform:scale(1.15)}100%{transform:scale(1)}}
@media(max-width:1000px){.wx .hint{display:none}.wx .vital-stack{width:300px}.wx .pause .pn{gap:25px;padding:28px}.wx .pause .hd{flex-basis:150px}.wx .ctl{grid-template-columns:85px 1fr}}
@media(max-width:600px){.wx .title-frame{left:5vw;right:5vw;width:auto;top:5vh;bottom:8vh}.wx .title-content{left:12vw;width:76vw}.wx .brand-en{font-size:48px}.wx .brand-cn{font-size:29px}.wx .title .shade{background:#090d12d6}
 .wx .vitals{left:12px;bottom:14px;padding:9px;gap:8px}.wx .focus{width:50px;height:50px}.wx .vital-stack{width:min(280px,68vw)}.wx .spell{padding:5px}.wx .spell b{font-size:10px}
 .wx .pause .pn{width:90vw;flex-direction:column;gap:14px;padding:22px}.wx .pause .hd{flex-basis:auto;border-right:0;border-bottom:1px solid #b99a6133;padding:0 0 12px}.wx .pause .hd span{font-size:25px}.wx .pause-note{display:none}.wx .pause .hd small{font-size:11px;margin-top:0}
 .wx .end .st{gap:30px}.wx .boss.play{width:75vw;top:18px}.wx .boss .nm{font-size:18px}.wx .banner{min-width:240px;padding:14px 25px}.wx .title-footer span:last-child{display:none}}
@media(max-height:600px) and (orientation:landscape){.wx .title-content{top:49%}.wx .title .seal{width:32px;height:36px;margin-bottom:5px}.wx .brand-en{font-size:36px}.wx .brand-cn{font-size:21px;margin-top:5px}.wx .title-divider{margin:10px auto}.wx .title .tg{display:none}.wx .title .go{margin-top:10px;min-height:44px}.wx .title .tt{font-size:18px}
 .wx .end .body{top:8vh}.wx .end .seal{width:42px;height:48px;margin-bottom:10px}.wx .end .tr{top:45%;font-size:14px}.wx .end .st{top:57%}.wx .st b{font-size:25px}.wx .reward{top:71%;font-size:10px}.wx .end .go{top:79%;padding:7px}.wx .end .go.home{top:90%;padding:3px}.wx .end .go.home i{display:none}}
@media(prefers-reduced-motion:reduce){.wx *,.wx *:before,.wx *:after{animation-duration:.01s!important;animation-delay:0s!important;transition-duration:.01s!important}}
`;
