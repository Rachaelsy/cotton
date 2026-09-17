/**
 * @fileoverview markdown 插件
 * Include marked (https://github.com/markedjs/marked)
 * Include github-markdown-css (https://github.com/sindresorhus/github-markdown-css)
 */
const { marked } = require('./marked.min')
let index = 0

function Markdown (vm) {
  this.vm = vm
  vm._ids = {}
}

Markdown.prototype.onUpdate = function (content) {
  if (this.vm.properties.markdown) {
    content = content
      // 后台粘贴内容有时会把 Markdown 星号转义，展示文章时恢复加粗标记。
      .replace(/\\\*\\\*/g, '**')
      // 只在行首或列表项内清理结束标记前的隐藏空格，避免跨段误配两组星号。
      .replace(/(^|\n)([ \t]*(?:(?:[-+*]|\d+\.)[ \t]+)?)\*\*([^*\n]*?\S)[ \t\u00a0\u200b\ufeff]+\*\*/g, '$1$2**$3** ')
      // 中文紧跟在结束标记后时增加零宽分隔，避免 marked 将 ** 当作普通文本。
      .replace(/\*\*([^*\n]+)\*\*(?=\S)/g, '**$1**&#8203;')
    return marked(content)
  }
}

Markdown.prototype.onParse = function (node, vm) {
  if (vm.options.markdown) {
    // 中文 id 需要转换，否则无法跳转
    if (vm.options.useAnchor && node.attrs && /[\u4e00-\u9fa5]/.test(node.attrs.id)) {
      const id = 't' + index++
      this.vm._ids[node.attrs.id] = id
      node.attrs.id = id
    }
    if (node.name === 'p' || node.name === 'table' || node.name === 'tr' || node.name === 'th' || node.name === 'td' || node.name === 'blockquote' || node.name === 'pre' || node.name === 'code') {
      node.attrs.class = `md-${node.name} ${node.attrs.class || ''}`
    }
  }
}

module.exports = Markdown
