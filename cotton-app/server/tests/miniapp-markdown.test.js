const assert = require('assert')
const fs = require('fs')
const path = require('path')

const rootDir = path.join(__dirname, '..', '..')
const { markdownToRichTextNodes } = require('../../utils/markdown')
const { markdownToRichTextNodes: publicMarkdownToRichTextNodes } = require('../../../cotton-public/utils/markdown')

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

  const tableNodes = markdownToRichTextNodes([
    '| 品种 | 籽棉产量 | 衣分 |',
    '',
    '| --- | ---: | ---: |',
    '',
    '| 源棉8号 | 396.2公斤/亩 | 39.36% |',
    '',
    '| 塔河2号 | 400.3公斤/亩 | 41.92% |'
  ].join('\n'))
  const tableText = collectText(tableNodes)
  assert.ok(hasNode(tableNodes, 'table') && hasNode(tableNodes, 'thead') && hasNode(tableNodes, 'tbody'), 'markdown tables should become semantic rich-text table nodes')
  assert.ok(hasNode(tableNodes, 'th') && hasNode(tableNodes, 'td'), 'markdown table headers and cells should be rendered separately')
  assert.ok(tableText.includes('源棉8号') && tableText.includes('41.92%'), 'markdown table data should be preserved')
  assert.ok(!tableText.includes('---') && !tableText.includes('|'), 'markdown table delimiters should not be rendered as plain text')
  const publicTableNodes = publicMarkdownToRichTextNodes('| 品种 | 产量 |\n\n| --- | ---: |\n\n| 源棉8号 | 396.2公斤/亩 |', { indentParagraphs: true })
  assert.ok(hasNode(publicTableNodes, 'table') && hasNode(publicTableNodes, 'td'), 'cotton-public policy pages should render markdown tables')
  const publicArticleNodes = publicMarkdownToRichTextNodes('## 适宜种植条件\n\n正文段落。', { indentParagraphs: true })
  assert.ok(hasNode(publicArticleNodes, 'h2') && hasNode(publicArticleNodes, 'p'), 'policy articles should render section headings and paragraphs as separate blocks')
  assert.ok(collectText(publicArticleNodes).includes('适宜种植条件') && !collectText(publicArticleNodes).includes('##'), 'policy heading text should not expose Markdown markers')

  const aiPage = readRootFile('pages', 'ai', 'index.js')
  const aiWxml = readRootFile('pages', 'ai', 'index.wxml')
  assert.ok(aiPage.includes("require('../../utils/markdown')"))
  assert.ok(aiPage.includes('richTextNodes: markdownToRichTextNodes(text)'))
  assert.ok(aiWxml.includes('<rich-text'))
  assert.ok(aiWxml.includes('nodes="{{item.richTextNodes}}"'))

  console.log('miniapp markdown rendering tests passed')
}

run()
