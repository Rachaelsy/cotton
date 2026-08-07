const CLIENTS = Object.freeze({ APP: 'cotton-app', PUBLIC: 'cotton-public' })

function normalizeMiniappClient(value) {
  return String(value || '').trim().toLowerCase() === CLIENTS.PUBLIC ? CLIENTS.PUBLIC : CLIENTS.APP
}

function resolveMiniappClient(req, env = process.env) {
  const clientKey = normalizeMiniappClient(
    req && req.headers && req.headers['x-miniapp-client'] || req && req.body && req.body.clientKey
  )
  const publicConfigured = !!(env.PUBLIC_WX_APPID && env.PUBLIC_WX_SECRET)
  const usePublicConfig = clientKey === CLIENTS.PUBLIC && publicConfigured
  return {
    clientKey,
    appid: String(usePublicConfig ? env.PUBLIC_WX_APPID : env.WX_APPID || '').trim(),
    secret: String(usePublicConfig ? env.PUBLIC_WX_SECRET : env.WX_SECRET || '').trim(),
    usesDedicatedIdentity: usePublicConfig && env.PUBLIC_WX_APPID !== env.WX_APPID
  }
}

module.exports = { CLIENTS, normalizeMiniappClient, resolveMiniappClient }
