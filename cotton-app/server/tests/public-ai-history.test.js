const assert = require('assert/strict')
const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(
  path.resolve(__dirname, '../../../cotton-public/pages/ai/index.js'),
  'utf8'
)

assert.ok(source.includes('HISTORY_KEY_PREFIX'), 'AI 历史应使用新版分用户缓存前缀')
assert.ok(source.includes('_getHistoryKey()'), 'AI 历史应根据当前身份生成缓存键')
assert.ok(source.includes('_syncHistoryOwner()'), '页面返回前台时应检查账号是否变化')
assert.ok(source.includes('_user_${user.id}'), '登录用户的聊天记录应按用户 ID 隔离')
assert.ok(source.includes('this._activeHistoryKey !== historyKey'), '账号切换后应丢弃旧账号尚未返回的 AI 响应')
assert.ok(!source.includes('wx.getStorageSync(HISTORY_KEY)'), '不应继续读取所有账号共用的旧缓存')
assert.ok(!source.includes('wx.setStorageSync(HISTORY_KEY,'), '不应继续写入所有账号共用的旧缓存')

console.log('Public miniapp AI history isolation tests passed')
