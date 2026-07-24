(() => {
  const data = window.COTTON_SITE_DATA
  const main = document.getElementById('mainContent')
  const base = '/knowledge'

  const routePath = window.location.pathname
    .replace(/^\/knowledge/, '')
    .replace(/\/+$/, '') || '/'

  const pathParts = routePath.split('/').filter(Boolean)
  const pageGroup = pathParts[0] || 'home'

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

  const link = path => `${base}${path === '/' ? '/' : path}`
  const productById = id => data.products.find(item => item.id === id)
  const trainingById = id => data.training.find(item => item.id === id)
  const newsById = id => data.news.find(item => item.id === id)

  function setMeta(title, description) {
    document.title = `${title} · ${data.company.name}`
    const meta = document.querySelector('meta[name="description"]')
    if (meta && description) meta.setAttribute('content', description)
  }

  function setActiveNav(group) {
    document.querySelectorAll('[data-nav]').forEach(item => {
      const active = item.dataset.nav === group
      item.classList.toggle('active', active)
      if (active) item.setAttribute('aria-current', 'page')
      else item.removeAttribute('aria-current')
    })
  }

  function productVisual(item, extraClass = '') {
    return `<div class="product-visual visual-${escapeHtml(item.visual)} ${extraClass}" role="img" aria-label="${escapeHtml(item.name)}产品示意图"></div>`
  }

  function productCard(item) {
    return `
      <article class="product-card">
        <a class="product-image-link" href="${link(`/products/${item.id}`)}" aria-label="查看${escapeHtml(item.name)}">
          ${productVisual(item)}
          <span class="product-badge">${escapeHtml(item.badge)}</span>
        </a>
        <div class="product-card-body">
          <span class="item-category">${escapeHtml(item.categoryName)}</span>
          <h3><a href="${link(`/products/${item.id}`)}">${escapeHtml(item.name)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
          <div class="tag-row">${item.highlights.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
          <a class="text-link" href="${link(`/products/${item.id}`)}">查看产品详情 <span aria-hidden="true">→</span></a>
        </div>
      </article>`
  }

  function trainingCard(item) {
    return `
      <article class="article-card">
        <a class="article-image" href="${link(`/training/${item.id}`)}">
          <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy">
          <span>${escapeHtml(item.categoryName)}</span>
        </a>
        <div class="article-card-body">
          <div class="article-meta"><span>${escapeHtml(item.categoryName)}</span><span>${escapeHtml(item.readTime)}</span></div>
          <h3><a href="${link(`/training/${item.id}`)}">${escapeHtml(item.title)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
          <a class="text-link" href="${link(`/training/${item.id}`)}">阅读全文 <span aria-hidden="true">→</span></a>
        </div>
      </article>`
  }

  function newsCard(item, compact = false) {
    return `
      <article class="news-card ${compact ? 'compact' : ''}">
        <a class="news-image" href="${link(`/news/${item.id}`)}"><img src="${item.image}" alt="" loading="lazy"></a>
        <div class="news-card-body">
          <div class="article-meta"><span>${escapeHtml(item.categoryName)}</span><time datetime="${item.date}">${item.date}</time></div>
          <h3><a href="${link(`/news/${item.id}`)}">${escapeHtml(item.title)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
          <a class="text-link" href="${link(`/news/${item.id}`)}">查看资讯 <span aria-hidden="true">→</span></a>
        </div>
      </article>`
  }

  function pageHero(kicker, title, description, className = '') {
    return `
      <section class="page-hero ${className}">
        <div class="shell">
          <nav class="breadcrumbs" aria-label="面包屑"><a href="${link('/')}">首页</a><span>/</span><span>${escapeHtml(title)}</span></nav>
          <span class="eyebrow">${escapeHtml(kicker)}</span>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(description)}</p>
        </div>
      </section>`
  }

  function sectionHeading(kicker, title, description = '', action = '') {
    return `
      <div class="section-heading">
        <div><span class="eyebrow">${escapeHtml(kicker)}</span><h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div>
        ${action}
      </div>`
  }

  function renderHome() {
    setMeta('首页', '面向新疆棉区的农资产品、棉花培训、行业资讯与田间服务')
    setActiveNav('home')

    main.innerHTML = `
      <section class="home-hero">
        <div class="home-hero-shade"></div>
        <div class="shell home-hero-inner">
          <div class="hero-copy">
            <span class="hero-kicker">扎根新疆 · 服务棉田</span>
            <h1>棉知农业服务</h1>
            <p>连接可靠农资、棉花种植知识与持续田间服务，让每一次投入更清楚，让每一个管理决定更有依据。</p>
            <div class="hero-actions">
              <a class="button primary" href="${link('/products')}">浏览农资产品</a>
              <a class="button light" href="${link('/training')}">学习种植知识</a>
            </div>
          </div>
          <div class="hero-facts" aria-label="服务内容">
            <div><strong>5</strong><span>类农资产品</span></div>
            <div><strong>6</strong><span>个生育期专题</span></div>
            <div><strong>全程</strong><span>知识与咨询服务</span></div>
          </div>
        </div>
      </section>

      <section class="service-ribbon">
        <div class="shell service-ribbon-grid">
          <div><strong>农资展示</strong><span>种子、肥料、植保、农膜和滴灌材料</span></div>
          <div><strong>种植培训</strong><span>从播种到采收的图文知识与检查清单</span></div>
          <div><strong>棉区资讯</strong><span>政策提示、行业观察与服务动态</span></div>
          <div><strong>人工咨询</strong><span>根据地块和生育期整理服务需求</span></div>
        </div>
      </section>

      <section class="section-block">
        <div class="shell">
          ${sectionHeading('PRODUCTS', '棉田生产资料', '查看产品信息、适用场景与配套服务。', `<a class="section-action" href="${link('/products')}">查看全部产品</a>`)}
          <div class="product-grid">${data.products.slice(0, 4).map(productCard).join('')}</div>
        </div>
      </section>

      <section class="section-block service-section">
        <div class="shell split-intro">
          <div class="service-image"><img src="/assets/cotton-seedling-leaf-inspection-v1.jpg" alt="技术人员观察棉花叶片"></div>
          <div class="service-copy">
            <span class="eyebrow">FIELD SERVICE</span>
            <h2>从卖产品，走向解决田间问题</h2>
            <p>产品展示只是服务起点。我们希望把品种选择、投入品核验、滴灌运行、田间观察和生产记录连接起来，让农户在需要判断时能找到清晰的信息和可以联系的人。</p>
            <div class="service-points">
              <div><strong>选品前</strong><span>核对地块、品种、生育期与设备条件</span></div>
              <div><strong>使用中</strong><span>提供标签核验、记录模板和注意事项</span></div>
              <div><strong>作业后</strong><span>根据固定样点和管理记录复盘效果</span></div>
            </div>
            <a class="button outline" href="${link('/contact')}">提交服务需求</a>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="shell">
          ${sectionHeading('COTTON TRAINING', '棉花全生育期培训', '围绕当下田间阶段学习，文章末尾附有可执行的检查清单。', `<a class="section-action" href="${link('/training')}">进入培训专区</a>`)}
          <div class="stage-nav">
            ${data.training.map((item, index) => `
              <a href="${link(`/training/${item.id}`)}">
                <span>${String(index + 1).padStart(2, '0')}</span>
                <strong>${escapeHtml(item.categoryName)}</strong>
                <small>${escapeHtml(item.title)}</small>
              </a>`).join('')}
          </div>
          <div class="article-grid home-articles">${data.training.slice(0, 3).map(trainingCard).join('')}</div>
        </div>
      </section>

      <section class="academy-band">
        <div class="shell academy-band-inner">
          <div>
            <span class="eyebrow">COMMUNITY LEARNING</span>
            <h2>文章看完还有问题，进入互动学堂继续交流</h2>
            <p>登录后可以保存进度、参与评论、发起田间问题，也可以围绕课程内容使用 AI 助学。</p>
          </div>
          <a class="button light" href="${link('/academy')}">进入互动学堂</a>
        </div>
      </section>

      <section class="section-block">
        <div class="shell">
          ${sectionHeading('NEWS', '资讯与动态', '关注政策信息核验、棉花产业变化和服务进展。', `<a class="section-action" href="${link('/news')}">查看全部资讯</a>`)}
          <div class="news-grid">${data.news.slice(0, 3).map(item => newsCard(item, true)).join('')}</div>
        </div>
      </section>

      <section class="contact-band">
        <div class="shell contact-band-inner">
          <div><span class="eyebrow">SERVICE CONTACT</span><h2>告诉我们你的地块和当前问题</h2><p>产品价格、规格和田间服务均由服务人员进一步确认。</p></div>
          <a class="button primary" href="${link('/contact')}">联系服务团队</a>
        </div>
      </section>`
  }

  function renderProducts() {
    setMeta('农资产品', '展示棉花种子、肥料、植保产品、农膜和滴灌材料')
    setActiveNav('products')

    main.innerHTML = `
      ${pageHero('AGRICULTURAL INPUTS', '农资产品', '围绕新疆棉田生产场景展示产品类别、适用阶段和配套服务，具体规格与价格由服务人员确认。', 'products-hero')}
      <section class="section-block">
        <div class="shell">
          <div class="catalog-toolbar">
            <div class="filter-tabs" id="productFilters">
              ${data.productCategories.map((item, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-category="${item.id}">${escapeHtml(item.name)}</button>`).join('')}
            </div>
            <label class="catalog-search"><span>搜索产品</span><input id="productSearch" type="search" placeholder="输入产品名称或用途"></label>
          </div>
          <div class="catalog-count" id="catalogCount">共 ${data.products.length} 项产品</div>
          <div class="product-grid" id="productGrid">${data.products.map(productCard).join('')}</div>
          <div class="empty-state hidden" id="productEmpty"><h2>没有找到匹配产品</h2><p>请更换分类或搜索关键词。</p></div>
        </div>
      </section>
      <section class="notice-band">
        <div class="shell"><strong>农资使用提示</strong><p>页面内容为第一版模拟展示。正式经营时应补充真实产品标签、登记信息、执行标准、批次与经营资质；农药和肥料使用须遵循产品标签及属地技术指导。</p></div>
      </section>`

    let category = 'all'
    let query = ''
    const grid = document.getElementById('productGrid')
    const empty = document.getElementById('productEmpty')
    const count = document.getElementById('catalogCount')

    const update = () => {
      const filtered = data.products.filter(item => {
        const matchesCategory = category === 'all' || item.category === category
        const haystack = `${item.name}${item.categoryName}${item.summary}${item.highlights.join('')}`.toLowerCase()
        return matchesCategory && haystack.includes(query.toLowerCase())
      })
      grid.innerHTML = filtered.map(productCard).join('')
      grid.classList.toggle('hidden', filtered.length === 0)
      empty.classList.toggle('hidden', filtered.length !== 0)
      count.textContent = `共 ${filtered.length} 项产品`
    }

    document.getElementById('productFilters').addEventListener('click', event => {
      const button = event.target.closest('[data-category]')
      if (!button) return
      category = button.dataset.category
      document.querySelectorAll('#productFilters button').forEach(item => item.classList.toggle('active', item === button))
      update()
    })
    document.getElementById('productSearch').addEventListener('input', event => {
      query = event.target.value.trim()
      update()
    })
  }

  function renderProductDetail(item) {
    if (!item) return renderNotFound()
    setMeta(item.name, item.summary)
    setActiveNav('products')

    const related = data.products.filter(product => product.id !== item.id && product.category === item.category).slice(0, 3)
    const fallbackRelated = related.length ? related : data.products.filter(product => product.id !== item.id).slice(0, 3)

    main.innerHTML = `
      <section class="detail-breadcrumb">
        <div class="shell"><nav class="breadcrumbs" aria-label="面包屑"><a href="${link('/')}">首页</a><span>/</span><a href="${link('/products')}">农资产品</a><span>/</span><span>${escapeHtml(item.name)}</span></nav></div>
      </section>
      <section class="product-detail section-block compact-top">
        <div class="shell product-detail-grid">
          <div class="product-detail-media">${productVisual(item, 'detail-visual')}<span class="product-badge">${escapeHtml(item.badge)}</span></div>
          <div class="product-detail-copy">
            <span class="item-category">${escapeHtml(item.categoryName)}</span>
            <h1>${escapeHtml(item.name)}</h1>
            <p class="detail-lead">${escapeHtml(item.summary)}</p>
            <div class="tag-row large">${item.highlights.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
            <div class="consult-box">
              <span>价格与规格</span>
              <strong>请联系服务人员确认</strong>
              <p>${escapeHtml(item.service)}</p>
            </div>
            <div class="detail-actions">
              <a class="button primary" href="${link(`/contact?product=${item.id}`)}">咨询此产品</a>
              <a class="button outline" href="${link('/products')}">返回产品列表</a>
            </div>
          </div>
        </div>
      </section>
      <section class="section-block detail-content-section">
        <div class="shell detail-content-grid">
          <article class="rich-article">
            ${item.sections.map(section => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('')}
            <aside class="safety-note"><strong>重要提示</strong><p>本页为模拟商品资料，不构成具体购买或施用建议。正式使用前请核对真实包装、标签、登记信息和当地农业技术要求。</p></aside>
          </article>
          <aside class="spec-panel">
            <h2>产品信息</h2>
            <dl>${item.specs.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
          </aside>
        </div>
      </section>
      <section class="section-block related-section">
        <div class="shell">
          ${sectionHeading('RELATED PRODUCTS', '相关产品')}
          <div class="product-grid related-grid">${fallbackRelated.map(productCard).join('')}</div>
        </div>
      </section>`
  }

  function renderTraining() {
    setMeta('棉花培训', '覆盖播种、苗期、水肥、病虫害、花铃期和采收管理的图文培训')
    setActiveNav('training')

    main.innerHTML = `
      ${pageHero('COTTON TRAINING', '棉花培训', '按照棉花生育进程组织图文文章，把观察方法、判断顺序和田间检查清单放在一起。', 'training-hero')}
      <section class="section-block">
        <div class="shell">
          <div class="filter-tabs training-filters" id="trainingFilters">
            ${data.trainingCategories.map((item, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-category="${item.id}">${escapeHtml(item.name)}</button>`).join('')}
          </div>
          <div class="article-grid" id="trainingGrid">${data.training.map(trainingCard).join('')}</div>
        </div>
      </section>
      <section class="academy-band">
        <div class="shell academy-band-inner"><div><span class="eyebrow">QUESTIONS & DISCUSSION</span><h2>需要针对具体问题继续交流？</h2><p>互动学堂保留评论、回复、论坛提问、学习记录和 AI 助学功能。</p></div><a class="button light" href="${link('/academy')}">进入互动学堂</a></div>
      </section>`

    document.getElementById('trainingFilters').addEventListener('click', event => {
      const button = event.target.closest('[data-category]')
      if (!button) return
      const category = button.dataset.category
      const filtered = category === 'all' ? data.training : data.training.filter(item => item.category === category)
      document.getElementById('trainingGrid').innerHTML = filtered.map(trainingCard).join('')
      document.querySelectorAll('#trainingFilters button').forEach(item => item.classList.toggle('active', item === button))
    })
  }

  function articleSections(item) {
    return item.sections.map(section => `
      <section>
        <h2>${escapeHtml(section.title)}</h2>
        ${(section.paragraphs || []).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}
        ${section.bullets ? `<ul>${section.bullets.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>` : ''}
      </section>`).join('')
  }

  function renderTrainingDetail(item) {
    if (!item) return renderNotFound()
    setMeta(item.title, item.summary)
    setActiveNav('training')

    const related = data.training.filter(article => article.id !== item.id).slice(0, 3)
    main.innerHTML = `
      <article class="reading-page">
        <header class="reading-header">
          <div class="shell reading-header-inner">
            <nav class="breadcrumbs" aria-label="面包屑"><a href="${link('/')}">首页</a><span>/</span><a href="${link('/training')}">棉花培训</a><span>/</span><span>${escapeHtml(item.categoryName)}</span></nav>
            <span class="eyebrow">${escapeHtml(item.categoryName)}</span>
            <h1>${escapeHtml(item.title)}</h1>
            <p>${escapeHtml(item.lead)}</p>
            <div class="reading-meta"><span>${escapeHtml(item.readTime)}</span><span>棉知农业服务 · 图文培训</span></div>
          </div>
        </header>
        <div class="reading-cover"><img src="${item.image}" alt="${escapeHtml(item.title)}"></div>
        <div class="shell reading-layout">
          <div class="rich-article reading-body">
            ${articleSections(item)}
            <section class="field-checklist"><span class="eyebrow">FIELD CHECKLIST</span><h2>带到田间的检查清单</h2><ul>${item.checklist.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul></section>
            <aside class="safety-note"><strong>内容边界</strong><p>文章用于建立观察和记录方法。涉及具体品种、水肥量、农药使用与灾害处置时，请结合属地技术规程、产品标签和现场专业意见。</p></aside>
          </div>
          <aside class="reading-aside">
            <span class="eyebrow">CONTINUE LEARNING</span>
            <h2>继续学习</h2>
            ${related.map(article => `<a href="${link(`/training/${article.id}`)}"><span>${escapeHtml(article.categoryName)}</span><strong>${escapeHtml(article.title)}</strong></a>`).join('')}
            <a class="button outline full" href="${link('/academy')}">进入互动学堂</a>
          </aside>
        </div>
      </article>`
  }

  function renderNews() {
    setMeta('新闻资讯', '农业政策提示、棉花行业资讯和公司服务动态')
    setActiveNav('news')

    main.innerHTML = `
      ${pageHero('NEWS & INSIGHTS', '新闻资讯', '整理农业政策阅读提示、棉花产业观察与公司服务动态，正式运营后将补充权威来源链接。', 'news-hero')}
      <section class="section-block">
        <div class="shell news-layout">
          <div>
            <div class="filter-tabs" id="newsFilters">
              ${data.newsCategories.map((item, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-category="${item.id}">${escapeHtml(item.name)}</button>`).join('')}
            </div>
            <div class="news-list" id="newsList">${data.news.map(item => newsCard(item)).join('')}</div>
          </div>
          <aside class="news-aside">
            <div><span class="eyebrow">INFORMATION NOTE</span><h2>资讯使用说明</h2><p>第一版采用模拟内容搭建页面。涉及政策、补贴、标准和农资监管时，应以政府部门、标准文件和属地正式通知为准。</p></div>
            <div><h2>资讯分类</h2>${data.newsCategories.slice(1).map(item => `<button type="button" data-news-jump="${item.id}"><span>${escapeHtml(item.name)}</span><strong>${data.news.filter(news => news.category === item.id).length}</strong></button>`).join('')}</div>
          </aside>
        </div>
      </section>`

    const applyCategory = category => {
      const filtered = category === 'all' ? data.news : data.news.filter(item => item.category === category)
      document.getElementById('newsList').innerHTML = filtered.map(item => newsCard(item)).join('')
      document.querySelectorAll('#newsFilters button').forEach(item => item.classList.toggle('active', item.dataset.category === category))
    }
    document.getElementById('newsFilters').addEventListener('click', event => {
      const button = event.target.closest('[data-category]')
      if (button) applyCategory(button.dataset.category)
    })
    document.querySelector('.news-aside').addEventListener('click', event => {
      const button = event.target.closest('[data-news-jump]')
      if (button) {
        applyCategory(button.dataset.newsJump)
        window.scrollTo({ top: document.querySelector('.news-layout').offsetTop - 110, behavior: 'smooth' })
      }
    })
  }

  function renderNewsDetail(item) {
    if (!item) return renderNotFound()
    setMeta(item.title, item.summary)
    setActiveNav('news')

    const related = data.news.filter(news => news.id !== item.id).slice(0, 3)
    main.innerHTML = `
      <article class="reading-page news-reading">
        <header class="reading-header">
          <div class="shell reading-header-inner">
            <nav class="breadcrumbs" aria-label="面包屑"><a href="${link('/')}">首页</a><span>/</span><a href="${link('/news')}">新闻资讯</a><span>/</span><span>${escapeHtml(item.categoryName)}</span></nav>
            <span class="eyebrow">${escapeHtml(item.categoryName)}</span>
            <h1>${escapeHtml(item.title)}</h1>
            <p>${escapeHtml(item.summary)}</p>
            <div class="reading-meta"><time datetime="${item.date}">${item.date}</time><span>${escapeHtml(item.source)}</span></div>
          </div>
        </header>
        <div class="reading-cover"><img src="${item.image}" alt=""></div>
        <div class="shell reading-layout">
          <div class="rich-article reading-body">
            ${articleSections({ sections: item.content })}
            <aside class="safety-note"><strong>信息说明</strong><p>本条为第一版模拟资讯，用于展示内容结构。正式发布政策或市场信息时，应标注原始来源、发布日期、适用区域和编辑审核信息。</p></aside>
          </div>
          <aside class="reading-aside">
            <span class="eyebrow">LATEST NEWS</span>
            <h2>更多资讯</h2>
            ${related.map(news => `<a href="${link(`/news/${news.id}`)}"><span>${escapeHtml(news.categoryName)} · ${news.date}</span><strong>${escapeHtml(news.title)}</strong></a>`).join('')}
            <a class="button outline full" href="${link('/news')}">返回资讯列表</a>
          </aside>
        </div>
      </article>`
  }

  function renderAbout() {
    setMeta('关于我们', '了解棉知农业服务的定位、服务原则和第一版建设方向')
    setActiveNav('about')
    main.innerHTML = `
      ${pageHero('ABOUT US', '关于我们', '以新疆棉田真实需求为起点，连接农资展示、种植知识、行业信息与人工服务。', 'about-hero')}
      <section class="section-block">
        <div class="shell about-intro">
          <div><span class="eyebrow">OUR PURPOSE</span><h2>让产品信息更透明，让农业服务更连续</h2></div>
          <div><p>棉知农业服务是一个面向新疆棉花产业的社会服务与商业展示网站。第一版重点搭建可信、清晰的信息入口：用户可以了解公司经营的农资品类，按生育期学习种植知识，阅读农业资讯，并找到服务团队。</p><p>产品是否适用、实际规格与价格，需要结合地块、作物阶段和当地要求，由服务人员进一步确认。</p></div>
        </div>
      </section>
      <section class="section-block about-photo-section">
        <div class="shell about-photo-grid">
          <img src="/assets/knowledge-hero-v2.webp" alt="新疆棉田">
          <div>
            <span class="eyebrow">SERVICE PRINCIPLES</span>
            <h2>三条服务原则</h2>
            <dl class="principle-list">
              <div><dt>01 信息可核验</dt><dd>正式商品补充标签、登记、标准、批次与经营资质；资讯标明原始来源。</dd></div>
              <div><dt>02 建议有边界</dt><dd>线上内容用于整理判断顺序，不替代产品标签、属地技术规程和现场诊断。</dd></div>
              <div><dt>03 服务能持续</dt><dd>把购买前咨询、使用记录、田间反馈和学习内容连接起来，而不是止于一次成交。</dd></div>
            </dl>
          </div>
        </div>
      </section>
      <section class="section-block">
        <div class="shell">
          ${sectionHeading('FIRST VERSION', '第一版服务范围', '以下内容均已形成可浏览的基础页面，后续可逐步接入真实数据和后台管理。')}
          <div class="scope-grid">
            <div><strong>农资产品</strong><p>种子、肥料、植保、农膜、滴灌材料的列表和详情。</p></div>
            <div><strong>棉花培训</strong><p>覆盖六个生育阶段的图文文章与田间检查清单。</p></div>
            <div><strong>新闻资讯</strong><p>农业政策、行业资讯和公司动态的分类内容。</p></div>
            <div><strong>互动学习</strong><p>保留课程、评论回复、论坛提问、学习记录与 AI 助学。</p></div>
          </div>
        </div>
      </section>
      <section class="contact-band"><div class="shell contact-band-inner"><div><span class="eyebrow">WORK WITH US</span><h2>从一个具体的田间问题开始</h2><p>提交产品咨询、培训需求或合作建议，服务人员将进一步沟通。</p></div><a class="button primary" href="${link('/contact')}">联系我们</a></div></section>`
  }

  function renderContact() {
    setMeta('联系我们', '联系棉知农业服务团队，提交产品咨询、培训或田间服务需求')
    setActiveNav('contact')

    const productId = new URLSearchParams(window.location.search).get('product') || ''
    const selectedProduct = productById(productId)

    main.innerHTML = `
      ${pageHero('CONTACT', '联系我们', '产品咨询、培训需求、田间问题或合作建议，都可以在这里提交。', 'contact-hero')}
      <section class="section-block">
        <div class="shell contact-layout">
          <div class="contact-info">
            <span class="eyebrow">SERVICE DESK</span>
            <h2>服务团队</h2>
            <p>第一版联系方式为模拟信息。正式上线前，请在数据配置中替换电话、地址和服务时间。</p>
            <dl>
              <div><dt>服务热线</dt><dd>${escapeHtml(data.company.phone)}（演示）</dd></div>
              <div><dt>服务时间</dt><dd>${escapeHtml(data.company.hours)}</dd></div>
              <div><dt>联系地址</dt><dd>${escapeHtml(data.company.address)}</dd></div>
              <div><dt>服务区域</dt><dd>${data.company.serviceAreas.map(escapeHtml).join(' · ')}</dd></div>
            </dl>
            <div class="response-note"><strong>提交前建议准备</strong><p>所在地区、地块面积、棉花生育期、近期水肥或用药记录，以及能够反映整体分布和局部症状的照片。</p></div>
          </div>
          <form class="contact-form" id="contactForm">
            <div class="form-heading"><span class="eyebrow">SEND A REQUEST</span><h2>提交服务需求</h2><p>带 * 的项目为必填项。</p></div>
            <div class="form-grid">
              <label><span>姓名或称呼 *</span><input name="name" maxlength="30" autocomplete="name" required></label>
              <label><span>联系电话 *</span><input name="phone" inputmode="tel" maxlength="20" autocomplete="tel" required></label>
              <label><span>需求类型 *</span><select name="type" required><option value="">请选择</option><option>产品咨询</option><option>田间服务</option><option>培训需求</option><option>商务合作</option><option>其他问题</option></select></label>
              <label><span>所在地区</span><input name="region" maxlength="80" placeholder="例如：新疆阿克苏"></label>
              <label class="full"><span>咨询产品</span><select name="product"><option value="">不指定产品</option>${data.products.map(item => `<option value="${item.id}" ${selectedProduct?.id === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label>
              <label class="full"><span>问题描述 *</span><textarea name="message" maxlength="1200" required placeholder="请写明作物阶段、地块情况和希望解决的问题。">${selectedProduct ? `我想了解“${escapeHtml(selectedProduct.name)}”的适用条件、规格和服务方式。` : ''}</textarea></label>
            </div>
            <label class="consent"><input type="checkbox" name="consent" required><span>我同意服务人员根据以上信息与我联系。</span></label>
            <div class="form-submit"><button class="button primary" type="submit">提交需求</button><span id="formMessage" role="status"></span></div>
          </form>
        </div>
      </section>`

    document.getElementById('contactForm').addEventListener('submit', event => {
      event.preventDefault()
      const form = event.currentTarget
      const entries = Object.fromEntries(new FormData(form).entries())
      const requests = JSON.parse(localStorage.getItem('cotton-service-requests') || '[]')
      requests.push({ ...entries, createdAt: new Date().toISOString() })
      localStorage.setItem('cotton-service-requests', JSON.stringify(requests.slice(-20)))
      document.getElementById('formMessage').textContent = '需求已保存。当前为演示版本，暂不会发送到服务器。'
      form.reset()
    })
  }

  function renderNotFound() {
    setMeta('页面未找到', '页面不存在')
    setActiveNav('')
    main.innerHTML = `
      <section class="not-found">
        <div class="shell"><span class="eyebrow">404</span><h1>没有找到这个页面</h1><p>页面地址可能已调整，请从首页重新浏览。</p><a class="button primary" href="${link('/')}">返回首页</a></div>
      </section>`
  }

  function setupHeader() {
    document.getElementById('servicePhone').textContent = data.company.phone
    document.getElementById('footerPhone').textContent = data.company.phone
    document.getElementById('footerHours').textContent = data.company.hours
    document.getElementById('footerAddress').textContent = data.company.address

    const button = document.getElementById('menuButton')
    const nav = document.getElementById('mainNav')
    button.addEventListener('click', () => {
      const open = nav.classList.toggle('open')
      button.setAttribute('aria-expanded', String(open))
      button.textContent = open ? '关闭' : '菜单'
    })
    nav.addEventListener('click', event => {
      if (event.target.closest('a')) {
        nav.classList.remove('open')
        button.setAttribute('aria-expanded', 'false')
        button.textContent = '菜单'
      }
    })
  }

  setupHeader()

  if (routePath === '/' || routePath === '/index.html') renderHome()
  else if (pageGroup === 'products' && pathParts.length === 1) renderProducts()
  else if (pageGroup === 'products') renderProductDetail(productById(pathParts[1]))
  else if (pageGroup === 'training' && pathParts.length === 1) renderTraining()
  else if (pageGroup === 'training') renderTrainingDetail(trainingById(pathParts[1]))
  else if (pageGroup === 'news' && pathParts.length === 1) renderNews()
  else if (pageGroup === 'news') renderNewsDetail(newsById(pathParts[1]))
  else if (pageGroup === 'about') renderAbout()
  else if (pageGroup === 'contact') renderContact()
  else renderNotFound()
})()
