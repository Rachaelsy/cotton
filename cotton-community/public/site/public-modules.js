(() => {
  const API = {
    policies: '/api/policies',
    experts: '/api/expert-studio/public',
    products: '/api/service-products',
    processing: '/api/processing-factories',
    varieties: '/api/cotton-varieties',
    pests: '/api/pest-knowledge'
  }

  const PRODUCT_META = {
    machinery: { title: '农机服务', eyebrow: 'MACHINERY SERVICE', description: '查看管理员发布的棉花生产农机与作业机型。', categories: ['耕整地', '播种铺膜', '田间管理', '采收运输'] },
    supplies: { title: '农资服务', eyebrow: 'AGRICULTURAL INPUTS', description: '查看管理员发布的种子、肥料、农药和地膜产品。', categories: ['种子', '肥料', '农药', '地膜'] }
  }

  const SERVICE_LINKS = [
    ['machinery', '农机服务'], ['supplies', '农资服务'], ['processing', '加工服务']
  ]

  function create(context) {
    const { main, escapeHtml, publicLink, setMeta, setActiveNav } = context
    const runtime = window.CottonRuntime

    const safeUrl = value => {
      const url = String(value || '').trim()
      if (/^https?:\/\//i.test(url) || url.startsWith('/')) return url
      return ''
    }
    const dateText = value => String(value || '').slice(0, 10) || '待发布'
    const numberText = (value, digits = 1) => value === null || value === undefined || value === ''
      ? '—'
      : Number(value).toFixed(digits).replace(/\.?0+$/, '')
    const request = async path => (await runtime.requestJson(path)).data

    function inlineMarkdown(value) {
      let html = escapeHtml(value)
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/g, (_all, label, url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`)
      return html
    }

    function markdownToHtml(markdown) {
      const lines = String(markdown || '').replace(/\r/g, '').split('\n')
      const result = []
      let listOpen = false
      const closeList = () => { if (listOpen) { result.push('</ul>'); listOpen = false } }
      lines.forEach(line => {
        const text = line.trim()
        const image = text.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)$/)
        const heading = text.match(/^(#{1,3})\s+(.+)$/)
        const bullet = text.match(/^[-*]\s+(.+)$/)
        if (!text) { closeList(); return }
        if (image) { closeList(); result.push(`<figure><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" loading="lazy"></figure>`); return }
        if (heading) { closeList(); const level = Math.min(3, heading[1].length + 1); result.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); return }
        if (bullet) {
          if (!listOpen) { result.push('<ul>'); listOpen = true }
          result.push(`<li>${inlineMarkdown(bullet[1])}</li>`)
          return
        }
        closeList()
        result.push(`<p>${inlineMarkdown(text)}</p>`)
      })
      closeList()
      return result.join('') || '<p>正文内容正在整理。</p>'
    }

    function loading(title = '正在加载内容') {
      main.innerHTML = `<section class="public-module-loading"><div class="shell"><span></span><strong>${escapeHtml(title)}</strong><p>内容与小程序使用同一数据库，请稍候。</p></div></section>`
    }

    function errorPanel(error, back = '/') {
      main.innerHTML = `<section class="public-module-loading error"><div class="shell"><strong>内容加载失败</strong><p>${escapeHtml(error?.message || '请稍后重试')}</p><a class="button primary" href="${publicLink(back)}">返回列表</a></div></section>`
    }

    function moduleHero(eyebrow, title, description, active) {
      setMeta(title, description)
      setActiveNav(active)
      return `<section class="public-module-hero"><div class="shell"><span class="eyebrow">${escapeHtml(eyebrow)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div></section>`
    }

    function serviceTabs(active) {
      return `<nav class="module-switch" aria-label="生产服务分类">${SERVICE_LINKS.map(([path, label]) => `<a class="${active === path ? 'active' : ''}" href="${publicLink(`/${path}`)}">${label}</a>`).join('')}</nav>`
    }

    function imageBlock(url, alt, className = 'module-card-image') {
      const source = safeUrl(url)
      return source
        ? `<div class="${className}"><img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}" loading="lazy"></div>`
        : `<div class="${className} placeholder" aria-hidden="true"><span>棉</span></div>`
    }

    function empty(title, description) {
      return `<div class="module-empty"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(description)}</p></div>`
    }

    function filterBar(items, active = '全部') {
      return `<div class="module-filter" role="tablist">${items.map(item => `<button type="button" role="tab" data-filter="${escapeHtml(item)}" aria-selected="${item === active}" class="${item === active ? 'active' : ''}">${escapeHtml(item)}</button>`).join('')}</div>`
    }

    function bindFilters(rows, renderRows) {
      const holder = document.getElementById('moduleRows')
      document.querySelector('.module-filter')?.addEventListener('click', event => {
        const button = event.target.closest('[data-filter]')
        if (!button) return
        document.querySelectorAll('.module-filter button').forEach(item => {
          item.classList.toggle('active', item === button)
          item.setAttribute('aria-selected', String(item === button))
        })
        holder.innerHTML = renderRows(rows, button.dataset.filter)
      })
    }

    function homeSection() {
      const cards = [
        ['policies', '政', '政策资讯', '政策文件、行业资讯与办事指南'],
        ['experts', '专', '专家讲堂', '精选问答、在线专家与视频'],
        ['finance', '金', '优棉金融', '种植贷、保险、期货与政策解读'],
        ['machinery', '机', '农机服务', '作业类型与具体机型'],
        ['supplies', '资', '农资服务', '种子、肥料、农药与地膜'],
        ['processing', '加', '加工服务', '轧花、检测、仓储与加工厂'],
        ['varieties', '种', '品种优选', '试验指标、单项表现与适配参考']
      ]
      return `<section class="section-block public-data-section"><div class="shell"><div class="section-heading"><div><span class="eyebrow">SHARED DATA SERVICES</span><h2>公共服务内容</h2><p>以下内容由管理员统一维护，在小程序和网页端同步发布。</p></div></div><div class="public-data-grid">${cards.map(([path, icon, title, desc]) => `<a class="public-data-card" href="${publicLink(`/${path}`)}"><span>${icon}</span><div><strong>${title}</strong><p>${desc}</p></div><b>→</b></a>`).join('')}</div></div></section>`
    }

    async function renderPolicies() {
      loading('正在加载政策资讯')
      try {
        const rows = await request(API.policies)
        const filters = ['全部', '政策中心', '行业资讯']
        const renderRows = (list, filter) => {
          const visible = filter === '政策中心' ? list.filter(item => item.contentType === 'policy') : filter === '行业资讯' ? list.filter(item => item.contentType === 'industry') : list
          return visible.length ? visible.map(item => `<article class="module-list-row ${item.coverImage ? 'has-image' : ''}"><div><div class="module-meta"><span>${escapeHtml(item.contentType === 'industry' ? '行业资讯' : '政策中心')}</span><span>${escapeHtml(item.section || item.level || item.category)}</span></div><h2><a href="${publicLink(`/policies/${item.id}`)}">${escapeHtml(item.title)}</a></h2><p>${escapeHtml(item.issuer || item.region || '喀什优棉公共服务平台')} · ${dateText(item.publishDate)}</p></div>${item.coverImage ? imageBlock(item.coverImage, item.title, 'module-row-image') : ''}</article>`).join('') : empty('当前分类暂无内容', '管理员发布后会同时显示在小程序和网页端。')
        }
        main.innerHTML = `${moduleHero('POLICY & INDUSTRY', '政策资讯', '汇集各级棉花政策、办事指南与产业、农机、农资、市场、气象资讯。', 'policies')}<section class="module-page"><div class="shell">${filterBar(filters)}<div id="moduleRows" class="module-list">${renderRows(rows, '全部')}</div></div></section>`
        bindFilters(rows, renderRows)
      } catch (error) { errorPanel(error, '/') }
    }

    async function renderArticleDetail(id, type = 'policy') {
      loading('正在加载文章正文')
      try {
        const item = await request(`${API.policies}/${encodeURIComponent(id)}`)
        const back = type === 'finance' ? '/finance' : '/policies'
        const label = item.contentType === 'finance' ? '优棉金融' : item.contentType === 'industry' ? '行业资讯' : item.contentType === 'home' ? '首页推送' : '政策资讯'
        setMeta(item.title, item.summary || item.title)
        setActiveNav(type === 'finance' ? 'finance' : 'policies')
        main.innerHTML = `<article class="database-article"><header><div class="shell"><a class="article-back" href="${publicLink(back)}">← 返回${escapeHtml(label)}</a><span class="article-channel">${escapeHtml(label)} · ${escapeHtml(item.section || item.category || item.level)}</span><h1>${escapeHtml(item.title)}</h1><div class="database-article-meta"><span>${escapeHtml(item.issuer || '喀什优棉公共服务平台')}</span><time>${dateText(item.publishDate)}</time>${item.documentNo ? `<span>${escapeHtml(item.documentNo)}</span>` : ''}</div></div></header><div class="shell database-article-layout"><div class="database-article-body">${markdownToHtml(item.markdown)}${item.originalUrl ? `<aside class="article-source"><strong>原文核验</strong><p>办理条件与时限请以发布单位原文为准。</p><a href="${escapeHtml(safeUrl(item.originalUrl))}" target="_blank" rel="noopener noreferrer">查看官方原文 →</a></aside>` : ''}</div><aside class="database-article-aside"><strong>信息说明</strong><dl><div><dt>栏目</dt><dd>${escapeHtml(item.section || item.category || item.level)}</dd></div><div><dt>适用地区</dt><dd>${escapeHtml(item.region || '以原文为准')}</dd></div><div><dt>发布时间</dt><dd>${dateText(item.publishDate)}</dd></div></dl></aside></div></article>`
      } catch (error) { errorPanel(error, type === 'finance' ? '/finance' : '/policies') }
    }

    async function renderExperts() {
      loading('正在加载专家讲堂')
      try {
        const data = await request(API.experts)
        const contents = data.contents || []
        const experts = data.experts || []
        main.innerHTML = `${moduleHero('EXPERT STUDIO', '专家讲堂', '精选问答和在线专家均由公共服务管理员统一维护。', 'experts')}<section class="module-page"><div class="shell"><div class="expert-web-section"><div class="module-section-title"><span>问</span><div><h2>精选问答</h2><p>围绕棉花生产期间常见问题的文字解答</p></div></div><div class="module-list">${contents.filter(item => item.type === 'qa').map(expertContentRow).join('') || empty('暂无精选问答', '管理员发布问答后会显示在这里。')}</div></div><div class="expert-web-section"><div class="module-section-title"><span>专</span><div><h2>在线专家</h2><p>专家资料与小程序同步</p></div></div><div class="web-expert-grid">${experts.map(item => `<article><div class="web-expert-avatar">${item.avatarUrl ? `<img src="${escapeHtml(safeUrl(item.avatarUrl))}" alt="">` : escapeHtml(item.avatar || '专')}</div><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml([item.title, item.org].filter(Boolean).join(' · '))}</p><div>${(item.tags || []).map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div></div></article>`).join('') || empty('暂无在线专家', '管理员维护专家资料后会显示在这里。')}</div></div></div></section>`
      } catch (error) { errorPanel(error, '/') }
    }

    function expertContentRow(item) {
      return `<article class="module-list-row"><div><div class="module-meta"><span>${escapeHtml(item.categoryName || '精选问答')}</span><span>${escapeHtml(item.expertName || item.teacher || '平台专家')}</span></div><h2><a href="${publicLink(`/experts/${item.id}`)}">${escapeHtml(item.title)}</a></h2><p>${escapeHtml(item.subtitle || item.intro || '')}</p></div></article>`
    }

    async function renderExpertDetail(id) {
      loading('正在加载专家内容')
      try {
        const item = await request(`${API.experts}/${encodeURIComponent(id)}`)
        setMeta(item.title, item.subtitle || item.intro)
        setActiveNav('experts')
        main.innerHTML = `<section class="web-faq-page"><div class="shell"><a class="article-back" href="${publicLink('/experts')}">← 返回专家讲堂</a><div class="web-faq-card"><div class="web-faq-question"><span class="web-faq-mark">问</span><h1>${escapeHtml(item.title)}</h1></div><div class="web-faq-divider"></div><div class="web-faq-answer"><span class="web-faq-mark">答</span><div>${item.intro ? `<p class="web-faq-lead">${escapeHtml(item.intro)}</p>` : ''}<div class="database-article-body">${markdownToHtml(item.content || '')}</div></div></div><footer><span>${escapeHtml(item.categoryName || '棉花生产')}</span><span>解答：${escapeHtml(item.expertName || item.teacher || '平台农技组')}</span></footer></div></div></section>`
      } catch (error) { errorPanel(error, '/experts') }
    }

    async function renderFinance() {
      loading('正在加载优棉金融')
      try {
        const articles = await request(`${API.policies}?type=finance`)
        const sections = [['loan', '种植贷'], ['insurance', '棉花保险'], ['futures', '期货基础'], ['policy', '金融政策解读']]
        main.innerHTML = `${moduleHero('YOU MIAN FINANCE', '优棉金融', '提供种植贷、棉花保险、期货基础和金融政策知识，不展示行情，不开展交易或销售。', 'finance')}<section class="module-page"><div class="shell"><div class="finance-web-grid">${sections.map(([key, label]) => { const items = articles.filter(item => item.section === key); return `<section><div class="module-section-title"><span>${label.slice(0, 1)}</span><div><h2>${label}</h2><p>${items.length} 篇已发布内容</p></div></div><div class="module-list compact">${items.map(item => `<article class="module-list-row"><div><h3><a href="${publicLink(`/finance/${item.id}`)}">${escapeHtml(item.title)}</a></h3><p>${escapeHtml(item.issuer || '公共服务平台')} · ${dateText(item.publishDate)}</p></div></article>`).join('') || empty(`暂无${label}内容`, '管理员发布后会同步展示。')}</div></section>` }).join('')}</div></div></section>`
      } catch (error) { errorPanel(error, '/') }
    }

    async function renderPests() {
      loading('正在加载病虫害知识')
      try {
        const rows = await request(API.pests)
        const filters = ['全部', '虫害', '病害', '生理性']
        const renderRows = (list, filter) => {
          const visible = filter === '全部' ? list : list.filter(item => item.categoryName === filter)
          return visible.length ? visible.map(item => `<article class="module-card">${imageBlock(item.coverUrl, item.name)}<div><span class="module-badge">${escapeHtml(item.categoryName)}</span><h2><a href="${publicLink(`/pests/${item.id}`)}">${escapeHtml(item.icon || '🌿')} ${escapeHtml(item.name)}</a></h2><p>${escapeHtml(item.summary)}</p></div></article>`).join('') : empty('当前分类暂无内容', '管理员发布病虫害知识后会同步显示。')
        }
        main.innerHTML = `${moduleHero('FIELD DIAGNOSIS', '病虫害知识', '查看管理员发布的棉花病害、虫害和生理性问题识别与防治知识。', 'pests')}<section class="module-page"><div class="shell">${filterBar(filters)}<div id="moduleRows" class="module-card-grid">${renderRows(rows, '全部')}</div></div></section>`
        bindFilters(rows, renderRows)
      } catch (error) { errorPanel(error, '/') }
    }

    async function renderPestDetail(id) {
      loading('正在加载病虫害知识详情')
      try {
        const item = await request(`${API.pests}/${encodeURIComponent(id)}`)
        setMeta(item.name, item.summary)
        setActiveNav('pests')
        const symptoms = (item.symptoms || []).map(text => `<li>${escapeHtml(text)}</li>`).join('')
        main.innerHTML = `<section class="product-detail-page"><div class="shell"><a class="article-back" href="${publicLink('/pests')}">← 返回病虫害知识</a><div class="product-detail-layout">${imageBlock(item.coverUrl, item.name, 'product-detail-image')}<div><span class="module-badge">${escapeHtml(item.categoryName)}</span><h1>${escapeHtml(item.icon || '🌿')} ${escapeHtml(item.name)}</h1><p class="product-lead">${escapeHtml(item.summary)}</p>${symptoms ? `<section class="product-copy"><h2>典型症状</h2><ul>${symptoms}</ul></section>` : ''}<section class="product-copy"><h2>防治建议</h2><p>${escapeHtml(item.treatmentAdvice)}</p></section>${item.medicationWarning ? `<section class="product-copy"><h2>用药提醒</h2><p>${escapeHtml(item.medicationWarning)}</p></section>` : ''}${item.sourceName || item.sourceUrl ? `<section class="product-copy"><h2>资料来源</h2><p>${escapeHtml(item.sourceName || '')}</p>${item.sourceUrl ? `<a href="${escapeHtml(safeUrl(item.sourceUrl))}" target="_blank" rel="noopener noreferrer">查看来源 →</a>` : ''}</section>` : ''}</div></div></div></section>`
      } catch (error) { errorPanel(error, '/pests') }
    }

    function productCards(rows, type, filter = '全部') {
      const visible = filter === '全部' ? rows : rows.filter(item => item.category === filter)
      return visible.length ? visible.map(item => `<article class="module-card">${imageBlock(item.coverUrl, item.name)}<div><span class="module-badge">${escapeHtml(item.category)}</span><h2><a href="${publicLink(`/${type}/${item.id}`)}">${escapeHtml(item.name)}</a></h2><p>${escapeHtml([item.brand, item.modelName].filter(Boolean).join(' · ') || item.intro)}</p><div class="module-tags">${(item.features || []).slice(0, 3).map(feature => `<span>${escapeHtml(feature)}</span>`).join('')}</div></div></article>`).join('') : empty('当前分类暂无产品', '管理员上架后会同时显示在小程序和网页端。')
    }

    async function renderProducts(type) {
      const meta = PRODUCT_META[type]
      loading(`正在加载${meta.title}`)
      try {
        const rows = await request(`${API.products}?type=${type}`)
        const renderRows = (list, filter) => productCards(list, type, filter)
        main.innerHTML = `${moduleHero(meta.eyebrow, meta.title, meta.description, 'services')}<section class="module-page"><div class="shell">${serviceTabs(type)}${filterBar(['全部', ...meta.categories])}<div id="moduleRows" class="module-card-grid">${renderRows(rows, '全部')}</div></div></section>`
        bindFilters(rows, renderRows)
      } catch (error) { errorPanel(error, '/') }
    }

    async function renderProductDetail(type, id) {
      const meta = PRODUCT_META[type]
      loading(`正在加载${meta.title}详情`)
      try {
        const rows = await request(`${API.products}?type=${type}`)
        const item = rows.find(row => String(row.id) === String(id))
        if (!item) throw new Error('产品不存在或尚未发布')
        setMeta(item.name, item.intro)
        setActiveNav('services')
        main.innerHTML = `<section class="product-detail-page"><div class="shell"><a class="article-back" href="${publicLink(`/${type}`)}">← 返回${meta.title}</a><div class="product-detail-layout">${imageBlock(item.coverUrl, item.name, 'product-detail-image')}<div><span class="module-badge">${escapeHtml(item.category)}</span><h1>${escapeHtml(item.name)}</h1><p class="product-lead">${escapeHtml(item.intro)}</p><dl class="product-facts"><div><dt>品牌</dt><dd>${escapeHtml(item.brand || '—')}</dd></div><div><dt>型号/品种</dt><dd>${escapeHtml(item.modelName || '—')}</dd></div><div><dt>生产企业</dt><dd>${escapeHtml(item.manufacturer || '—')}</dd></div><div><dt>适用地区</dt><dd>${escapeHtml(item.region || '—')}</dd></div></dl><div class="module-tags large">${(item.features || []).map(feature => `<span>${escapeHtml(feature)}</span>`).join('')}</div>${item.applicable ? `<section class="product-copy"><h2>适用说明</h2><p>${escapeHtml(item.applicable)}</p></section>` : ''}</div></div></div></section>`
      } catch (error) { errorPanel(error, `/${type}`) }
    }

    async function renderProcessing() {
      loading('正在加载加工服务')
      try {
        const rows = await request(API.processing)
        main.innerHTML = `${moduleHero('PROCESSING SERVICE', '加工服务', '了解轧花、检测、仓储服务，并查看管理员维护的加工厂公开资料。', 'services')}<section class="module-page"><div class="shell">${serviceTabs('processing')}<div class="processing-concepts"><article><span>轧</span><h2>轧花</h2><p>籽棉清理、轧花、皮棉整理与打包。</p></article><article><span>检</span><h2>检测</h2><p>围绕衣分、回潮率和质量指标开展检测。</p></article><article><span>仓</span><h2>仓储</h2><p>规范堆放、批次管理与出入库衔接。</p></article></div><div class="module-section-title"><span>厂</span><div><h2>加工厂名录</h2><p>位置和联系方式由管理员统一维护</p></div></div><div class="module-card-grid">${rows.map(item => `<article class="module-card">${imageBlock((item.imageUrls || [])[0], item.name)}<div><span class="module-badge">${escapeHtml(item.county)}</span><h2><a href="${publicLink(`/processing/${item.id}`)}">${escapeHtml(item.name)}</a></h2><p>${escapeHtml(item.address)}</p><div class="module-tags">${(item.services || []).slice(0, 3).map(service => `<span>${escapeHtml(service)}</span>`).join('')}</div></div></article>`).join('') || empty('暂无加工厂资料', '管理员发布后会同时显示在小程序和网页端。')}</div></div></section>`
      } catch (error) { errorPanel(error, '/') }
    }

    async function renderProcessingDetail(id) {
      loading('正在加载加工厂详情')
      try {
        const item = await request(`${API.processing}/${encodeURIComponent(id)}`)
        setMeta(item.name, item.intro)
        setActiveNav('services')
        const mapUrl = `https://uri.amap.com/marker?position=${encodeURIComponent(`${item.longitude},${item.latitude}`)}&name=${encodeURIComponent(item.name)}`
        main.innerHTML = `<section class="product-detail-page"><div class="shell"><a class="article-back" href="${publicLink('/processing')}">← 返回加工服务</a><div class="factory-gallery">${(item.imageUrls || []).length ? item.imageUrls.map(url => `<img src="${escapeHtml(safeUrl(url))}" alt="${escapeHtml(item.name)}" loading="lazy">`).join('') : imageBlock('', item.name, 'product-detail-image')}</div><div class="factory-detail-head"><div><span class="module-badge">${escapeHtml(item.county)}</span><h1>${escapeHtml(item.name)}</h1><p>${escapeHtml(item.intro)}</p></div><a class="button primary" href="${mapUrl}" target="_blank" rel="noopener noreferrer">在地图中查看</a></div><dl class="factory-facts"><div><dt>地址</dt><dd>${escapeHtml(item.address)}</dd></div><div><dt>年加工产能</dt><dd>${item.annualCapacityTons ? `${numberText(item.annualCapacityTons, 0)} 吨` : '—'}</dd></div><div><dt>负责人</dt><dd>${escapeHtml(item.managerName || '—')}</dd></div><div><dt>联系电话</dt><dd>${escapeHtml(item.contactPhone || '—')}</dd></div><div><dt>经纬度</dt><dd>${numberText(item.longitude, 6)}, ${numberText(item.latitude, 6)}</dd></div><div><dt>公开信息核验</dt><dd>${escapeHtml(item.verifiedAt || '以管理员发布信息为准')}</dd></div></dl></div></section>`
      } catch (error) { errorPanel(error, '/processing') }
    }

    function varietyCards(rows, sort) {
      return rows.map((item, index) => {
        const rank = sort === 'yield' ? item.yieldRank : sort === 'lint' ? item.lintRank : sort === 'quality' ? index + 1 : item.overallRank
        const value = sort === 'yield' ? `${numberText(item.seedCottonYieldKgMu)} kg/亩` : sort === 'lint' ? `${numberText(item.lintPercent)}%` : sort === 'quality' ? `${numberText(item.fiberLengthMm)} mm · ${numberText(item.fiberStrengthCnTex)} cN/tex` : numberText(item.weightedTotal, 2)
        return `<article class="variety-web-row"><b>${rank || '—'}</b><div><span>${escapeHtml(item.trialYear)} 年 · ${escapeHtml(item.trialArea)}</span><h2><a href="${publicLink(`/varieties/${item.id}`)}">${escapeHtml(item.name)}</a></h2><p>${escapeHtml(item.suitableConditions || '适配信息待管理员补充')}</p></div><strong>${escapeHtml(value)}</strong></article>`
      }).join('') || empty('暂无品种数据', '管理员发布试验数据后会同步展示。')
    }

    async function renderVarieties() {
      loading('正在加载品种优选')
      try {
        const sorts = [['overall', '综合优选'], ['yield', '产量表现'], ['quality', '纤维品质'], ['lint', '衣分表现']]
        const initial = await request(`${API.varieties}?sort=overall`)
        main.innerHTML = `${moduleHero('VARIETY SELECTION', '品种优选', '依据喀什地区品种对比试验展示综合和单项指标，不替代审定结论或购买推荐。', 'varieties')}<section class="module-page"><div class="shell"><div class="module-filter" role="tablist">${sorts.map(([key, label], index) => `<button data-sort="${key}" class="${index === 0 ? 'active' : ''}" aria-selected="${index === 0}">${label}</button>`).join('')}</div><div class="variety-note">排名仅反映同年度、同试验区域的对比结果；切换指标后按对应单项重新排序。</div><div id="varietyRows" class="variety-web-list">${varietyCards(initial, 'overall')}</div></div></section>`
        document.querySelector('.module-filter')?.addEventListener('click', async event => {
          const button = event.target.closest('[data-sort]')
          if (!button) return
          document.querySelectorAll('[data-sort]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-selected', String(item === button)) })
          const holder = document.getElementById('varietyRows')
          holder.innerHTML = '<div class="module-empty"><p>正在切换指标...</p></div>'
          try { holder.innerHTML = varietyCards(await request(`${API.varieties}?sort=${button.dataset.sort}`), button.dataset.sort) } catch (error) { holder.innerHTML = empty('数据加载失败', error.message) }
        })
      } catch (error) { errorPanel(error, '/') }
    }

    async function renderVarietyDetail(id) {
      loading('正在加载品种详情')
      try {
        const item = await request(`${API.varieties}/${encodeURIComponent(id)}`)
        setMeta(item.name, `${item.trialYear}年${item.trialArea}品种对比试验指标`)
        setActiveNav('varieties')
        const indicators = [['籽棉产量', `${numberText(item.seedCottonYieldKgMu)} kg/亩`, item.yieldRank], ['衣分', `${numberText(item.lintPercent)}%`, item.lintRank], ['纤维长度', `${numberText(item.fiberLengthMm)} mm`, item.fiberLengthRank], ['断裂比强度', `${numberText(item.fiberStrengthCnTex)} cN/tex`, item.fiberStrengthRank], ['马克隆值', numberText(item.micronaireValue), item.micronaireRank], ['整齐度', `${numberText(item.uniformityPercent)}%`, item.uniformityRank]]
        main.innerHTML = `<section class="variety-detail-page"><div class="shell"><a class="article-back" href="${publicLink('/varieties')}">← 返回品种优选</a><header><span>${item.trialYear} 年 · ${escapeHtml(item.trialArea)}</span><h1>${escapeHtml(item.name)}</h1><p>综合名次 ${item.overallRank || '—'} · 综合加权值 ${numberText(item.weightedTotal, 2)}</p></header><div class="indicator-grid">${indicators.map(([label, value, rank]) => `<article><span>${label}</span><strong>${value}</strong><small>单项名次 ${rank || '—'}</small></article>`).join('')}</div><div class="variety-detail-grid"><section><h2>适宜条件</h2><p>${escapeHtml(item.suitableConditions || '待管理员补充')}</p><h2>特点</h2><ul>${(item.strengths || []).map(text => `<li>${escapeHtml(text)}</li>`).join('') || '<li>待管理员补充</li>'}</ul></section><section><h2>推荐县市参考</h2><div class="module-tags large">${(item.recommendedCounties || []).map(text => `<span>${escapeHtml(text)}</span>`).join('') || '<span>待进一步匹配分析</span>'}</div><h2>数据来源</h2><p>${escapeHtml(item.sourceName || '管理员录入的品种对比试验统计表')}</p></section></div></div></section>`
      } catch (error) { errorPanel(error, '/varieties') }
    }

    return { homeSection, renderPolicies, renderArticleDetail, renderExperts, renderExpertDetail, renderFinance, renderPests, renderPestDetail, renderProducts, renderProductDetail, renderProcessing, renderProcessingDetail, renderVarieties, renderVarietyDetail }
  }

  window.COTTON_PUBLIC_MODULES = { create }
})()
