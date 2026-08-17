const express = require('express')
const path = require('path')

const router = express.Router()
const siteShell = path.join(__dirname, '../public/site/index.html')

const redirectWithQuery = target => (req, res) => {
  const queryIndex = req.url.indexOf('?')
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : ''
  res.redirect(302, `${target}${query}`)
}

const redirectLegacyCourse = (req, res) => {
  const id = Number.parseInt(req.query.id, 10)
  res.redirect(301, id > 0 ? `/public/courses/${id}` : '/public/courses')
}

const redirectLegacyQuestion = (req, res) => {
  const id = Number.parseInt(req.query.id, 10)
  res.redirect(301, id > 0 ? `/public/forum/${id}` : '/public/forum')
}

router.get(['/', '/index.html'], redirectWithQuery('/public/'))

for (const route of [
  '/public',
  '/public/',
  '/public/training',
  '/public/training/:id',
  '/public/courses',
  '/public/courses/:id',
  '/public/forum',
  '/public/forum/:id',
  '/public/login',
  '/public/privacy',
  '/public/consult',
  '/public/experts',
  '/public/experts/:id',
  '/public/policies',
  '/public/policies/:id',
  '/public/finance',
  '/public/finance/:id',
  '/public/machinery',
  '/public/machinery/:id',
  '/public/supplies',
  '/public/supplies/:id',
  '/public/processing',
  '/public/processing/:id',
  '/public/varieties',
  '/public/varieties/:id',
  '/public/pests',
  '/public/pests/:id',
  '/public/activities',
  '/public/activities/:id',
  '/business',
  '/business/',
  '/business/products',
  '/business/products/:id',
  '/business/machinery',
  '/business/machinery/:id',
  '/business/news',
  '/business/news/:id',
  '/business/about',
  '/business/contact'
]) {
  router.get(route, (_req, res) => res.sendFile(siteShell))
}

router.get('/public/academy', (_req, res) => res.redirect(301, '/public/courses'))
router.get('/public/detail.html', redirectLegacyCourse)
router.get('/public/forum.html', redirectLegacyQuestion)

router.get('/academy', (_req, res) => res.redirect(301, '/public/courses'))
router.get('/detail.html', redirectLegacyCourse)
router.get('/forum.html', redirectLegacyQuestion)
router.get('/training', redirectWithQuery('/public/training'))
router.get('/training/:id', (req, res) => res.redirect(302, `/public/training/${encodeURIComponent(req.params.id)}`))
router.get('/products', redirectWithQuery('/business/products'))
router.get('/products/:id', (req, res) => res.redirect(302, `/business/products/${encodeURIComponent(req.params.id)}`))
router.get('/machinery', redirectWithQuery('/business/machinery'))
router.get('/machinery/:id', (req, res) => res.redirect(302, `/business/machinery/${encodeURIComponent(req.params.id)}`))
router.get('/news', redirectWithQuery('/business/news'))
router.get('/news/:id', (req, res) => res.redirect(302, `/business/news/${encodeURIComponent(req.params.id)}`))
router.get('/about', redirectWithQuery('/business/about'))
router.get('/contact', redirectWithQuery('/business/contact'))

module.exports = router
