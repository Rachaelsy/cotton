# AI Voice Answer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled AI voice answers while preserving text chat replies.

**Architecture:** Keep all AI answer rendering in `pages/ai/index.js`; text bubbles remain the source of truth. Add a user-facing voice-answer switch and a per-message replay action that both call the existing WechatSI TTS path.

**Tech Stack:** WeChat Mini Program WXML/WXSS/JS, WechatSI `textToSpeech`, existing static Node tests.

---

### Task 1: Voice Answer Test Coverage

**Files:**
- Modify: `server/tests/miniapp-voice.test.js`

- [ ] **Step 1: Write failing assertions**

Add checks for `voiceAnswerEnabled`, `onToggleVoiceAnswer`, `onReplayAnswer`, `speakable`, `speakingMessageId`, `voice-answer-toggle`, and `replay-answer`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node server\tests\miniapp-voice.test.js`
Expected: FAIL before implementation because the new controls do not exist.

### Task 2: Voice Answer State and Behavior

**Files:**
- Modify: `pages/ai/index.js`

- [ ] **Step 1: Add state**

Add `voiceAnswerEnabled: false` and `speakingMessageId: null`.

- [ ] **Step 2: Add automatic speak logic**

Use `options.fromVoice || this.data.voiceAnswerEnabled` when deciding whether to speak an AI reply.

- [ ] **Step 3: Add controls**

Add `onToggleVoiceAnswer` and `onReplayAnswer`.

- [ ] **Step 4: Track active playback**

Set `speakingMessageId` while playing and clear it on audio end/error/stop.

### Task 3: Voice Answer UI

**Files:**
- Modify: `pages/ai/index.wxml`
- Modify: `pages/ai/index.wxss`
- Modify: `utils/i18n.js`

- [ ] **Step 1: Add switch UI**

Add a compact “语音回答” switch in the bottom input area.

- [ ] **Step 2: Add replay UI**

Add a small speaker button below AI message bubbles.

- [ ] **Step 3: Add styles and localized labels**

Add styles for the switch and replay button. Add Chinese and Uyghur copy keys.

### Task 4: Verification

**Files:**
- Validate: `pages/ai/index.js`
- Validate: `server/tests/miniapp-voice.test.js`

- [ ] **Step 1: Run focused tests**

Run: `node server\tests\miniapp-voice.test.js`
Expected: PASS.

- [ ] **Step 2: Run syntax check**

Run: `node --check pages\ai\index.js`
Expected: exit code 0.

- [ ] **Step 3: Run server test suite**

Run: `npm test` from `server`
Expected: all relevant tests pass; `client-config.test.js` may still fail while `utils/auth.js` is set to `ENV = 'real'`.
