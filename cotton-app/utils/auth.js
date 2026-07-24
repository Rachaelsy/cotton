// utils/auth.js — 登录态管理工具
// 调用方式：const auth = require('../../utils/auth')

// ── 环境切换 ──────────────────────────────────────────────────
// ENV = 'prod'   → 生产环境，使用云服务器域名（HTTPS，需已备案）
// ENV = 'server' → 连接云服务器（走 Nginx 80 端口）
// ENV = 'real'   → 真机调试，使用电脑局域网 IP + 端口 3000
// ENV = 'sim'    → 模拟器调试，使用 localhost
const ENV = 'prod'

const PROD_URL   = 'https://cyaia.cn'        // ← 上线后改为真实备案域名
const SERVER_IP  = '101.34.207.252'            // 云服务器公网 IP
const LOCAL_IP   = '192.168.0.12'             // 本地开发局域网 IP（ipconfig 查询）

const BASE_URL =
  ENV === 'prod'   ? PROD_URL :
  ENV === 'server' ? `http://${SERVER_IP}` :
  ENV === 'real'   ? `http://${LOCAL_IP}:3000` :
                     'http://127.0.0.1:3000'

const TOKEN_KEY = 'cotton_token'
const USER_KEY  = 'cotton_user'
const GUEST_TOKEN_KEY = 'cotton_guest_token'

// ─────────────────────────────────────────────
// Token 存取
// ─────────────────────────────────────────────

function saveToken(token) {
  wx.setStorageSync(TOKEN_KEY, token)
}

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function clearToken() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
}

function saveGuestToken(token) {
  wx.setStorageSync(GUEST_TOKEN_KEY, token)
}

function getGuestToken() {
  return wx.getStorageSync(GUEST_TOKEN_KEY) || ''
}

function clearGuestToken() {
  wx.removeStorageSync(GUEST_TOKEN_KEY)
}

// ─────────────────────────────────────────────
// 用户信息存取
// ─────────────────────────────────────────────

function saveUser(user) {
  wx.setStorageSync(USER_KEY, user)
}

function getUser() {
  return wx.getStorageSync(USER_KEY) || null
}

function isFarmerUser(user) {
  return !!(user && user.role === 'farmer')
}

// ─────────────────────────────────────────────
// 封装 HTTP 请求（自动带 Token）
// ─────────────────────────────────────────────

function requestWithToken(method, path, data, token, tokenType = 'user') {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success(res) {
        if (res.statusCode === 401) {
          if (tokenType === 'guest') {
            clearGuestToken()
          } else {
            clearToken()
            const app = typeof getApp === 'function' ? getApp() : null
            if (app && app.globalData) app.globalData.user = null
          }
          const error = new Error(res.data && res.data.msg || '身份已过期')
          error.statusCode = 401
          reject(error)
        } else {
          resolve(res.data)
        }
      },
      fail(err) {
        wx.showToast({ title: '网络异常，请检查网络', icon: 'none' })
        reject(err)
      }
    })
  })
}

function request(method, path, data) {
  return requestWithToken(method, path, data, getToken(), 'user')
}

function wxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success: result => result.code ? resolve(result.code) : reject(new Error('未获取到微信身份凭证')),
      fail: () => reject(new Error('微信身份获取失败，请稍后重试'))
    })
  })
}

async function ensureGuestSession(force = false) {
  const userToken = getToken()
  if (userToken) return { token: userToken, type: 'user' }
  if (!force && getGuestToken()) return { token: getGuestToken(), type: 'guest' }

  clearGuestToken()
  const loginCode = await wxLoginCode()
  const result = await requestWithToken(
    'POST',
    '/api/auth/wechat-guest',
    { loginCode },
    '',
    'guest'
  )
  if (result.code !== 200 || !result.data || !result.data.token) {
    throw new Error(result.msg || '微信身份建立失败')
  }
  saveGuestToken(result.data.token)
  return { token: result.data.token, type: 'guest' }
}

async function guestRequest(method, path, data) {
  let identity = await ensureGuestSession()
  try {
    return await requestWithToken(method, path, data, identity.token, identity.type)
  } catch (error) {
    if (error.statusCode !== 401 || identity.type !== 'guest') throw error
    identity = await ensureGuestSession(true)
    return requestWithToken(method, path, data, identity.token, identity.type)
  }
}

function uploadFile(path, filePath, name = 'file') {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: BASE_URL + path,
      filePath,
      name,
      header: {
        'Authorization': getToken() ? `Bearer ${getToken()}` : ''
      },
      success(res) {
        try {
          resolve(JSON.parse(res.data || '{}'))
        } catch (error) {
          reject(new Error('上传响应解析失败'))
        }
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

// ─────────────────────────────────────────────
// Auth API
// ─────────────────────────────────────────────

/**
 * 注册
 * @param {object} form { phone, password, role, real_name, ...roleFields }
 */
async function register(form) {
  const res = await request('POST', '/api/auth/register', {
    ...form,
    guestToken: getGuestToken() || undefined
  })
  if (res.code === 200) {
    saveToken(res.data.token)
    saveUser(res.data)
    clearGuestToken()
  }
  return res
}

/**
 * 登录
 * @param {string} phone
 * @param {string} password
 */
async function login(phone, password) {
  const res = await request('POST', '/api/auth/login', {
    phone,
    password,
    role: 'farmer',
    guestToken: getGuestToken() || undefined
  })
  if (res.code === 200 && isFarmerUser(res.data)) {
    saveToken(res.data.token)
    saveUser(res.data)
    clearGuestToken()
  }
  return res
}

/**
 * 校验 Token 有效性（启动时调用）
 * 返回 true = 有效，false = 无效/过期
 */
async function verify() {
  const token = getToken()
  if (!token) return false
  try {
    const res = await request('GET', '/api/auth/verify')
    if (res.code === 200) {
      if (!isFarmerUser(res.data)) {
        clearToken()
        const app = typeof getApp === 'function' ? getApp() : null
        if (app && app.globalData) app.globalData.user = null
        return false
      }
      saveUser(res.data)
      const app = typeof getApp === 'function' ? getApp() : null
      if (app && app.globalData) app.globalData.user = res.data
      return true
    }
    clearToken()
    return false
  } catch {
    return false
  }
}

/**
 * 登出
 */
function logout() {
  clearToken()
  getApp().globalData.user = null
  wx.reLaunch({ url: '/pages/index/index' })
}

/**
 * 检查是否已登录（同步，仅检查本地 Token 是否存在）
 */
function isLoggedIn() {
  return !!getToken()
}

/**
 * 要求登录守卫 —— 仅返回布尔值，不强制跳转
 */
function requireLogin() {
  return isLoggedIn()
}

/**
 * 微信登录 + 手机号绑定
 * @param {string} loginCode  wx.login() 返回的 code
 * @param {string} phoneCode  open-type="getPhoneNumber" 返回的 code
 */
async function wxLogin(loginCode, phoneCode) {
  const res = await request('POST', '/api/auth/wx-login', {
    loginCode,
    phoneCode,
    guestToken: getGuestToken() || undefined
  })
  if (res.code === 200 && isFarmerUser(res.data)) {
    saveToken(res.data.token)
    saveUser(res.data)
    clearGuestToken()
    getApp().globalData.user = res.data
  }
  return res
}

module.exports = {
  BASE_URL,
  saveToken, getToken, clearToken,
  saveGuestToken, getGuestToken, clearGuestToken,
  saveUser, getUser,
  request, guestRequest, ensureGuestSession, uploadFile,
  register, login, verify, logout, wxLogin,
  isLoggedIn, requireLogin, isFarmerUser,
  hasGuestSession: () => !!getGuestToken()
}
