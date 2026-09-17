function textNode(text) {
  return { type: 'text', text: String(text || '') }
}

function elementNode(name, children, attrs = null) {
  const node = { name, children }
  if (attrs) node.attrs = attrs
  return node
}

function normalizeInlineText(text) {
  return String(text || '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
}

function parseInline(markdown) {
  const source = normalizeInlineText(markdown)
  const nodes = []
  const pattern = /(\*\*|__)(.+?)\1|`([^`]+)`/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(source))) {
    if (match.index > lastIndex) {
      nodes.push(textNode(source.slice(lastIndex, match.index)))
    }

    if (match[3]) {
      nodes.push(elementNode('span', [textNode(match[3])], {
        style: 'padding:0 4rpx;border-radius:4rpx;background:#F4F0EA;color:#8A5A2B;'
      }))
    } else {
      nodes.push(elementNode('strong', [textNode(match[2])], {
        style: 'font-weight:700;color:#111111;'
      }))
    }

    lastIndex = pattern.lastIndex
  }

  if (lastIndex < source.length) {
    nodes.push(textNode(source.slice(lastIndex)))
  }

  return nodes.length ? nodes : [textNode(source)]
}

function parseLine(line, options = {}) {
  const raw = String(line || '')
  const trimmed = raw.trim()
  if (!trimmed) return []

  const heading = trimmed.match(/^(#{1,6})\s+(.+)$/)
  if (heading) {
    const level = Math.min(3, heading[1].length)
    const styles = {
      1: 'display:block;margin:48rpx 0 22rpx;padding:0;color:#15251C;font-size:38rpx;font-weight:800;line-height:1.45;',
      2: 'display:block;margin:44rpx 0 20rpx;padding-left:16rpx;border-left:7rpx solid #1B7A55;color:#173B2B;font-size:34rpx;font-weight:800;line-height:1.5;',
      3: 'display:block;margin:36rpx 0 16rpx;color:#1B4935;font-size:31rpx;font-weight:800;line-height:1.55;'
    }
    return [
      elementNode(`h${level}`, parseInline(heading[2]), { style: styles[level] })
    ]
  }

  const bullet = trimmed.match(/^[-*+]\s+(.+)$/)
  if (bullet) {
    return [elementNode('div', [textNode('• '), ...parseInline(bullet[1])], {
      style: 'display:block;margin:10rpx 0;padding-left:30rpx;text-indent:-24rpx;color:#303B35;font-size:29rpx;line-height:1.8;'
    })]
  }

  const ordered = trimmed.match(/^(\d+)[.)]\s+(.+)$/)
  if (ordered) {
    return [elementNode('div', [textNode(`${ordered[1]}. `), ...parseInline(ordered[2])], {
      style: 'display:block;margin:10rpx 0;padding-left:34rpx;text-indent:-30rpx;color:#303B35;font-size:29rpx;line-height:1.8;'
    })]
  }

  return [elementNode('p', parseInline(raw.trim()), {
    style: options.indentParagraphs
      ? 'display:block;margin:0 0 26rpx;color:#303833;font-size:29rpx;line-height:1.86;text-align:justify;text-indent:2em;letter-spacing:.4rpx;'
      : 'display:block;margin:0 0 18rpx;color:#303833;font-size:29rpx;line-height:1.78;'
  })]
}

function parseTableCells(line) {
  let source = String(line || '').trim()
  if (!source.includes('|')) return []
  if (source.startsWith('|')) source = source.slice(1)
  if (source.endsWith('|')) source = source.slice(0, -1)
  return source.split('|').map(cell => cell.trim())
}

function isTableDivider(line, expectedColumns) {
  const cells = parseTableCells(line)
  return cells.length === expectedColumns && cells.every(cell => /^:?-{3,}:?$/.test(cell))
}

function tableAlignment(dividerCell) {
  const value = String(dividerCell || '')
  if (value.startsWith(':') && value.endsWith(':')) return 'center'
  if (value.endsWith(':')) return 'right'
  return 'left'
}

function tableNode(header, divider, rows) {
  const alignments = divider.map(tableAlignment)
  const columnCount = header.length
  const fontSize = columnCount >= 5 ? 21 : columnCount === 4 ? 22 : 24
  const cellStyle = (index, headerCell = false) => [
    `padding:${headerCell ? 16 : 15}rpx ${columnCount >= 5 ? 7 : 13}rpx`,
    'border:1px solid #D5E2DA',
    `text-align:${alignments[index] || 'left'}`,
    'vertical-align:middle',
    'white-space:normal',
    'word-break:normal',
    'overflow-wrap:anywhere',
    `font-size:${fontSize}rpx`,
    'line-height:1.55',
    headerCell ? 'font-weight:700' : '',
    headerCell ? 'background:#EAF4EE' : 'background:#FFFFFF',
    headerCell ? 'color:#174E3A' : 'color:#27332C'
  ].filter(Boolean).join(';') + ';'
  const rowNode = (cells, name) => elementNode('tr', header.map((_, index) =>
    elementNode(name, parseInline(cells[index] || ''), { style: cellStyle(index, name === 'th') })
  ))

  return elementNode('div', [
    elementNode('table', [
      elementNode('thead', [rowNode(header, 'th')]),
      elementNode('tbody', rows.map(row => rowNode(row, 'td')))
    ], {
      style: 'width:100%;border-collapse:collapse;border-spacing:0;table-layout:fixed;'
    })
  ], {
    style: 'display:block;width:100%;margin:24rpx 0 38rpx;overflow:hidden;border-radius:12rpx;background:#FFFFFF;'
  })
}

function markdownToRichTextNodes(markdown, options = {}) {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n')
  const nodes = []

  let index = 0
  while (index < lines.length) {
    const header = parseTableCells(lines[index])
    let dividerIndex = index + 1
    while (dividerIndex < lines.length && !lines[dividerIndex].trim()) dividerIndex += 1
    if (header.length > 1 && dividerIndex < lines.length && isTableDivider(lines[dividerIndex], header.length)) {
      const divider = parseTableCells(lines[dividerIndex])
      const rows = []
      index = dividerIndex + 1
      while (index < lines.length) {
        if (!lines[index].trim()) { index += 1; continue }
        const cells = parseTableCells(lines[index])
        if (cells.length !== header.length) break
        rows.push(cells)
        index += 1
      }
      nodes.push(tableNode(header, divider, rows))
      continue
    }

    nodes.push(...parseLine(lines[index], options))
    index += 1
  }

  return nodes.length ? nodes : [textNode('')]
}

module.exports = { markdownToRichTextNodes }
