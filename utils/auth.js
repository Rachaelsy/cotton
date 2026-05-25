// utils/auth.js — 登录态管理工具
// 调用方式：const auth = require('../../utils/auth')

// 模拟器调试用 localhost，真机调试用电脑局域网 IP
// 查看方法：Windows 运行 ipconfig，找 IPv4 地址（如 192.168.1.5）
// 部署上线后改为 https://your-server.com
const IS_DEV_REAL_DEVICE = true   // 真机调试时设为 true，模拟器设为 false
const LOCAL_IP = '192.168.0.25'   // 电脑局域网 IP

const BASE_URL = IS_DEV_REAL_DEVICE
  ? `http://${LOCAL_IP}:3000`
  : 'http://localhost:3000'

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
  const res = await request('POST', '/api/auth/login', { phone, password })
  if (res.code === 200) {
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
      saveUser(res.data)
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
  if (res.code === 200) {
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
  request,
  register, login, verify, logout, wxLogin,
  isLoggedIn, requireLogin
}
