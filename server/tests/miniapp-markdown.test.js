const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')
const { markdownToRichTextNodes } = require('../../utils/markdown')

function readRootFile(...parts) {
  return fs.readFileSync(path.join(rootDir, ...parts), 'utf8')
}

function collectText(nodes) {
  return nodes.map((node) => {
    if (node.type === 'text') return node.text || ''
    return collectText(node.children || [])
  }).join('')
}

function hasNode(nodes, name) {
  return nodes.some((node) => node.name === name || hasNode(node.children || [], name))
}

function run() {
  const nodes = markdownToRichTextNodes('请注意：**暂停喷药**\n- 查看**虫情**\n1. 保持通风')
  const text = collectText(nodes)

  assert.ok(hasNode(nodes, 'strong'), 'bold markdown should become a strong rich-text node')
  assert.ok(text.includes('暂停喷药'))
  assert.ok(text.includes('查看虫情'))
  assert.ok(text.includes('1. 保持通风'))
  assert.ok(!text.includes('**'), 'markdown delimiters should not be rendered as plain text')

  const aiPage = readRootFile('pages', 'ai', 'index.js')
  const aiWxml = readRootFile('pages', 'ai', 'index.wxml')
  assert.ok(aiPage.includes("require('../../utils/markdown')"))
  assert.ok(aiPage.includes('richTextNodes: markdownToRichTextNodes(text)'))
  assert.ok(aiWxml.includes('<rich-text'))
  assert.ok(aiWxml.includes('nodes="{{item.richTextNodes}}"'))

  console.log('miniapp markdown rendering tests passed')
}

run()
