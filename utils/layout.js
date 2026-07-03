function getCapsuleSafeRight(extra = 8) {
  try {
    const info = wx.getSystemInfoSync()
    const menu = wx.getMenuButtonBoundingClientRect && wx.getMenuButtonBoundingClientRect()
    if (!info || !menu || !menu.left) return 0
    return Math.max(0, info.windowWidth - menu.left + extra)
  } catch (error) {
    return 0
  }
}

module.exports = { getCapsuleSafeRight }
