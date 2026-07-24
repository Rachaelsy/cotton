const express = require('express')
const path = require('path')

const router = express.Router()
const siteShell = path.join(__dirname, '../public/site/index.html')
const academyPage = path.join(__dirname, '../public/knowledge/index.html')

router.get('/academy', (_req, res) => res.sendFile(academyPage))

for (const route of [
  '/',
  '/index.html',
  '/products',
  '/products/:id',
  '/training',
  '/training/:id',
  '/news',
  '/news/:id',
  '/about',
  '/contact'
]) {
  router.get(route, (_req, res) => res.sendFile(siteShell))
}

module.exports = router
