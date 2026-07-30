(() => {
  const DEFAULT_TIMEOUT_MS = 15000
  let toastTimer = null

  class RequestError extends Error {
    constructor(message, details = {}) {
      super(message)
      this.name = 'RequestError'
      this.status = details.status || 0
      this.code = details.code || this.status
      this.cause = details.cause
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

    let externalAbort = null
    if (options.signal) {
      externalAbort = () => controller.abort()
      if (options.signal.aborted) controller.abort()
      else options.signal.addEventListener('abort', externalAbort, { once: true })
    }

    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    let response
    try {
      response = await fetch(url, { ...options, headers, signal: controller.signal })
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw new RequestError('请求超时，请检查网络后重试', { cause: error })
      }
      throw new RequestError(navigator.onLine === false
        ? '当前网络不可用，请恢复连接后重试'
        : '网络连接失败，请稍后重试', { cause: error })
    } finally {
      clearTimeout(timeout)
      if (options.signal && externalAbort) options.signal.removeEventListener('abort', externalAbort)
    }

    const text = await response.text()
    let result = null
    if (text) {
      try {
        result = JSON.parse(text)
      } catch {
        result = { code: response.status, msg: '服务响应格式异常，请稍后重试' }
      }
    } else {
      result = { code: response.status, msg: response.ok ? 'ok' : '请求失败' }
    }

    if (response.status === 401 && typeof config.onUnauthorized === 'function') {
      config.onUnauthorized(result)
    }

    const expectsApiCode = config.expectCode !== false
    if (!response.ok || (expectsApiCode && Number(result.code) !== 200)) {
      throw new RequestError(result.msg || `请求失败（${response.status}）`, {
        status: response.status,
        code: result.code
      })
    }
    return result
  }

  function ensureToastRegion() {
    let region = document.getElementById('siteToastRegion')
    if (region) return region
    region = document.createElement('div')
    region.id = 'siteToastRegion'
    region.className = 'site-toast-region'
    region.setAttribute('aria-live', 'polite')
    region.setAttribute('aria-atomic', 'true')
    document.body.appendChild(region)
    return region
  }

  function notify(message, type = 'info', duration = 3200) {
    const region = ensureToastRegion()
    const toast = document.createElement('div')
    toast.className = `site-toast ${type}`
    toast.textContent = String(message || '')
    region.replaceChildren(toast)
    requestAnimationFrame(() => toast.classList.add('visible'))
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible')
      setTimeout(() => toast.remove(), 180)
    }, Math.max(1200, duration))
  }

  function installNetworkStatus() {
    const banner = document.createElement('div')
    banner.className = 'network-status'
    banner.setAttribute('role', 'status')
    banner.textContent = '网络已断开，恢复连接后可继续操作'
    document.body.appendChild(banner)

    const update = () => {
      const offline = navigator.onLine === false
      banner.classList.toggle('visible', offline)
      document.body.classList.toggle('is-offline', offline)
      if (!offline && banner.dataset.wasOffline === 'true') notify('网络已恢复', 'success', 1800)
      banner.dataset.wasOffline = offline ? 'true' : banner.dataset.wasOffline || 'false'
    }

    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    update()
  }

  window.CottonRuntime = { RequestError, requestJson, notify }
  installNetworkStatus()
})()
