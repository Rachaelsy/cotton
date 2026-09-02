(() => {
  const data = window.COTTON_SITE_DATA
  const main = document.getElementById('mainContent')
  const publicBase = '/public'
  const businessBase = '/business'
  const runtime = window.CottonRuntime

  const routePath = window.location.pathname
    .replace(/^\/knowledge/, '')
    .replace(/\/+$/, '') || '/'

  const routeParts = routePath.split('/').filter(Boolean)
  const platform = ['public', 'business'].includes(routeParts[0]) ? routeParts[0] : 'hub'
  const pathParts = platform === 'hub' ? routeParts : routeParts.slice(1)
  const pageGroup = pathParts[0] || 'home'

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

  const platformBase = platform === 'business' ? businessBase : publicBase
  const joinLink = (base, path = '/') => `${base}${path === '/' ? '/' : path}`
  const link = path => joinLink(platformBase, path)
  const publicLink = path => joinLink(publicBase, path)
  const businessLink = path => joinLink(businessBase, path)
  const productById = id => data.products.find(item => item.id === id)
  const machineryById = id => data.machinery.find(item => item.id === id)
  const trainingById = id => data.training.find(item => item.id === id)
  const newsById = id => data.news.find(item => item.id === id)
  const activityById = id => data.activities.find(item => item.id === id)

  async function publicServiceRequest(path, payload) {
    return runtime.requestJson(`/api/public-service${path}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  }

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
        <a class="product-image-link" href="${businessLink(`/products/${item.id}`)}" aria-label="查看${escapeHtml(item.name)}">
          ${productVisual(item)}
          <span class="product-badge">${escapeHtml(item.badge)}</span>
        </a>
        <div class="product-card-body">
          <span class="item-category">${escapeHtml(item.categoryName)}</span>
          <h3><a href="${businessLink(`/products/${item.id}`)}">${escapeHtml(item.name)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
          <div class="tag-row">${item.highlights.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
          <a class="text-link" href="${businessLink(`/products/${item.id}`)}">查看产品详情 <span aria-hidden="true">→</span></a>
        </div>
      </article>`
  }

  function machineryCard(item) {
    return `
      <article class="machinery-card">
        <a class="machinery-card-media" href="${businessLink(`/machinery/${item.id}`)}" aria-label="查看${escapeHtml(item.name)}">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}作业场景" loading="lazy" style="object-position: ${escapeHtml(item.imagePosition || 'center')}">
          <span class="machinery-badge">${escapeHtml(item.badge)}</span>
        </a>
        <div class="machinery-card-body">
          <span class="item-category">${escapeHtml(item.categoryName)}</span>
          <h3><a href="${businessLink(`/machinery/${item.id}`)}">${escapeHtml(item.name)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
          <div class="tag-row">${item.highlights.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
          <dl class="machinery-card-meta">
            <div><dt>服务阶段</dt><dd>${escapeHtml(item.stage)}</dd></div>
            <div><dt>计价依据</dt><dd>${escapeHtml(item.billing)}</dd></div>
          </dl>
          <a class="text-link" href="${businessLink(`/machinery/${item.id}`)}">查看服务详情 <span aria-hidden="true">→</span></a>
        </div>
      </article>`
  }

  function trainingCard(item) {
    return `
      <article class="article-card">
        <a class="article-image" href="${publicLink(`/training/${item.id}`)}">
          <img src="${item.image}" alt="${escapeHtml(item.title)}" loading="lazy">
          <span>${escapeHtml(item.categoryName)}</span>
        </a>
        <div class="article-card-body">
          <div class="article-meta"><span>${escapeHtml(item.categoryName)}</span><span>${escapeHtml(item.readTime)}</span></div>
          <h3><a href="${publicLink(`/training/${item.id}`)}">${escapeHtml(item.title)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
          <a class="text-link" href="${publicLink(`/training/${item.id}`)}">阅读全文 <span aria-hidden="true">→</span></a>
        </div>
      </article>`
  }

  function newsCard(item, compact = false, target = 'business') {
    const href = target === 'public'
      ? publicLink(`/policies/${item.id}`)
      : businessLink(`/news/${item.id}`)
    return `
      <article class="news-card ${compact ? 'compact' : ''}">
        <a class="news-image" href="${href}"><img src="${item.image}" alt="" loading="lazy"></a>
        <div class="news-card-body">
          <div class="article-meta"><span>${escapeHtml(item.categoryName)}</span><time datetime="${item.date}">${item.date}</time></div>
          <h3><a href="${href}">${escapeHtml(item.title)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
          <a class="text-link" href="${href}">查看资讯 <span aria-hidden="true">→</span></a>
        </div>
      </article>`
  }

  function pestCard(item) {
    return `
      <article class="knowledge-card">
        <a class="knowledge-card-image" href="${publicLink(`/pests/${item.id}`)}">
          <img src="${item.image}" alt="${escapeHtml(item.name)}田间识别" loading="lazy">
          <span>${escapeHtml(item.type)}</span>
        </a>
        <div class="knowledge-card-body">
          <small>${escapeHtml(item.riskStage)}</small>
          <h3><a href="${publicLink(`/pests/${item.id}`)}">${escapeHtml(item.name)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
          <a class="text-link" href="${publicLink(`/pests/${item.id}`)}">查看识别要点 <span aria-hidden="true">→</span></a>
        </div>
      </article>`
  }

  function activityCard(item) {
    return `
      <article class="activity-card">
        <a class="activity-image" href="${publicLink(`/activities/${item.id}`)}">
          <img src="${item.image}" alt="" loading="lazy">
          <span>${escapeHtml(item.status)}</span>
        </a>
        <div class="activity-card-body">
          <div class="article-meta"><span>${escapeHtml(item.format)}</span><time>${escapeHtml(item.date)}</time></div>
          <h3><a href="${publicLink(`/activities/${item.id}`)}">${escapeHtml(item.title)}</a></h3>
          <p>${escapeHtml(item.summary)}</p>
          <dl><div><dt>地点</dt><dd>${escapeHtml(item.location)}</dd></div><div><dt>规模</dt><dd>${escapeHtml(item.capacity)}</dd></div></dl>
          <a class="text-link" href="${publicLink(`/activities/${item.id}`)}">查看活动详情 <span aria-hidden="true">→</span></a>
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

  function sourceReference(item, linkLabel = '查看原始资料') {
    if (!item?.source || !item?.sourceUrl) return ''
    return `
      <aside class="source-reference">
        <span>资料来源</span>
        <strong>${escapeHtml(item.source)}</strong>
        <a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabel)} <span aria-hidden="true">→</span></a>
      </aside>`
  }

  function renderPublicHome() {
    setMeta('公共服务平台', '免费开放的种植培训、图文课程、政策资讯、专家咨询、病虫害知识和公共服务活动')
    setActiveNav('home')
    main.innerHTML = `
      <section class="home-hero public-home-hero">
        <div class="home-hero-shade"></div>
        <div class="shell home-hero-inner">
          <div class="hero-copy">
            <span class="hero-kicker">PUBLIC COTTON SERVICE · 免费开放</span>
            <h1>喀什优棉公共服务平台</h1>
            <p>面向种植户和农业从业者开放棉花培训、田间问题交流与 AI 助学，让可靠知识更容易被找到和使用。</p>
            <div class="hero-actions">
              <a class="button primary" href="${publicLink('/training')}">开始学习</a>
               <a class="button light" href="${publicLink('/experts')}">专家咨询</a>
            </div>
          </div>
        </div>
      </section>
      <section class="service-ribbon public-ribbon">
        <div class="shell service-ribbon-grid">
          <div><strong>公益开放</strong><span>培训、政策、病虫害知识无需登录即可浏览</span></div>
          <div><strong>专家咨询</strong><span>登录后提交问题，并持续查看专家回复</span></div>
          <div><strong>学习积分</strong><span>农户账号完成课程获得积分，可在小程序购买农资时抵扣</span></div>
          <div><strong>棉区联结</strong><span>通过公益活动连接种植户、专家与志愿者</span></div>
        </div>
      </section>
      <section class="section-block public-sectors-section">
        <div class="shell">
          ${sectionHeading('LEARNING & COMMUNITY', '学习与互动专区', '保留种植培训、课程、病虫害知识和公共活动，与下方数据库驱动的业务内容互为补充。')}
          <div class="public-sector-grid">
            <a class="public-sector-card" href="${publicLink('/training')}"><span>01</span><strong>棉花种植培训</strong><p>从播种、苗期到采收的全生育期管理文章与田间清单。</p><b>进入专区 →</b></a>
            <a class="public-sector-card" href="${publicLink('/courses')}"><span>02</span><strong>图文课程</strong><p>图文、图片、小测试、评论与 AI 解答组成的互动课程。</p><b>进入专区 →</b></a>
            <a class="public-sector-card" href="${publicLink('/pests')}"><span>03</span><strong>病虫害知识</strong><p>按症状、发生阶段和调查方法建立规范排查顺序。</p><b>进入专区 →</b></a>
            <a class="public-sector-card" href="${publicLink('/activities')}"><span>04</span><strong>公共服务活动</strong><p>田间开放日、公共服务工作坊、公开课和志愿服务活动。</p><b>进入专区 →</b></a>
          </div>
        </div>
      </section>
      ${publicModulesViews?.homeSection() || ''}
      <section class="section-block">
        <div class="shell">
          ${sectionHeading('COTTON TRAINING', '棉花全生育期培训', '围绕当前田间阶段学习，文章末尾附有可执行的检查清单。', `<a class="section-action" href="${publicLink('/training')}">查看全部培训</a>`)}
          <div class="stage-nav">
            ${data.training.map((item, index) => `
              <a href="${publicLink(`/training/${item.id}`)}">
                <span>${String(index + 1).padStart(2, '0')}</span>
                <strong>${escapeHtml(item.categoryName)}</strong>
                <small>${escapeHtml(item.title)}</small>
              </a>`).join('')}
          </div>
          <div class="article-grid home-articles">${data.training.slice(0, 3).map(trainingCard).join('')}</div>
        </div>
      </section>
      <section class="public-service-section">
        <div class="shell public-service-layout">
          <div class="public-service-copy">
            <span class="eyebrow">QUESTIONS & SUPPORT</span>
            <h2>从学习资料走到专家咨询</h2>
            <p>公共服务平台把共享专家、课程评论、棉友问答与 AI 助学连接起来。登录后可提交问题、查看回复并保留学习记录。</p>
            <div class="hero-actions">
              <a class="button primary" href="${publicLink('/experts')}">进入专家咨询</a>
              <a class="button outline" href="${publicLink('/forum')}">进入棉友问答</a>
            </div>
          </div>
          <div class="public-service-image"><img src="/assets/cotton-seedling-leaf-inspection-v1.jpg" alt="技术人员查看棉花叶片"></div>
        </div>
      </section>
      <section class="cross-platform-band">
        <div class="shell cross-platform-inner">
          <div><span class="eyebrow">CONNECTED BUSINESS</span><h2>需要了解生产资料和公司服务？</h2><p>商业内容独立展示，但仍可从商品详情回到相关农技培训。</p></div>
          <a class="button light" href="${businessLink('/')}">前往商业平台</a>
        </div>
      </section>`
  }

  function renderBusinessHome() {
    setMeta('商业平台', '面向新疆棉区的农资供应、农机作业、数字履约与农业商业服务')
    setActiveNav('home')
    const businessNews = data.news.filter(item => item.category !== 'policy')

    main.innerHTML = `
      <section class="home-hero business-home-hero">
        <div class="home-hero-shade"></div>
        <div class="shell home-hero-inner">
          <div class="hero-copy">
            <span class="hero-kicker">AGRICULTURAL BUSINESS · 新疆棉区</span>
            <h1>棉知商业平台</h1>
            <p>以棉花生产为主线，连接农资供应、农机作业、数字履约和公益农技服务，让生产需求从信息查询走向可执行的田间服务。</p>
            <div class="hero-actions">
              <a class="button primary" href="${link('/products')}">浏览农资产品</a>
              <a class="button light" href="${link('/machinery')}">查看农机服务</a>
            </div>
          </div>
          <div class="hero-facts" aria-label="服务内容">
            <div><strong>农资供应</strong><span>覆盖 5 类生产资料</span></div>
            <div><strong>农机服务</strong><span>覆盖关键农时作业</span></div>
            <div><strong>数字履约</strong><span>连接订单、支付与服务记录</span></div>
          </div>
        </div>
      </section>

      <section class="service-ribbon">
        <div class="shell service-ribbon-grid">
          <div><strong>农资供应</strong><span>种子、肥料、植保、农膜和滴灌材料</span></div>
          <div><strong>农机服务</strong><span>整地、播种、植保、田管、采收与转运</span></div>
          <div><strong>技术内容</strong><span>用农技培训和田间知识降低决策成本</span></div>
          <div><strong>商务协同</strong><span>连接农户、商户、农机手与平台运营</span></div>
        </div>
      </section>

      <section class="section-block business-chain-section">
        <div class="shell">
          ${sectionHeading('CORE BUSINESS', '一条围绕棉田生产的服务链', '从投入品到田间作业，再到订单与服务记录，展示平台正在建设的核心业务。')}
          <div class="business-pillar-grid">
            <article><span>01 · INPUTS</span><h3>农资供应</h3><p>围绕棉花生产周期展示适配的种子、肥料、植保、农膜和滴灌材料，并提供规格、使用边界与商务咨询入口。</p><a href="${link('/products')}">查看农资业务 <b aria-hidden="true">→</b></a></article>
            <article><span>02 · OPERATIONS</span><h3>农机服务</h3><p>覆盖耕整地、播种铺膜、植保飞防、田间管理、机采棉和棉包转运，按地块、农时和作业条件组织服务。</p><a href="${link('/machinery')}">查看农机业务 <b aria-hidden="true">→</b></a></article>
            <article><span>03 · DIGITAL DELIVERY</span><h3>数字履约</h3><p>小程序端承接商品订单、农机预约、微信支付、物流与进度、客服沟通和评价记录，形成可追踪的服务过程。</p><a href="${link('/contact')}">洽谈业务合作 <b aria-hidden="true">→</b></a></article>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="shell">
          ${sectionHeading('PRODUCTS', '棉田生产资料', '查看产品信息、适用场景与配套服务。', `<a class="section-action" href="${link('/products')}">查看全部产品</a>`)}
          <div class="product-grid">${data.products.slice(0, 4).map(productCard).join('')}</div>
        </div>
      </section>

      <section class="section-block machinery-home-section">
        <div class="shell">
          ${sectionHeading('MACHINERY SERVICES', '覆盖关键农时的农机作业', '按作业阶段展示服务能力，实际机型、档期、服务半径和价格以需求匹配结果为准。', `<a class="section-action" href="${link('/machinery')}">查看全部农机服务</a>`)}
          <div class="machinery-grid">${data.machinery.slice(0, 3).map(machineryCard).join('')}</div>
        </div>
      </section>

      <section class="section-block service-section">
        <div class="shell split-intro">
          <div class="service-image"><img src="/assets/business-drone-service-v1.jpg" alt="棉田植保无人机作业"></div>
          <div class="service-copy">
            <span class="eyebrow">FIELD SERVICE</span>
            <h2>从单项交易，走向田间服务协同</h2>
            <p>农资和农机并不是彼此孤立的商品。平台把投入品选择、作业需求、农时安排、履约记录和售后沟通连接起来，让农户、商户和农机手围绕同一块地协作。</p>
            <div class="service-points">
              <div><strong>需求前</strong><span>核对地块、农时、投入品与设备条件</span></div>
              <div><strong>履约中</strong><span>记录订单、支付、物流或农机作业进度</span></div>
              <div><strong>服务后</strong><span>通过客服、评价和生产记录持续复盘</span></div>
            </div>
            <a class="button outline" href="${link('/contact')}">联系商务团队</a>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="shell">
          ${sectionHeading('NEWS', '产业与质量资讯', '整理棉花产业、质量监管和加工动态，每条内容保留官方原始来源。', `<a class="section-action" href="${link('/news')}">查看全部资讯</a>`)}
          <div class="news-grid">${businessNews.slice(0, 3).map(item => newsCard(item, true)).join('')}</div>
        </div>
      </section>

      <section class="cross-platform-band business-cross-band">
        <div class="shell cross-platform-inner">
          <div><span class="eyebrow">PUBLIC KNOWLEDGE</span><h2>查找种植培训与农技交流</h2><p>公共服务平台提供免费培训、图文课程、政策资讯、专家咨询和棉友问答。</p></div>
          <a class="button light" href="${publicLink('/')}">前往公共服务平台</a>
        </div>
      </section>

      <section class="contact-band">
        <div class="shell contact-band-inner">
          <div><span class="eyebrow">BUSINESS CONTACT</span><h2>了解农资供应与农机合作</h2><p>产品价格、供货条件、农机档期和服务范围由服务人员根据实际需求进一步确认。</p></div>
          <a class="button primary" href="${link('/contact')}">联系商务团队</a>
        </div>
      </section>`
  }

  function renderProducts() {
    setMeta('农资经营品类', '展示棉花种子、肥料、植保、农膜和滴灌材料的选型与核验服务')
    setActiveNav('products')

    main.innerHTML = `
      ${pageHero('AGRICULTURAL INPUTS', '农资经营品类', '围绕新疆棉田生产场景展示可提供的品类、选型要点和服务边界，具体品牌、批次、规格与价格须在供货前核验。', 'products-hero')}
      <section class="section-block">
        <div class="shell">
          <div class="catalog-toolbar">
            <div class="filter-tabs" id="productFilters">
              ${data.productCategories.map((item, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-category="${item.id}">${escapeHtml(item.name)}</button>`).join('')}
            </div>
            <label class="catalog-search"><span>搜索品类</span><input id="productSearch" type="search" placeholder="输入品类名称或用途"></label>
          </div>
          <div class="catalog-count" id="catalogCount">共 ${data.products.length} 项品类服务</div>
          <div class="product-grid" id="productGrid">${data.products.map(productCard).join('')}</div>
          <div class="empty-state hidden" id="productEmpty"><h2>没有找到匹配品类</h2><p>请更换分类或搜索关键词。</p></div>
        </div>
      </section>
      <section class="notice-band">
        <div class="shell"><strong>经营与使用提示</strong><p>本页展示经营品类和选型参数，不代表实时库存或具体商品批次。询价与使用前须核对真实标签、登记信息、执行标准、批次和经营资质；农药、肥料使用遵循产品标签及属地技术指导。</p></div>
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
      count.textContent = `共 ${filtered.length} 项品类服务`
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

    const related = data.products.filter(product => product.id !== item.id && product.category === item.category)
    const fallbackRelated = related
      .concat(data.products.filter(product => product.id !== item.id && product.category !== item.category))
      .slice(0, 3)
    const trainingCategoryByProduct = {
      seed: 'planting',
      fertilizer: 'water',
      pesticide: 'pest',
      film: 'seedling',
      irrigation: 'water'
    }
    const learningCategory = trainingCategoryByProduct[item.category]
    const relatedTraining = data.training
      .filter(article => article.category === learningCategory)
      .concat(data.training.filter(article => article.category !== learningCategory))
      .slice(0, 3)

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
              <span>供货与规格</span>
              <strong>按真实品牌、批次和需求确认</strong>
              <p>${escapeHtml(item.service)}</p>
            </div>
            <div class="detail-actions">
              <a class="button primary" href="${link(`/contact?product=${item.id}`)}">咨询此品类</a>
              <a class="button outline" href="${link('/products')}">返回产品列表</a>
            </div>
          </div>
        </div>
      </section>
      <section class="section-block detail-content-section">
        <div class="shell detail-content-grid">
          <article class="rich-article">
            ${item.sections.map(section => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('')}
            <aside class="safety-note"><strong>重要提示</strong><p>本页用于说明经营范围和选型核验要求，不对应某个实时库存商品，也不构成具体购买或施用建议。确认供货与使用前，请核对真实包装、标签、登记信息、批次和当地农业技术要求。</p></aside>
          </article>
          <aside class="spec-panel">
            <h2>选型信息</h2>
            <dl>${item.specs.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
          </aside>
        </div>
      </section>
      <section class="section-block connected-content-section">
        <div class="shell">
          ${sectionHeading('PUBLIC LEARNING', '相关农技培训', '商品资料与公共知识内容互相关联，帮助用户先了解适用场景和使用边界。', `<a class="section-action" href="${publicLink('/training')}">进入农技培训</a>`)}
          <div class="article-grid">${relatedTraining.map(trainingCard).join('')}</div>
        </div>
      </section>
      <section class="section-block related-section">
        <div class="shell">
          ${sectionHeading('RELATED PRODUCTS', '相关产品')}
          <div class="product-grid related-grid">${fallbackRelated.map(productCard).join('')}</div>
        </div>
      </section>`
  }

  function renderMachinery() {
    setMeta('农机作业服务', '展示棉田耕整地、播种铺膜、植保、田间管理、采收和转运等农机服务能力')
    setActiveNav('machinery')

    main.innerHTML = `
      ${pageHero('AGRICULTURAL MACHINERY', '农机作业服务', '围绕新疆棉花关键农时展示可组织的作业能力。实际机型、档期、服务半径和计价方式由农机手结合地块需求确认。', 'machinery-hero')}
      <section class="section-block">
        <div class="shell">
          <div class="catalog-toolbar">
            <div class="filter-tabs" id="machineryFilters">
              ${data.machineryCategories.map((item, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-category="${item.id}">${escapeHtml(item.name)}</button>`).join('')}
            </div>
            <label class="catalog-search"><span>搜索服务</span><input id="machinerySearch" type="search" placeholder="输入作业名称、阶段或用途"></label>
          </div>
          <div class="catalog-count" id="machineryCount">共 ${data.machinery.length} 项农机服务</div>
          <div class="machinery-grid" id="machineryGrid">${data.machinery.map(machineryCard).join('')}</div>
          <div class="empty-state hidden" id="machineryEmpty"><h2>没有找到匹配服务</h2><p>请更换分类或搜索关键词。</p></div>
        </div>
      </section>
      <section class="notice-band machinery-notice">
        <div class="shell"><strong>作业预约提示</strong><p>本页展示平台可连接的农机服务类型，不代表实时在岗设备。提交需求后还需核对地块位置、面积、农时、道路、天气和作业参数；具体价格、档期与服务半径以农机手确认结果为准。</p></div>
      </section>`

    let category = 'all'
    let query = ''
    const grid = document.getElementById('machineryGrid')
    const empty = document.getElementById('machineryEmpty')
    const count = document.getElementById('machineryCount')

    const update = () => {
      const filtered = data.machinery.filter(item => {
        const matchesCategory = category === 'all' || item.category === category
        const haystack = `${item.name}${item.categoryName}${item.summary}${item.stage}${item.highlights.join('')}`.toLowerCase()
        return matchesCategory && haystack.includes(query.toLowerCase())
      })
      grid.innerHTML = filtered.map(machineryCard).join('')
      grid.classList.toggle('hidden', filtered.length === 0)
      empty.classList.toggle('hidden', filtered.length !== 0)
      count.textContent = `共 ${filtered.length} 项农机服务`
    }

    document.getElementById('machineryFilters').addEventListener('click', event => {
      const button = event.target.closest('[data-category]')
      if (!button) return
      category = button.dataset.category
      document.querySelectorAll('#machineryFilters button').forEach(item => item.classList.toggle('active', item === button))
      update()
    })
    document.getElementById('machinerySearch').addEventListener('input', event => {
      query = event.target.value.trim()
      update()
    })
  }

  function renderMachineryDetail(item) {
    if (!item) return renderNotFound()
    setMeta(item.name, item.summary)
    setActiveNav('machinery')

    const related = data.machinery
      .filter(machine => machine.id !== item.id && machine.category === item.category)
      .concat(data.machinery.filter(machine => machine.id !== item.id && machine.category !== item.category))
      .slice(0, 3)
    const trainingCategoryByMachinery = {
      land: 'planting',
      planting: 'planting',
      protection: 'pest',
      harvest: 'harvest',
      transport: 'harvest'
    }
    const learningCategory = trainingCategoryByMachinery[item.category]
    const relatedTraining = data.training
      .filter(article => article.category === learningCategory)
      .concat(data.training.filter(article => article.category !== learningCategory))
      .slice(0, 3)

    main.innerHTML = `
      <section class="detail-breadcrumb">
        <div class="shell"><nav class="breadcrumbs" aria-label="面包屑"><a href="${link('/')}">首页</a><span>/</span><a href="${link('/machinery')}">农机服务</a><span>/</span><span>${escapeHtml(item.name)}</span></nav></div>
      </section>
      <section class="machinery-detail section-block compact-top">
        <div class="shell product-detail-grid">
          <div class="machinery-detail-media">
            <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}作业场景" style="object-position: ${escapeHtml(item.imagePosition || 'center')}">
            <span class="machinery-badge">${escapeHtml(item.badge)}</span>
          </div>
          <div class="product-detail-copy">
            <span class="item-category">${escapeHtml(item.categoryName)}</span>
            <h1>${escapeHtml(item.name)}</h1>
            <p class="detail-lead">${escapeHtml(item.summary)}</p>
            <div class="tag-row large">${item.highlights.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
            <div class="consult-box">
              <span>服务方式</span>
              <strong>${escapeHtml(item.stage)} · ${escapeHtml(item.billing)}</strong>
              <p>${escapeHtml(item.service)}</p>
            </div>
            <div class="detail-actions">
              <a class="button primary" href="${link(`/contact?machine=${item.id}`)}">咨询此项服务</a>
              <a class="button outline" href="${link('/machinery')}">返回服务列表</a>
            </div>
          </div>
        </div>
      </section>
      <section class="section-block machinery-flow-section">
        <div class="shell">
          ${sectionHeading('SERVICE DELIVERY', '从需求到作业记录')}
          <ol class="machinery-flow">
            <li><span>01</span><strong>提交需求</strong><p>填写地块、面积、日期和作业类型。</p></li>
            <li><span>02</span><strong>匹配确认</strong><p>农机手核对机型、档期、价格与服务半径。</p></li>
            <li><span>03</span><strong>订单履约</strong><p>确认订单和支付安排，持续更新作业状态。</p></li>
            <li><span>04</span><strong>完成反馈</strong><p>保留作业记录、评价和售后沟通入口。</p></li>
          </ol>
        </div>
      </section>
      <section class="section-block detail-content-section">
        <div class="shell detail-content-grid">
          <article class="rich-article">
            ${item.sections.map(section => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('')}
            <aside class="safety-note"><strong>重要提示</strong><p>本页用于展示平台可连接的作业服务，不对应某台实时在岗设备。农机手资质、实际机型、作业范围、价格和时间须在接单前确认；涉及微信支付时，收款农机手还需具备有效的特约商户受理关系。</p></aside>
          </article>
          <aside class="spec-panel">
            <h2>服务信息</h2>
            <dl>${item.specs.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
          </aside>
        </div>
      </section>
      <section class="section-block connected-content-section">
        <div class="shell">
          ${sectionHeading('PUBLIC LEARNING', '相关农技培训', '在预约作业前了解对应农时、田间条件和质量检查要点。', `<a class="section-action" href="${publicLink('/training')}">进入农技培训</a>`)}
          <div class="article-grid">${relatedTraining.map(trainingCard).join('')}</div>
        </div>
      </section>
      <section class="section-block related-section">
        <div class="shell">
          ${sectionHeading('RELATED SERVICES', '相关农机服务')}
          <div class="machinery-grid related-grid">${related.map(machineryCard).join('')}</div>
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
        <div class="shell academy-band-inner"><div><span class="eyebrow">QUESTIONS & DISCUSSION</span><h2>需要针对具体问题继续交流？</h2><p>公共服务平台提供课程评论、回复、公开提问、学习记录和 AI 助学功能。</p></div><a class="button light" href="${publicLink('/forum')}">进入棉友问答</a></div>
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

  async function publicServiceApi(path, options = {}) {
    const token = localStorage.getItem('knowledge_token') || ''
    const result = await runtime.requestJson(`/api/public-service${path}`, options, {
      token,
      onUnauthorized: () => {
        localStorage.removeItem('knowledge_token')
        localStorage.removeItem('knowledge_user')
        if (platform === 'public' && pageGroup !== 'login') {
          const next = `${location.pathname}${location.search}`
          location.replace(publicLink(`/login?next=${encodeURIComponent(next)}`))
        }
      }
    })
    return result.data
  }

  function expertCard(expert) {
    const specialties = Array.isArray(expert.specialties) ? expert.specialties : []
    const loggedIn = Boolean(localStorage.getItem('knowledge_token'))
    const actionHref = loggedIn ? '#expertQuestionForm' : publicLink('/login?next=%2Fpublic%2Fexperts')
    const actionText = loggedIn ? '向平台专家组提问' : '登录后向专家提问'
    return `
      <article class="expert-card">
        <div class="expert-card-head">
          <span class="expert-avatar">${escapeHtml(expert.avatar || expert.name.slice(0, 1))}</span>
          <div><h3>${escapeHtml(expert.name)}</h3><p>${escapeHtml(expert.title)}</p></div>
        </div>
        <strong class="expert-org">${escapeHtml(expert.org)}</strong>
        <p class="expert-bio">${escapeHtml(expert.bio || '负责棉花生产相关问题的公益答疑与内容审核。')}</p>
        <div class="expert-tags">${specialties.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>
        <a href="${actionHref}" class="text-link">${actionText} <span aria-hidden="true">→</span></a>
      </article>`
  }

  function questionCard(item) {
    return `
      <article class="question-record">
        <div class="question-record-meta"><span>${escapeHtml(item.statusText)}</span><time>${escapeHtml(String(item.createdAt || '').slice(0, 16).replace('T', ' '))}</time></div>
        <h3>${escapeHtml(item.question)}</h3>
        <p>${[item.category, item.cropStage].filter(Boolean).map(escapeHtml).join(' · ') || '未选择问题分类'}</p>
        ${item.reply ? `<div class="expert-reply"><strong>专家回复</strong><p>${escapeHtml(item.reply)}</p></div>` : '<div class="pending-reply">专家尚未回复，可稍后回到本页查看。</div>'}
      </article>`
  }

  async function renderExperts() {
    setMeta('专家咨询', '查看共享专家队伍，登录后提交棉花种植问题并跟踪回复')
    setActiveNav('experts')
    const token = localStorage.getItem('knowledge_token') || ''

    main.innerHTML = `
      ${pageHero('EXPERT CONSULTATION', '专家咨询', '专家资料与原棉花平台共享。登录后可提交田间问题，管理员与专家在同一后台持续处理。', 'experts-hero')}
      <section class="section-block">
        <div class="shell">
          ${sectionHeading('SHARED EXPERT TEAM', '公益专家队伍', '专家账号、擅长领域与咨询记录使用共享数据库，避免在两个平台重复维护。')}
          <div class="expert-grid" id="expertGrid"><div class="loading-panel">正在加载专家信息...</div></div>
        </div>
      </section>
      <section class="expert-consult-section">
        <div class="shell expert-consult-layout">
          <div class="consultation-intro">
            <span class="eyebrow">ASK A QUESTION</span>
            <h2>把田间情况描述完整</h2>
            <p>建议写清所在地、棉花生育期、异常分布、近期水肥或用药记录。线上回复用于提供排查思路，不替代必须到场完成的诊断。</p>
            <div class="consult-preparation"><strong>提问前准备</strong><span>整体分布</span><span>局部症状</span><span>近期操作</span><span>天气变化</span></div>
          </div>
          <div class="expert-question-panel" id="expertQuestionPanel">
            ${token ? `
              <form id="expertQuestionForm" class="expert-question-form">
                <div class="form-heading"><h2>提交公益咨询</h2><p>问题将进入原平台专家后台，由平台统一分配回复。</p></div>
                <div class="expert-form-grid">
                  <label><span>问题类型</span><select name="category" required><option value="">请选择</option><option>病虫害</option><option>水肥管理</option><option>苗情诊断</option><option>花铃期管理</option><option>采收管理</option><option>其他</option></select></label>
                  <label><span>生育阶段</span><select name="cropStage"><option value="">请选择</option>${data.trainingCategories.slice(1).map(item => `<option>${escapeHtml(item.name)}</option>`).join('')}</select></label>
                  <label class="full"><span>问题描述</span><textarea name="question" minlength="5" maxlength="1000" rows="7" placeholder="例如：异常从地头开始出现，叶片背面可见细小虫体，三天前完成滴水..." required></textarea></label>
                </div>
                <div class="expert-form-action"><p id="expertFormMessage" aria-live="polite"></p><button class="button primary" type="submit">提交问题</button></div>
              </form>` : `
              <div class="login-required">
                <span class="eyebrow">ACCOUNT REQUIRED</span>
                <h2>登录后提交问题</h2>
                <p>专家咨询使用棉花平台统一账号。登录后可以查看自己的历史问题与专家回复。</p>
                <a class="button primary" href="${publicLink('/login?next=%2Fpublic%2Fexperts')}">登录</a>
                <a class="button outline" href="${publicLink('/login?mode=register&next=%2Fpublic%2Fexperts')}">注册</a>
              </div>`}
          </div>
        </div>
      </section>
      ${token ? `
        <section class="section-block">
          <div class="shell">
            ${sectionHeading('MY CONSULTATIONS', '我的咨询记录', '回复状态与原平台专家后台实时同步。')}
            <div class="question-records" id="questionRecords"><div class="loading-panel">正在加载咨询记录...</div></div>
          </div>
        </section>` : ''}
      <section class="consult-boundary-band">
        <div class="shell consult-boundary-grid">
          <div><strong>账号互通</strong><p>沿用棉花平台账号，专家与咨询记录不重复创建。</p></div>
          <div><strong>信息完整</strong><p>尽量提供分布、阶段和近期操作，避免只描述单一症状。</p></div>
          <div><strong>建议有边界</strong><p>农药、肥料、灾害和病害处置以标签、属地规程和现场意见为准。</p></div>
        </div>
      </section>`

    const expertGrid = document.getElementById('expertGrid')
    try {
      const result = await publicServiceApi('/experts')
      expertGrid.innerHTML = result.experts.length
        ? result.experts.map(expertCard).join('')
        : '<div class="empty-panel"><strong>专家资料正在维护</strong><p>管理员启用专家账号后会在这里自动显示。</p></div>'
    } catch (error) {
      expertGrid.innerHTML = `<div class="empty-panel error"><strong>专家信息加载失败</strong><p>${escapeHtml(error.message)}</p></div>`
    }

    if (!token) return

    const records = document.getElementById('questionRecords')
    const loadQuestions = async () => {
      try {
        const result = await publicServiceApi('/my-expert-questions')
        records.innerHTML = result.questions.length
          ? result.questions.map(questionCard).join('')
          : '<div class="empty-panel"><strong>还没有咨询记录</strong><p>提交第一个问题后，处理状态会显示在这里。</p></div>'
      } catch (error) {
        records.innerHTML = `<div class="empty-panel error"><strong>咨询记录加载失败</strong><p>${escapeHtml(error.message)}</p></div>`
      }
    }
    loadQuestions()

    document.getElementById('expertQuestionForm').addEventListener('submit', async event => {
      event.preventDefault()
      const form = event.currentTarget
      const button = form.querySelector('button[type="submit"]')
      const message = document.getElementById('expertFormMessage')
      const values = Object.fromEntries(new FormData(form).entries())
      button.disabled = true
      message.textContent = '正在提交...'
      try {
        await publicServiceApi('/expert-questions', { method: 'POST', body: JSON.stringify(values) })
        form.reset()
        message.textContent = '问题已提交，专家回复后会显示在下方记录中。'
        await loadQuestions()
      } catch (error) {
        message.textContent = error.message
      } finally {
        button.disabled = false
      }
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
    const productCategoryByTraining = {
      planting: ['seed', 'film'],
      seedling: ['fertilizer', 'film'],
      water: ['irrigation', 'fertilizer'],
      pest: ['pesticide'],
      boll: ['fertilizer', 'irrigation'],
      harvest: ['film']
    }
    const preferredProductCategories = productCategoryByTraining[item.category] || []
    const relatedProducts = data.products
      .filter(product => preferredProductCategories.includes(product.category))
      .concat(data.products.filter(product => !preferredProductCategories.includes(product.category)))
      .slice(0, 3)
    main.innerHTML = `
      <article class="reading-page">
        <header class="reading-header">
          <div class="shell reading-header-inner">
            <nav class="breadcrumbs" aria-label="面包屑"><a href="${link('/')}">首页</a><span>/</span><a href="${link('/training')}">棉花培训</a><span>/</span><span>${escapeHtml(item.categoryName)}</span></nav>
            <span class="eyebrow">${escapeHtml(item.categoryName)}</span>
            <h1>${escapeHtml(item.title)}</h1>
            <p>${escapeHtml(item.lead)}</p>
            <div class="reading-meta"><span>${escapeHtml(item.readTime)}</span><span>${escapeHtml(item.source)}</span></div>
          </div>
        </header>
        <div class="reading-cover"><img src="${item.image}" alt="${escapeHtml(item.title)}"></div>
        <div class="shell reading-layout">
          <div class="rich-article reading-body">
            ${articleSections(item)}
            <section class="field-checklist"><span class="eyebrow">FIELD CHECKLIST</span><h2>带到田间的检查清单</h2><ul>${item.checklist.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul></section>
            ${sourceReference(item, '查看原始技术资料')}
            <aside class="safety-note"><strong>内容边界</strong><p>文章用于建立观察和记录方法。涉及具体品种、水肥量、农药使用与灾害处置时，请结合属地技术规程、产品标签和现场专业意见。</p></aside>
          </div>
          <aside class="reading-aside">
            <span class="eyebrow">CONTINUE LEARNING</span>
            <h2>继续学习</h2>
            ${related.map(article => `<a href="${link(`/training/${article.id}`)}"><span>${escapeHtml(article.categoryName)}</span><strong>${escapeHtml(article.title)}</strong></a>`).join('')}
            <a class="button outline full" href="${publicLink('/courses')}">浏览图文课程</a>
          </aside>
        </div>
      </article>
      <section class="section-block connected-content-section">
        <div class="shell">
          ${sectionHeading('CONNECTED PRODUCTS', '相关商业资料', '农技培训与商业平台共享内容关联，但产品选择和实际使用仍需单独核验。', `<a class="section-action" href="${businessLink('/products')}">前往商业平台</a>`)}
          <div class="product-grid related-grid">${relatedProducts.map(productCard).join('')}</div>
        </div>
      </section>`
  }

  function renderPolicies() {
    setMeta('政策资讯', '公益整理农业政策信息的来源核验、适用范围和阅读方法')
    setActiveNav('policies')
    const policies = data.news.filter(item => item.category === 'policy')

    main.innerHTML = `
      ${pageHero('AGRICULTURAL POLICY', '政策资讯', '帮助种植户找到原始来源、核对适用范围和办理条件，不用转发截图替代正式文件。', 'policies-hero')}
      <section class="notice-band">
        <div class="shell"><strong>使用说明</strong><p>页面内容依据政府部门公开信息整理，每条均保留发布部门和原文链接。政策办理以官方原文、属地通知和实际受理要求为准。</p></div>
      </section>
      <section class="section-block">
        <div class="shell">
          ${sectionHeading('POLICY BRIEFING', '政策阅读与核验', '先确认来源和对象，再判断是否与自己的地区、主体和申报时间相符。')}
          <div class="news-grid policy-grid">${policies.map(item => newsCard(item, false, 'public')).join('')}</div>
        </div>
      </section>
      <section class="policy-check-band">
        <div class="shell policy-check-grid">
          <div><span>01</span><strong>查发布主体</strong><p>优先进入政府部门官网、政务服务平台或正式文件页面。</p></div>
          <div><span>02</span><strong>查适用范围</strong><p>核对地区、主体、面积条件、办理期限与所需材料。</p></div>
          <div><span>03</span><strong>查官方渠道</strong><p>对条款理解不清时，通过文件公布的部门和属地窗口确认。</p></div>
        </div>
      </section>`
  }

  function renderActivities() {
    setMeta('公益活动', '棉花田间开放日、公益工作坊、公开课和志愿服务活动')
    setActiveNav('activities')
    main.innerHTML = `
      ${pageHero('PUBLIC EVENTS', '公益活动', '用田间开放日、线上公开课和志愿服务，把公开知识带到真实生产问题中。', 'activities-hero')}
      <section class="section-block">
        <div class="shell">
          ${sectionHeading('PUBLIC PROGRAMS', '公益服务项目', '当前展示常态化服务方向和需求征集入口；具体活动只在时间、地点与组织方确认后发布。')}
          <div class="activity-grid">${data.activities.map(activityCard).join('')}</div>
        </div>
      </section>
      <section class="activity-principles">
        <div class="shell activity-principles-grid">
          <div><strong>免费开放</strong><p>公益活动不收取课程费用，交通与个人支出以正式通知为准。</p></div>
          <div><strong>农时优先</strong><p>线下活动根据天气、作物阶段和田间条件动态确认。</p></div>
          <div><strong>内容可复用</strong><p>活动资料和共性问题将整理为公开图文课程或知识条目。</p></div>
        </div>
      </section>`
  }

  function renderActivityDetail(item) {
    if (!item) return renderNotFound()
    setMeta(item.title, item.summary)
    setActiveNav('activities')
    main.innerHTML = `
      <article class="activity-detail">
        <header class="activity-detail-header">
          <div class="shell">
            <nav class="breadcrumbs" aria-label="面包屑"><a href="${publicLink('/')}">首页</a><span>/</span><a href="${publicLink('/activities')}">公益活动</a><span>/</span><span>${escapeHtml(item.status)}</span></nav>
            <span class="eyebrow">${escapeHtml(item.format)} · ${escapeHtml(item.status)}</span>
            <h1>${escapeHtml(item.title)}</h1>
            <p>${escapeHtml(item.summary)}</p>
          </div>
        </header>
        <div class="shell activity-detail-layout">
          <div class="activity-detail-main">
            <img class="activity-detail-image" src="${item.image}" alt="">
            <section><span class="eyebrow">ABOUT EVENT</span><h2>活动介绍</h2><p>${escapeHtml(item.description)}</p></section>
            <section><span class="eyebrow">AGENDA</span><h2>活动安排</h2><ol>${item.agenda.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ol></section>
            <aside class="safety-note"><strong>活动说明</strong><p>${escapeHtml(item.notice)}</p></aside>
          </div>
          <aside class="activity-signup">
            <span class="activity-status">${escapeHtml(item.status)}</span>
            <h2>活动信息</h2>
            <dl>
              <div><dt>时间</dt><dd>${escapeHtml(item.date)}</dd></div>
              <div><dt>地点</dt><dd>${escapeHtml(item.location)}</dd></div>
              <div><dt>形式</dt><dd>${escapeHtml(item.format)}</dd></div>
              <div><dt>规模</dt><dd>${escapeHtml(item.capacity)}</dd></div>
            </dl>
            <form id="activityInterestForm">
              <label><span>姓名或称呼</span><input name="name" maxlength="40" required></label>
              <label><span>联系电话</span><input name="phone" inputmode="tel" maxlength="20" autocomplete="tel" required></label>
              <label><span>所在地区</span><input name="region" maxlength="80" placeholder="例如：新疆阿克苏"></label>
              <label><span>希望了解的问题</span><textarea name="message" maxlength="1200" placeholder="可填写地块阶段、关注问题或希望参加的形式"></textarea></label>
              <input class="form-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
              <label class="consent"><input type="checkbox" name="consent" required><span>同意平台按<a href="${publicLink('/privacy')}" target="_blank">个人信息使用说明</a>联系和组织本次公益服务。</span></label>
              <button class="button primary full" type="submit">提交参与意向</button>
              <p id="activityFormMessage" aria-live="polite"></p>
            </form>
          </aside>
        </div>
      </article>`

    document.getElementById('activityInterestForm').addEventListener('submit', async event => {
      event.preventDefault()
      const form = event.currentTarget
      const values = Object.fromEntries(new FormData(form).entries())
      const button = form.querySelector('button[type="submit"]')
      const message = document.getElementById('activityFormMessage')
      button.disabled = true
      button.textContent = '正在提交...'
      message.textContent = ''
      try {
        const result = await publicServiceRequest('/activity-interests', {
          ...values,
          activityId: item.id,
          activityName: item.title,
          sourcePath: location.pathname
        })
        message.textContent = `${result.msg}。这是一项参与意向，不等同于正式报名。`
        form.reset()
      } catch (error) {
        message.textContent = error.message
      } finally {
        button.disabled = false
        button.textContent = '提交参与意向'
      }
    })
  }

  function renderNews() {
    setMeta('新闻资讯', '棉花产业、质量标准与加工动态')
    setActiveNav('news')
    const businessCategories = data.newsCategories.filter(item => item.id !== 'policy')
    const businessNews = data.news.filter(item => item.category !== 'policy')

    main.innerHTML = `
      ${pageHero('NEWS & INSIGHTS', '新闻资讯', '整理棉花产业、质量标准和加工动态，内容保留官方来源；农业政策可在公共服务平台查阅。', 'news-hero')}
      <section class="section-block">
        <div class="shell news-layout">
          <div>
            <div class="filter-tabs" id="newsFilters">
              ${businessCategories.map((item, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-category="${item.id}">${escapeHtml(item.name)}</button>`).join('')}
            </div>
            <div class="news-list" id="newsList">${businessNews.map(item => newsCard(item)).join('')}</div>
          </div>
          <aside class="news-aside">
            <div><span class="eyebrow">INFORMATION NOTE</span><h2>资讯使用说明</h2><p>页面依据政府部门和权威机构公开信息整理，并在详情页保留原文链接。产业数据会持续变化，请结合发布日期阅读。</p><a class="text-link" href="${publicLink('/policies')}">前往公益政策资讯 →</a></div>
            <div><h2>资讯分类</h2>${businessCategories.slice(1).map(item => `<button type="button" data-news-jump="${item.id}"><span>${escapeHtml(item.name)}</span><strong>${businessNews.filter(news => news.category === item.id).length}</strong></button>`).join('')}</div>
          </aside>
        </div>
      </section>`

    const applyCategory = category => {
      const filtered = category === 'all' ? businessNews : businessNews.filter(item => item.category === category)
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

  function renderNewsDetail(item, target = 'business') {
    if (!item) return renderNotFound()
    const publicPolicy = target === 'public'
    if (publicPolicy && item.category !== 'policy') return renderNotFound()
    if (!publicPolicy && item.category === 'policy') return renderNotFound()
    setMeta(item.title, item.summary)
    setActiveNav(publicPolicy ? 'policies' : 'news')

    const related = data.news
      .filter(news => news.id !== item.id && (publicPolicy ? news.category === 'policy' : news.category !== 'policy'))
      .slice(0, 3)
    const homeHref = publicPolicy ? publicLink('/') : businessLink('/')
    const listHref = publicPolicy ? publicLink('/policies') : businessLink('/news')
    const listLabel = publicPolicy ? '政策资讯' : '新闻资讯'
    const detailHref = news => publicPolicy ? publicLink(`/policies/${news.id}`) : businessLink(`/news/${news.id}`)
    main.innerHTML = `
      <article class="reading-page news-reading">
        <header class="reading-header">
          <div class="shell reading-header-inner">
            <nav class="breadcrumbs" aria-label="面包屑"><a href="${homeHref}">首页</a><span>/</span><a href="${listHref}">${listLabel}</a><span>/</span><span>${escapeHtml(item.categoryName)}</span></nav>
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
            ${sourceReference(item, publicPolicy ? '查看政策原文' : '查看官方原文')}
            <aside class="safety-note"><strong>信息说明</strong><p>本页为公开资料摘要，便于快速理解重点，不替代原始文件。涉及政策办理、质量标准或经营判断时，请以原文及主管部门最新要求为准。</p></aside>
          </div>
          <aside class="reading-aside">
            <span class="eyebrow">LATEST NEWS</span>
            <h2>更多资讯</h2>
            ${related.map(news => `<a href="${detailHref(news)}"><span>${escapeHtml(news.categoryName)} · ${news.date}</span><strong>${escapeHtml(news.title)}</strong></a>`).join('')}
            <a class="button outline full" href="${listHref}">返回${listLabel}列表</a>
          </aside>
        </div>
      </article>`
  }

  function renderAbout() {
    setMeta('关于我们', '了解棉知商业平台的定位、服务原则和建设方向')
    setActiveNav('about')
    main.innerHTML = `
      ${pageHero('ABOUT US', '关于我们', '以新疆棉田真实需求为起点，连接农资供应、农机作业、产业信息与数字履约服务。', 'about-hero')}
      <section class="section-block">
        <div class="shell about-intro">
          <div><span class="eyebrow">OUR PURPOSE</span><h2>让供需信息更透明，让田间服务更连续</h2></div>
          <div><p>棉知商业平台面向新疆棉花产业集中展示农资品类、农机作业、产业资讯和数字服务能力。培训、技术交流和公开问答由独立的公共服务平台承载，两端通过内容关联和统一数据保持协同。</p><p>产品是否适用、农机是否可调度、实际规格与价格，都需要结合地块、作物阶段、农时和当地要求，由服务人员进一步确认。</p></div>
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
          ${sectionHeading('BUSINESS SCOPE', '商业平台服务范围', '以下内容形成独立商业展示，并可与公共服务平台的农技培训建立关联。')}
          <div class="scope-grid">
            <div><strong>农资产品</strong><p>种子、肥料、植保、农膜、滴灌材料的列表和详情。</p></div>
            <div><strong>农机服务</strong><p>从耕整地、播种到植保、采收和转运的关键农时服务。</p></div>
            <div><strong>数字履约</strong><p>连接订单、支付、物流或作业进度、客服与评价记录。</p></div>
            <div><strong>新闻资讯</strong><p>棉花行业、质量监管和加工动态的分类内容，并保留官方来源。</p></div>
            <div><strong>商务联系</strong><p>产品信息、渠道合作和公司服务的联系入口。</p></div>
            <div><strong>公益关联</strong><p>商品与农机服务关联培训内容，帮助用户理解适用场景和作业边界。</p></div>
          </div>
        </div>
      </section>
      <section class="contact-band"><div class="shell contact-band-inner"><div><span class="eyebrow">WORK WITH US</span><h2>从一项具体的产品或合作需求开始</h2><p>提交产品信息、供货服务或商务合作需求，服务人员将进一步沟通。</p></div><a class="button primary" href="${link('/contact')}">联系我们</a></div></section>`
  }

  function renderContact() {
    setMeta('商务联系', '联系棉知商业团队，提交农资、农机、渠道或合作需求')
    setActiveNav('contact')

    const params = new URLSearchParams(window.location.search)
    const productId = params.get('product') || ''
    const machineryId = params.get('machine') || ''
    const selectedProduct = productById(productId)
    const selectedMachinery = machineryById(machineryId)
    const selectedReference = selectedProduct
      ? `product:${selectedProduct.id}`
      : selectedMachinery
        ? `machine:${selectedMachinery.id}`
        : ''

    main.innerHTML = `
      ${pageHero('BUSINESS CONTACT', '商务联系', '可在此提交农资供应、农机作业、渠道合作或公司业务需求，工作人员会根据所填信息安排联系。', 'contact-hero')}
      <section class="section-block">
        <div class="shell contact-layout">
          <div class="contact-info">
            <span class="eyebrow">BUSINESS DESK</span>
            <h2>商务团队</h2>
            <p>平台暂未公开线下电话和详细办公地址。您可以在此提交农资、农机或合作需求，管理员会在网站后台查看并安排联系。</p>
            <dl>
              <div><dt>联系渠道</dt><dd>${data.company.phone ? escapeHtml(data.company.phone) : '本页商务需求表单'}</dd></div>
              <div><dt>服务时间</dt><dd>${escapeHtml(data.company.hours)}</dd></div>
              <div><dt>覆盖范围</dt><dd>${escapeHtml(data.company.address)}</dd></div>
              <div><dt>服务区域</dt><dd>${data.company.serviceAreas.map(escapeHtml).join(' · ')}</dd></div>
            </dl>
            <div class="response-note"><strong>提交前建议准备</strong><p>所在地区、地块面积、关注的产品或作业类型、预计时间、合作方式和希望进一步了解的资料。</p></div>
          </div>
          <form class="contact-form" id="contactForm">
            <div class="form-heading"><span class="eyebrow">REQUEST NOTE</span><h2>提交服务需求</h2><p>带 * 的项目为必填项，提交后可由平台管理员查看和处理。</p></div>
            <div class="form-grid">
              <label><span>姓名或称呼 *</span><input name="name" maxlength="30" autocomplete="name" required></label>
              <label><span>联系电话 *</span><input name="phone" inputmode="tel" maxlength="20" autocomplete="tel" required></label>
              <label><span>需求类型 *</span><select name="type" required><option value="">请选择</option><option>产品资料</option><option>供货服务</option><option>农机服务</option><option>渠道合作</option><option>公司合作</option><option>其他商务需求</option></select></label>
              <label><span>所在地区</span><input name="region" maxlength="80" placeholder="例如：新疆阿克苏"></label>
              <label class="full"><span>咨询业务</span><select name="reference"><option value="">不指定业务</option><optgroup label="农资供应">${data.products.map(item => `<option value="product:${item.id}" ${selectedReference === `product:${item.id}` ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</optgroup><optgroup label="农机服务">${data.machinery.map(item => `<option value="machine:${item.id}" ${selectedReference === `machine:${item.id}` ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</optgroup></select></label>
              <label class="full"><span>需求描述 *</span><textarea name="message" maxlength="1200" required placeholder="请写明关注的产品或作业、数量或面积、所在地区、预计时间及合作需求。">${selectedProduct ? `我想了解“${escapeHtml(selectedProduct.name)}”的规格、供货条件和服务方式。` : selectedMachinery ? `我想了解“${escapeHtml(selectedMachinery.name)}”的服务范围、作业档期和计价方式。` : ''}</textarea></label>
              <input class="form-trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
            </div>
            <label class="consent"><input type="checkbox" name="consent" required><span>同意平台按<a href="${publicLink('/privacy')}" target="_blank">个人信息使用说明</a>处理本次需求并通过所填号码与我联系。</span></label>
            <div class="form-submit"><button class="button primary" type="submit">提交商务需求</button><span id="formMessage" role="status"></span></div>
          </form>
        </div>
      </section>`

    document.getElementById('contactForm').addEventListener('submit', async event => {
      event.preventDefault()
      const form = event.currentTarget
      const entries = Object.fromEntries(new FormData(form).entries())
      const button = form.querySelector('button[type="submit"]')
      const message = document.getElementById('formMessage')
      const [referenceType = '', referenceId = ''] = String(entries.reference || '').split(':')
      const reference = referenceType === 'machine' ? machineryById(referenceId) : productById(referenceId)
      button.disabled = true
      button.textContent = '正在提交...'
      message.textContent = ''
      try {
        const result = await publicServiceRequest('/business-inquiries', {
          ...entries,
          referenceType,
          referenceId: reference?.id || '',
          referenceName: reference?.name || '',
          sourcePath: location.pathname
        })
        message.textContent = result.msg
        form.reset()
      } catch (error) {
        message.textContent = error.message
      } finally {
        button.disabled = false
        button.textContent = '提交商务需求'
      }
    })
  }

  function renderPrivacy() {
    setMeta('个人信息使用说明', '了解平台收集和使用个人信息的范围，并提交查阅、更正或删除申请')
    setActiveNav('')
    const token = localStorage.getItem('knowledge_token') || ''
    main.innerHTML = `
      ${pageHero('PRIVACY & ACCOUNT DATA', '个人信息使用说明', '说明公共服务与商业网站在账号、学习、咨询和服务需求中如何使用信息，并提供可追踪的处理申请入口。', 'privacy-hero')}
      <section class="section-block">
        <div class="shell privacy-layout">
          <article class="privacy-content">
            <section><span class="eyebrow">SCOPE</span><h2>我们处理哪些信息</h2><p>注册和登录时使用手机号、密码哈希、姓名或称呼及可选地区信息；学习时记录课程进度、收藏、评论、问答和积分流水；提交专家咨询、公益活动意向或商务需求时记录用户主动填写的内容和联系方式。</p></section>
            <section><span class="eyebrow">PURPOSE</span><h2>信息用于什么目的</h2><p>信息仅用于账号识别、保存学习记录、回复咨询、处理服务需求、完成订单与支付、保障账号安全和履行必要的运营审计。不会因为浏览公开培训、政策或商品资料而要求登录。</p></section>
            <section><span class="eyebrow">THIRD-PARTY SERVICES</span><h2>必要的外部服务</h2><p>微信登录与支付、天气数据、对象存储和 AI 问答可能由对应服务商处理完成。平台只发送完成该功能所需的数据；提交 AI 问题时请勿填写身份证号、银行卡号等无关敏感信息。</p></section>
            <section><span class="eyebrow">STORAGE</span><h2>保存与安全</h2><p>账号、订单、学习和服务记录保存在平台共享 MySQL；实名认证图片和课程素材保存在受控文件卷或对象存储。敏感配置不进入代码仓库，服务设置访问控制、上传类型限制、登录失败限制、日志滚动和定期备份。</p></section>
            <section><span class="eyebrow">YOUR RIGHTS</span><h2>查阅、更正与删除</h2><p>登录后可以提交个人信息处理申请。删除账号申请不会立即抹除仍处于交易、退款、争议处理或依法需要留存的记录；管理员核验身份后会删除、匿名化或限制使用不再需要的信息，并在处理备注中记录结果。</p></section>
          </article>
          <aside class="privacy-request-panel">
            ${token ? `
              <span class="eyebrow">DATA REQUEST</span>
              <h2>提交处理申请</h2>
              <p>申请会进入网站运营台，管理员需要先核验当前登录账号。</p>
              <form id="privacyRequestForm">
                <label><span>申请类型</span><select name="type" required><option value="">请选择</option><option>查阅个人信息</option><option>更正个人信息</option><option>删除账号与数据</option><option>撤回服务申请</option><option>其他个人信息问题</option></select></label>
                <label><span>具体说明</span><textarea name="message" minlength="5" maxlength="1200" rows="6" required placeholder="请说明希望查阅、更正或删除的内容。"></textarea></label>
                <button class="button primary full" type="submit">提交申请</button>
                <p id="privacyRequestMessage" role="status" aria-live="polite"></p>
              </form>` : `
              <span class="eyebrow">ACCOUNT REQUIRED</span>
              <h2>登录后提交申请</h2>
              <p>为避免他人冒用手机号发起数据操作，个人信息申请必须从本人账号提交。</p>
              <a class="button primary full" href="${publicLink('/login?next=%2Fpublic%2Fprivacy')}">登录公益账号</a>`}
          </aside>
        </div>
      </section>`

    if (!token) return
    document.getElementById('privacyRequestForm').addEventListener('submit', async event => {
      event.preventDefault()
      const form = event.currentTarget
      const button = form.querySelector('button[type="submit"]')
      const message = document.getElementById('privacyRequestMessage')
      const values = Object.fromEntries(new FormData(form).entries())
      button.disabled = true
      button.textContent = '正在提交...'
      message.textContent = ''
      try {
        const result = await publicServiceApi('/privacy-requests', {
          method: 'POST',
          body: JSON.stringify({ ...values, sourcePath: location.pathname })
        })
        message.textContent = result ? '申请已提交，可由网站运营管理员跟进处理。' : '申请已提交。'
        form.reset()
      } catch (error) {
        message.textContent = error.message
      } finally {
        button.disabled = false
        button.textContent = '提交申请'
      }
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
    document.getElementById('serviceContact').textContent = data.company.phone
      ? `服务热线：${data.company.phone}`
      : '商务咨询：查看商业平台联系说明'
    document.getElementById('footerPhone').textContent = data.company.phone || '在线商务联系'
    document.getElementById('footerHours').textContent = data.company.hours
    document.getElementById('footerAddress').textContent = data.company.address

    const brand = document.getElementById('siteBrand')
    const brandName = document.getElementById('brandName')
    const brandSub = document.getElementById('brandSub')
    const serviceLabel = document.getElementById('serviceLabel')
    const action = document.getElementById('headerAction')
    const button = document.getElementById('menuButton')
    const nav = document.getElementById('mainNav')

    if (platform === 'public') {
      let account = null
      try { account = JSON.parse(localStorage.getItem('knowledge_user') || 'null') } catch {}
      document.body.dataset.platform = 'public'
      brand.href = publicLink('/')
      brand.setAttribute('aria-label', '喀什优棉公共服务平台首页')
      brandName.textContent = '喀什优棉公共服务平台'
      brandSub.textContent = 'PUBLIC COTTON SERVICE'
      serviceLabel.textContent = '政策资讯 · 专家讲堂 · 生产服务 · 品种优选'
      nav.innerHTML = `
        <a href="${publicLink('/')}" data-nav="home">公共服务首页</a>
        <a href="${publicLink('/policies')}" data-nav="policies">政策资讯</a>
        <a href="${publicLink('/experts')}" data-nav="experts">专家讲堂</a>
        <a href="${publicLink('/finance')}" data-nav="finance">优棉金融</a>
        <a href="${publicLink('/machinery')}" data-nav="services">生产服务</a>
        <a href="${publicLink('/varieties')}" data-nav="varieties">品种优选</a>
        <a href="${publicLink('/courses')}" data-nav="courses">棉知学堂</a>
        <a class="platform-switch-link" href="${businessLink('/')}">商业平台</a>`
      action.href = publicLink('/login')
      action.textContent = account ? (account.real_name || account.name || '我的账号') : '登录'
    } else if (platform === 'business') {
      document.body.dataset.platform = 'business'
      brand.href = businessLink('/')
      brand.setAttribute('aria-label', '棉知商业平台首页')
      brandName.textContent = '棉知商业平台'
      brandSub.textContent = 'XINJIANG AGRI BUSINESS'
      serviceLabel.textContent = '农资供应 · 农机服务 · 商务协同'
      nav.innerHTML = `
        <a href="${businessLink('/')}" data-nav="home">商业首页</a>
        <a href="${businessLink('/products')}" data-nav="products">农资产品</a>
        <a href="${businessLink('/machinery')}" data-nav="machinery">农机服务</a>
        <a href="${businessLink('/news')}" data-nav="news">新闻资讯</a>
        <a href="${businessLink('/about')}" data-nav="about">关于我们</a>
        <a class="platform-switch-link" href="${publicLink('/')}">公共服务平台</a>`
      action.href = businessLink('/contact')
      action.textContent = '商务联系'
    } else {
      document.body.dataset.platform = 'public'
      brand.href = publicLink('/')
      brand.setAttribute('aria-label', '喀什优棉公共服务平台首页')
      brandName.textContent = '棉知农业服务'
      brandSub.textContent = 'PUBLIC COTTON SERVICE'
      serviceLabel.textContent = '公共服务平台 · 农业商业服务'
      nav.innerHTML = `
        <a href="${publicLink('/')}">公共服务平台</a>
        <a href="${businessLink('/')}">商业平台</a>`
      action.href = '/platform/admin'
      action.textContent = '业务平台登录'
    }

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

  const learningViews = window.COTTON_LEARNING?.create({
    main,
    escapeHtml,
    publicLink,
    setMeta,
    setActiveNav,
    pageHero,
    sectionHeading,
    renderNotFound
  })

  const publicModulesViews = window.COTTON_PUBLIC_MODULES?.create({
    main,
    escapeHtml,
    publicLink,
    setMeta,
    setActiveNav
  })

  setupHeader()

  if (platform === 'hub' && (routePath === '/' || routePath === '/index.html')) window.location.replace(publicLink('/'))
  else if (platform === 'public' && pageGroup === 'home') renderPublicHome()
  else if (platform === 'public' && pageGroup === 'training' && pathParts.length === 1) renderTraining()
  else if (platform === 'public' && pageGroup === 'training') renderTrainingDetail(trainingById(pathParts[1]))
  else if (platform === 'public' && pageGroup === 'courses' && pathParts.length === 1) learningViews?.renderCourses()
  else if (platform === 'public' && pageGroup === 'courses') learningViews?.renderCourseDetail(pathParts[1])
  else if (platform === 'public' && pageGroup === 'forum' && pathParts.length === 1) learningViews?.renderForum()
  else if (platform === 'public' && pageGroup === 'forum') learningViews?.renderForumDetail(pathParts[1])
  else if (platform === 'public' && pageGroup === 'login') learningViews?.renderLogin()
  else if (platform === 'public' && pageGroup === 'privacy') renderPrivacy()
  else if (platform === 'public' && pageGroup === 'consult') renderExperts()
  else if (platform === 'public' && pageGroup === 'experts' && pathParts.length === 1) publicModulesViews?.renderExperts()
  else if (platform === 'public' && pageGroup === 'experts') publicModulesViews?.renderExpertDetail(pathParts[1])
  else if (platform === 'public' && pageGroup === 'policies' && pathParts.length === 1) publicModulesViews?.renderPolicies()
  else if (platform === 'public' && pageGroup === 'policies') publicModulesViews?.renderArticleDetail(pathParts[1], 'policy')
  else if (platform === 'public' && pageGroup === 'finance' && pathParts.length === 1) publicModulesViews?.renderFinance()
  else if (platform === 'public' && pageGroup === 'finance') publicModulesViews?.renderArticleDetail(pathParts[1], 'finance')
  else if (platform === 'public' && pageGroup === 'machinery' && pathParts.length === 1) publicModulesViews?.renderProducts('machinery')
  else if (platform === 'public' && pageGroup === 'machinery') publicModulesViews?.renderProductDetail('machinery', pathParts[1])
  else if (platform === 'public' && pageGroup === 'supplies' && pathParts.length === 1) publicModulesViews?.renderProducts('supplies')
  else if (platform === 'public' && pageGroup === 'supplies') publicModulesViews?.renderProductDetail('supplies', pathParts[1])
  else if (platform === 'public' && pageGroup === 'processing' && pathParts.length === 1) publicModulesViews?.renderProcessing()
  else if (platform === 'public' && pageGroup === 'processing') publicModulesViews?.renderProcessingDetail(pathParts[1])
  else if (platform === 'public' && pageGroup === 'varieties' && pathParts.length === 1) publicModulesViews?.renderVarieties()
  else if (platform === 'public' && pageGroup === 'varieties') publicModulesViews?.renderVarietyDetail(pathParts[1])
  else if (platform === 'public' && pageGroup === 'pests' && pathParts.length === 1) publicModulesViews?.renderPests()
  else if (platform === 'public' && pageGroup === 'pests') publicModulesViews?.renderPestDetail(pathParts[1])
  else if (platform === 'public' && pageGroup === 'activities' && pathParts.length === 1) renderActivities()
  else if (platform === 'public' && pageGroup === 'activities') renderActivityDetail(activityById(pathParts[1]))
  else if (platform === 'business' && pageGroup === 'home') renderBusinessHome()
  else if (platform === 'business' && pageGroup === 'products' && pathParts.length === 1) renderProducts()
  else if (platform === 'business' && pageGroup === 'products') renderProductDetail(productById(pathParts[1]))
  else if (platform === 'business' && pageGroup === 'machinery' && pathParts.length === 1) renderMachinery()
  else if (platform === 'business' && pageGroup === 'machinery') renderMachineryDetail(machineryById(pathParts[1]))
  else if (platform === 'business' && pageGroup === 'news' && pathParts.length === 1) renderNews()
  else if (platform === 'business' && pageGroup === 'news') renderNewsDetail(newsById(pathParts[1]))
  else if (platform === 'business' && pageGroup === 'about') renderAbout()
  else if (platform === 'business' && pageGroup === 'contact') renderContact()
  else renderNotFound()
})()
