const express = require('express')
const path = require('path')

const router = express.Router()
const siteShell = path.join(__dirname, '../public/site/index.html')

const redirectWithQuery = target => (req, res) => {
  const queryIndex = req.url.indexOf('?')
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : ''
  res.redirect(302, `${target}${query}`)
}

router.get(['/', '/index.html'], redirectWithQuery('/business/'))

for (const route of [
  '/business',
  '/business/',
  '/business/login',
  '/business/privacy',
  '/business/products',
  '/business/products/:id',
  '/business/machinery',
  '/business/machinery/:id',
  '/business/news',
  '/business/news/:id',
  '/business/merchants',
  '/business/local',
  '/business/activities',
  '/business/cart',
  '/business/favorites',
  '/business/account',
  '/business/orders',
  '/business/help',
  '/business/help/:id',
  '/business/about',
  '/business/contact'
]) {
  router.get(route, (_req, res) => res.sendFile(siteShell))
}

router.get(['/public', '/public/'], redirectWithQuery('/business/'))
router.get('/public/login', redirectWithQuery('/business/login'))
router.get('/public/privacy', redirectWithQuery('/business/privacy'))
router.get('/public/*', redirectWithQuery('/business/'))

router.get(['/academy', '/detail.html', '/forum.html', '/training'], redirectWithQuery('/business/'))
router.get('/training/:id', redirectWithQuery('/business/'))
router.get('/products', redirectWithQuery('/business/products'))
router.get('/products/:id', (req, res) => res.redirect(302, `/business/products/${encodeURIComponent(req.params.id)}`))
router.get('/machinery', redirectWithQuery('/business/machinery'))
router.get('/machinery/:id', (req, res) => res.redirect(302, `/business/machinery/${encodeURIComponent(req.params.id)}`))
router.get('/news', redirectWithQuery('/business/news'))
router.get('/news/:id', (req, res) => res.redirect(302, `/business/news/${encodeURIComponent(req.params.id)}`))
router.get('/about', redirectWithQuery('/business/about'))
router.get('/contact', redirectWithQuery('/business/contact'))

module.exports = router
