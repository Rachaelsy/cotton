const express = require('express')
const path = require('path')

const router = express.Router()
const siteShell = path.join(__dirname, '../public/site/index.html')
const academyPage = path.join(__dirname, '../public/knowledge/index.html')
const academyDetailPage = path.join(__dirname, '../public/knowledge/detail.html')
const forumDetailPage = path.join(__dirname, '../public/knowledge/forum.html')

const redirectWithQuery = target => (req, res) => {
  const queryIndex = req.url.indexOf('?')
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : ''
  res.redirect(302, `${target}${query}`)
}

for (const route of [
  '/',
  '/index.html',
  '/public',
  '/public/',
  '/public/training',
  '/public/training/:id',
  '/public/consult',
  '/public/experts',
  '/public/policies',
  '/public/policies/:id',
  '/public/pests',
  '/public/pests/:id',
  '/public/activities',
  '/public/activities/:id',
  '/business',
  '/business/',
  '/business/products',
  '/business/products/:id',
  '/business/news',
  '/business/news/:id',
  '/business/about',
  '/business/contact'
]) {
  router.get(route, (_req, res) => res.sendFile(siteShell))
}

router.get('/public/academy', (_req, res) => res.sendFile(academyPage))
router.get('/public/detail.html', (_req, res) => res.sendFile(academyDetailPage))
router.get('/public/forum.html', (_req, res) => res.sendFile(forumDetailPage))

router.get('/academy', redirectWithQuery('/public/academy'))
router.get('/detail.html', redirectWithQuery('/public/detail.html'))
router.get('/forum.html', redirectWithQuery('/public/forum.html'))
router.get('/training', redirectWithQuery('/public/training'))
router.get('/training/:id', (req, res) => res.redirect(302, `/public/training/${encodeURIComponent(req.params.id)}`))
router.get('/products', redirectWithQuery('/business/products'))
router.get('/products/:id', (req, res) => res.redirect(302, `/business/products/${encodeURIComponent(req.params.id)}`))
router.get('/news', redirectWithQuery('/business/news'))
router.get('/news/:id', (req, res) => res.redirect(302, `/business/news/${encodeURIComponent(req.params.id)}`))
router.get('/about', redirectWithQuery('/business/about'))
router.get('/contact', redirectWithQuery('/business/contact'))

module.exports = router
