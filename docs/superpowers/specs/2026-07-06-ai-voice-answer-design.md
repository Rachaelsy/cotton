# AI Voice Answer Design

## Goal

AI 问答同时支持文字回答和语音回答。文字气泡始终保留；语音播报作为可控能力，服务不会打字、不方便看字的棉农。

## User Experience

- AI 每次回复都先展示文字气泡。
- 语音提问触发的 AI 回复默认自动播报。
- 页面提供一个“语音回答”开关，打开后文字提问也会自动播报 AI 回复。
- 每条 AI 回复提供一个小喇叭操作，用户可手动播放该条回答。
- 播报中再次触发播放会先停止当前音频，避免多段声音叠加。
- 维吾尔语模式暂不自动播报，保留文字回答；当前 WechatSI 语音合成以中文为主。

## Implementation Shape

- `pages/ai/index.js`
  - 新增 `voiceAnswerEnabled` 状态，控制文字提问后的自动播报。
  - 保留语音提问后的 `options.fromVoice` 自动播报逻辑。
  - AI 消息写入 `speakable` 标记，便于 WXML 决定是否展示播放按钮。
  - 新增 `onToggleVoiceAnswer` 切换自动语音回答。
  - 新增 `onReplayAnswer` 手动播放某条 AI 回复。
  - `_speak` 继续使用 WechatSI `textToSpeech`，播放前停止上一段音频。
- `pages/ai/index.wxml`
  - 在底部输入区增加“语音回答”开关。
  - 在 AI 消息气泡下增加小喇叭按钮。
- `pages/ai/index.wxss`
  - 增加紧凑开关和消息操作按钮样式，避免挤压输入框。
- `utils/i18n.js`
  - 增加中文和维吾尔语文案：语音回答、已开启、已关闭、播放回答。

## Error Handling

- 如果 WechatSI 不可用，语音回答开关不阻塞文字问答。
- 如果文本转语音失败，只停止 `speaking` 状态，不影响文字气泡。
- 页面隐藏或卸载时停止当前音频。

## Tests

- 扩展 `server/tests/miniapp-voice.test.js`，检查：
  - 存在 `voiceAnswerEnabled` 状态。
  - 存在 `onToggleVoiceAnswer` 和 `onReplayAnswer`。
  - AI 回复仍写入文字消息。
  - 自动播报条件包含 `options.fromVoice || this.data.voiceAnswerEnabled`。
  - WXML 包含语音回答开关和手动播放入口。
