const express = require('express')
const { authMiddleware, roleGuard } = require('../middleware/auth')
const points = require('../utils/points')

const router = express.Router()

router.get('/rules', (_req, res) => {
  res.json({ code: 200, msg: 'ok', data: points.publicRules() })
})

router.get('/me', authMiddleware, roleGuard('farmer'), async (req, res) => {
  try {
    const data = await points.getSummary(req.user.id, req.query.limit)
    return res.json({ code: 200, msg: 'ok', data })
  } catch (error) {
    console.error('[points-me]', error)
    return res.status(500).json({ code: 500, msg: '积分信息加载失败', data: null })
  }
})

module.exports = router
