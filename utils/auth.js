// utils/auth.js — 登录态管理工具
// 调用方式：const auth = require('../../utils/auth')

// ── 环境切换 ──────────────────────────────────────────────────
// ENV = 'prod'   → 生产环境，使用云服务器域名（HTTPS，需已备案）
// ENV = 'server' → 连接云服务器（走 Nginx 80 端口）
// ENV = 'real'   → 真机调试，使用电脑局域网 IP + 端口 3000
// ENV = 'sim'    → 模拟器调试，使用 localhost
const ENV = 'real'

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

function request(method, path, data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + path,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': getToken() ? `Bearer ${getToken()}` : ''
      },
      success(res) {
        if (res.statusCode === 401) {
          clearToken()
          getApp().globalData.user = null
          reject(new Error('未登录'))
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
  const res = await request('POST', '/api/auth/register', form)
  if (res.code === 200) {
    saveToken(res.data.token)
    saveUser(res.data)
  }
  return res
}

/**
 * 登录
 * @param {string} phone
 * @param {string} password
 */
async function login(phone, password) {
  const res = await request('POST', '/api/auth/login', { phone, password, role: 'farmer' })
  if (res.code === 200 && isFarmerUser(res.data)) {
    saveToken(res.data.token)
    saveUser(res.data)
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
  const res = await request('POST', '/api/auth/wx-login', { loginCode, phoneCode })
  if (res.code === 200 && isFarmerUser(res.data)) {
    saveToken(res.data.token)
    saveUser(res.data)
    getApp().globalData.user = res.data
  }
  return res
}

module.exports = {
  BASE_URL,
  saveToken, getToken, clearToken,
  saveUser, getUser,
  request, uploadFile,
  register, login, verify, logout, wxLogin,
  isLoggedIn, requireLogin, isFarmerUser
}
