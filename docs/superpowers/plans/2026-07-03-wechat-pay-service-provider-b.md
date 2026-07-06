# WeChat Pay Service Provider B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the light service-provider payment path: merchants can submit onboarding material/status, store `sub_mchid`, and paid orders use WeChat Pay partner JSAPI without local fake payment.

**Architecture:** Keep onboarding and payment responsibilities separated. `server/utils/wechat-pay.js` owns API v3 signing, request encryption, callback decryption, and partner JSAPI helpers; routes call it and handle business validation. Mini program merchant profile gets a concrete onboarding/status entry, while buyer payment pages continue using the existing `/api/pay/wechat/*` endpoints.

**Tech Stack:** WeChat mini program, Node.js/Express, MySQL, WeChat Pay API v3 service-provider mode.

---

### Task 1: Payment Utility And Tests

**Files:**
- Create: `server/utils/wechat-pay.js`
- Create: `server/tests/wechat-pay.test.js`
- Modify: `server/package.json`

- [ ] Add tests for required config detection, request signatures, request-payment signatures, sensitive-field encryption failing when platform cert is missing, and notify decryption.
- [ ] Implement utility functions with no network side effects in tests.
- [ ] Add the test to `npm test`.

### Task 2: Database Migration

**Files:**
- Create: `server/db/migrate_wechat_service_provider.js`
- Modify: `server/db/schema.sql`

- [ ] Add `merchants.sub_mchid`, `wechat_applyment_id`, `wechat_business_code`, `wechat_applyment_state`, `wechat_applyment_msg`, `wechat_applyment_payload`, `wechat_applyment_updated_at`.
- [ ] Add `merchant_applyment_files` for local upload path to WeChat `media_id` mapping.
- [ ] Make the migration idempotent by catching duplicate column/table errors.

### Task 3: Merchant Applyment API

**Files:**
- Create: `server/routes/wechat-applyment.js`
- Modify: `server/index.js`

- [ ] Add merchant-authenticated endpoints: `GET /api/wechat-applyment/mine`, `POST /api/wechat-applyment/draft`, `POST /api/wechat-applyment/sub-mchid`, `POST /api/wechat-applyment/submit`, `POST /api/wechat-applyment/sync`.
- [ ] `sub-mchid` is the方案B manual bridge: after 微信审批完成, platform staff/merchant can save the real child merchant number.
- [ ] `submit` builds a WeChat applyment payload from stored form data and calls WeChat only when service-provider credentials are configured.
- [ ] No fake applyment success.

### Task 4: Partner JSAPI Payment Route

**Files:**
- Modify: `server/routes/payments.js`

- [ ] Replace direct JSAPI body with `/v3/pay/partner/transactions/jsapi`.
- [ ] Validate each payable order maps to exactly one merchant child account.
- [ ] Reject payment when merchant has no `sub_mchid`.
- [ ] Query partner transaction before `confirm`; notify verifies amount and `sub_mchid`.

### Task 5: Merchant Mini Program UI

**Files:**
- Modify: `pages/merchant/profile.js`
- Modify: `pages/merchant/profile.wxml`
- Modify: `pages/merchant/profile.wxss`

- [ ] Load WeChat Pay onboarding status.
- [ ] Add a status card with `sub_mchid`, applyment state, and a form action.
- [ ] Add a lightweight modal for manual `sub_mchid` binding and draft business/contact/bank data.
- [ ] Keep failures explicit; do not imply payment is enabled until `sub_mchid` exists.

### Task 6: Verification

**Files:**
- All modified files.

- [ ] Run `npm test` in `server`.
- [ ] Run `node --check` on changed backend JS files.
- [ ] Run `git diff --check`.
