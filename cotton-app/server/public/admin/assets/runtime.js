// Shared runtime for the core web consoles.
(() => {
  const DEFAULT_TIMEOUT_MS = 15000
  let toastTimer = null

  class RequestError extends Error {
    constructor(message, details = {}) {
      super(message)
      this.name = 'RequestError'
      this.status = Number(details.status || 0)
      this.code = details.code ?? this.status
      this.response = details.response || null
      this.cause = details.cause
    }
  }

  function installStyles() {
    if (document.getElementById('cotton-runtime-styles')) return
    const style = document.createElement('style')
    style.id = 'cotton-runtime-styles'
    style.textContent = `
      .cotton-network-status {
        position: fixed;
        top: max(10px, env(safe-area-inset-top));
        left: 50%;
        z-index: 20000;
        max-width: min(92vw, 460px);
        padding: 10px 16px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 6px;
        background: #222a25;
        box-shadow: 0 10px 28px rgba(0,0,0,.2);
        color: #fff;
        font: 600 14px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif;
        letter-spacing: 0;
        opacity: 0;
        pointer-events: none;
        transform: translate(-50%, -16px);
        transition: opacity .18s ease, transform .18s ease;
      }
      .cotton-network-status.visible {
        opacity: 1;
        transform: translate(-50%, 0);
      }
      .cotton-toast-region {
        position: fixed;
        top: max(18px, env(safe-area-inset-top));
        left: 50%;
        z-index: 20010;
        width: min(92vw, 440px);
        pointer-events: none;
        transform: translateX(-50%);
      }
      .cotton-toast {
        padding: 12px 16px;
        border: 1px solid #d8ded9;
        border-radius: 6px;
        background: #fff;
        box-shadow: 0 12px 34px rgba(18,39,27,.18);
        color: #243128;
        font: 600 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
        letter-spacing: 0;
        opacity: 0;
        transform: translateY(-10px);
        transition: opacity .18s ease, transform .18s ease;
      }
      .cotton-toast.visible { opacity: 1; transform: translateY(0); }
      .cotton-toast.error { border-color: #eccbc8; color: #8e2d26; }
      .cotton-toast.success { border-color: #c7dfcf; color: #176139; }
    `
    document.head.appendChild(style)
  }

  function ensureToastRegion() {
    installStyles()
    let region = document.getElementById('cottonToastRegion')
    if (region) return region
    region = document.createElement('div')
    region.id = 'cottonToastRegion'
    region.className = 'cotton-toast-region'
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
    document.body.appendChild(region)
    return region
  }

  function notify(message, type = 'info', duration = 3200) {
    const text = String(message || '').trim()
    if (!text) return
    const region = ensureToastRegion()
    const toast = document.createElement('div')
    toast.className = `cotton-toast ${type}`
    toast.textContent = text
    region.replaceChildren(toast)
    requestAnimationFrame(() => toast.classList.add('visible'))
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible')
      setTimeout(() => toast.remove(), 180)
    }, Math.max(1200, Number(duration) || 3200))
  }

  function parseResponse(text, status) {
    if (!text) return { code: status, msg: status >= 200 && status < 300 ? 'ok' : '请求失败' }
    try {
      return JSON.parse(text)
    } catch {
      throw new RequestError('服务器响应格式异常，请稍后重试', { status })
    }
  }

  async function requestJson(url, options = {}, config = {}) {
    const timeoutMs = Math.max(1000, Number(config.timeoutMs) || DEFAULT_TIMEOUT_MS)
    const controller = new AbortController()
    const headers = new Headers(options.headers || {})
    const body = options.body

    if (body && !(body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
    if (config.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${config.token}`)
    }

    let detachExternalSignal = null
    if (options.signal) {
      const abort = () => controller.abort()
      if (options.signal.aborted) controller.abort()
      else {
        options.signal.addEventListener('abort', abort, { once: true })
        detachExternalSignal = () => options.signal.removeEventListener('abort', abort)
      }
    }

    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    let response
    try {
      response = await fetch(url, { ...options, headers, signal: controller.signal })
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new RequestError('请求超时，请检查网络后重试', { cause: error })
      }
      throw new RequestError(
        navigator.onLine === false
          ? '当前网络不可用，请恢复连接后重试'
          : '网络连接失败，请稍后重试',
        { cause: error }
      )
    } finally {
      clearTimeout(timeout)
      if (detachExternalSignal) detachExternalSignal()
    }

    const result = parseResponse(await response.text(), response.status)
    if (response.status === 401 && typeof config.onUnauthorized === 'function') {
      config.onUnauthorized(result)
    }

    const apiFailed = config.expectCode !== false && Number(result.code) !== 200
    const httpFailed = !response.ok && config.allowErrorResponse !== true
    if (httpFailed || apiFailed) {
      throw new RequestError(result.msg || `请求失败（${response.status}）`, {
        status: response.status,
        code: result.code,
        response: result
      })
    }
    return result
  }

  function installNetworkStatus() {
    installStyles()
    const banner = document.createElement('div')
    banner.className = 'cotton-network-status'
    banner.setAttribute('role', 'status')
    banner.textContent = '网络已断开，恢复连接后可继续操作'
    document.body.appendChild(banner)

    const update = () => {
      const offline = navigator.onLine === false
      banner.classList.toggle('visible', offline)
      if (!offline && banner.dataset.wasOffline === 'true') {
        notify('网络已恢复', 'success', 1800)
      }
      banner.dataset.wasOffline = offline ? 'true' : banner.dataset.wasOffline || 'false'
    }

    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    update()
  }

  window.CottonRuntime = { RequestError, requestJson, notify }
  window.addEventListener('unhandledrejection', event => {
    if (!(event.reason instanceof RequestError)) return
    notify(event.reason.message, 'error')
    event.preventDefault()
  })

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installNetworkStatus, { once: true })
  } else {
    installNetworkStatus()
  }
})()
