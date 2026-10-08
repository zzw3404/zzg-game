# 余烬冲锋 · Ember Charge

原创凯尔特风格战斗配乐试听。约 82 秒，6/8 拍，四分音符 = 144 BPM，D Dorian。

- `ember-charge-preview.mp3`：192 kbps 立体声试听。
- `ember-charge-preview.wav`：44.1 kHz / 16 bit 立体声母带。
- `ember-charge.mid`：可编辑音符与节奏；GM 乐器是替代音色，不等同于 WAV 中的合成音色。
- `score.json`、`render-report.json`：编曲事件、段落时间与音频检查结果。

哨笛、双弦拨弦与战鼓均由脚本合成，没有使用已有歌曲或第三方演奏采样。旋律由本次任务编写。
试听编曲包含开头和收尾。游戏使用主体 32 小节的 40 秒循环版本，位于 public/assets/music/。
重做请运行 `tools/audio/render-celtic-battle.py`。依赖 numpy、scipy、soundfile、mido、imageio-ffmpeg。
