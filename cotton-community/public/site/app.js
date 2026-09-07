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
  const platform = ['public', 'business'].includes(routeParts[0]) ? routeParts[0] : 'business'
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

  const readLocalList = key => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]')
      return Array.isArray(value) ? value : []
    } catch { return [] }
  }
  const writeLocalList = (key, value) => localStorage.setItem(key, JSON.stringify(value))
  const cartKey = 'cotton_web_cart'
  const favoriteKey = 'cotton_web_favorites'
  let commerceMerchantsCache = null
  const categoryMap = value => {
    const text = String(value || '')
    if (/种子/.test(text)) return 'seed'
    if (/肥/.test(text)) return 'fertilizer'
    if (/农药|植保/.test(text)) return 'pesticide'
    if (/膜/.test(text)) return 'film'
    if (/滴灌|灌溉/.test(text)) return 'irrigation'
    return 'other'
  }

  const productCategoryProfiles = {
    seed: {
      highlights: ['包衣棉种', '播前核验', '适配机采'],
      specs: [['常见包装', '20kg/袋'], ['适用场景', '南疆棉区播种'], ['购买核验', '品种审定、检疫及种子标签']],
      detail: '棉种应根据县域适宜性、播期、积温和机采要求选择。收货后请核对品种名称、审定编号、生产经营许可证、检疫证明、净含量、发芽率和生产批次。'
    },
    fertilizer: {
      highlights: ['棉田用肥', '滴灌适配', '养分清晰'],
      specs: [['产品形态', '颗粒或全水溶肥'], ['适用场景', '棉田基肥、追肥'], ['购买核验', '养分含量、执行标准及批次标签']],
      detail: '肥料配方应结合土壤检测、目标产量、生育期和水肥计划确定。购买前核对总养分、单项养分、执行标准、净含量和生产批次。'
    },
    pesticide: {
      highlights: ['登记信息核验', '适期防治', '按标签使用'],
      specs: [['产品形态', '以商品标签为准'], ['适用对象', '以登记作物和防治对象为准'], ['购买核验', '农药登记证号、有效成分及批次']],
      detail: '农药不得仅按通用名称购买或使用。下单前请核对农药登记证号、有效成分、含量、剂型、登记作物、防治对象和安全间隔期，并严格按实物标签使用。'
    },
    film: {
      highlights: ['棉田铺膜', '机具适配', '残膜回收'],
      specs: [['常见材质', '聚乙烯农用地膜'], ['适用场景', '棉田铺膜播种'], ['购买核验', '厚度、幅宽、长度及执行标准']],
      detail: '地膜幅宽和卷长需与播种铺膜机匹配，厚度应符合现行标准和属地要求。使用后应按当地规定及时回收残膜。'
    },
    irrigation: {
      highlights: ['水肥一体化', '压力匹配', '规格可选'],
      specs: [['常见管径', '16mm（以实际商品为准）'], ['适用场景', '棉田滴灌系统'], ['购买核验', '壁厚、滴头间距、流量及工作压力']],
      detail: '滴灌材料需结合水源、水质、地块长度、轮灌分区、过滤精度和工作压力选型。下单前确认接口、管径、壁厚、滴头间距和额定流量。'
    },
    other: {
      highlights: ['平台商户', '规格可选', '支持咨询'],
      specs: [['商品分类', '棉花生产资料'], ['购买核验', '包装、规格、批次及经营资质']],
      detail: '购买前请向商户确认商品规格、批次、库存、配送范围和售后条件。'
    }
  }

  const catalogVisualByName = value => {
    const name = String(value || '')
    const rules = [
      [/塔河2号/, 'catalog-a-1'],
      [/18-18-18/, 'catalog-a-2'],
      [/20-20-20/, 'catalog-a-3'],
      [/吡虫啉/, 'catalog-a-4'],
      [/地膜/, 'catalog-b-1'],
      [/单翼迷宫|滴灌带/, 'catalog-b-2'],
      [/叠片过滤器/, 'catalog-b-3'],
      [/15-5-30/, 'catalog-b-4'],
      [/新陆中61/, 'catalog-c-1'],
      [/尿素/, 'catalog-c-2'],
      [/磷酸二铵/, 'catalog-c-3'],
      [/腐植酸/, 'catalog-c-4'],
      [/诱虫黄板|黄板/, 'catalog-d-1'],
      [/PE滴灌主管|主管/, 'catalog-d-2'],
      [/旁通阀/, 'catalog-d-3']
    ]
    const matched = rules.find(([pattern]) => pattern.test(name))
    return matched ? matched[1] : ''
  }

  async function loadCommerceProducts() {
    try {
      const result = await runtime.requestJson('/api/products')
      const rows = Array.isArray(result.data) ? result.data : []
      if (!rows.length) return
      data.products = rows.map(row => {
        const category = categoryMap(row.category)
        const profile = productCategoryProfiles[category] || productCategoryProfiles.other
        return {
          id: String(row.id),
          name: row.name || '棉田生产资料',
          category,
          categoryName: row.category || '生产资料',
          visual: catalogVisualByName(row.name) || category,
          image: row.image_url || '',
          badge: Number(row.stock) > 0 ? '现货供应' : '到货咨询',
          summary: row.description || row.detail || '具体规格、批次和供货范围请查看详情。',
          highlights: [row.company_name || '平台商户', row.unit ? `按${row.unit}计价` : profile.highlights[0], profile.highlights[1]],
          service: `由${row.company_name || '平台入驻商户'}提供，库存、配送和售后以订单确认为准。`,
          price: Number(row.display_price ?? row.final_price ?? row.price ?? 0),
          originalPrice: Number(row.original_price ?? row.price ?? 0),
          unit: row.unit || '件',
          stock: Number(row.stock || 0),
          sold: Number(row.sold || 0),
          hasPromotion: Boolean(row.has_promotion),
          promotionLabel: row.promotion_label || '',
          promotionName: row.promotion_name || '',
          promotionEndsAt: row.promotion_ends_at || '',
          isFlashSale: Boolean(row.is_flash_sale),
          couponCount: Number(row.coupon_count || 0),
          merchantName: row.company_name || '平台入驻商户',
          merchantId: String(row.merchant_id || ''),
          specs: [
            ['商品分类', row.category || '生产资料'],
            ['计价单位', row.unit || '件'],
            ['库存状态', Number(row.stock) > 0 ? `剩余 ${row.stock}` : '请咨询商户'],
            ['供应商户', row.company_name || '平台入驻商户'],
            ...profile.specs
          ],
          sections: [
            { title: '商品介绍', body: row.detail || row.description || '商品信息由入驻商户发布，购买前请核对包装、规格、批次和适用范围。' },
            { title: '选购要点', body: profile.detail },
            { title: '购买提示', body: '提交订单前请确认收货区域、配送费用、预计送达时间以及售后规则。农资产品应严格按照标签和属地农业技术指导使用。' }
          ]
        }
      })
    } catch (error) {
      console.warn('[commerce-products]', error.message)
    }
  }

  async function loadCommerceMerchants() {
    if (commerceMerchantsCache) return commerceMerchantsCache
    try {
      const result = await runtime.requestJson('/api/commerce/merchants')
      commerceMerchantsCache = Array.isArray(result.data) ? result.data : []
    } catch {
      commerceMerchantsCache = []
    }
    return commerceMerchantsCache
  }

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
    if (item.image) return `<div class="product-photo ${extraClass}"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" loading="lazy"></div>`
    return `<div class="product-visual visual-${escapeHtml(item.visual)} ${extraClass}" role="img" aria-label="${escapeHtml(item.name)}产品示意图"></div>`
  }

  function productCard(item) {
    return `
      <article class="product-card">
        <div class="product-card-media">
          <a class="product-image-link" href="${businessLink(`/products/${item.id}`)}" aria-label="查看${escapeHtml(item.name)}">
            ${productVisual(item)}
          </a>
          ${item.price ? `<button type="button" class="product-card-cart" data-cart-product="${escapeHtml(item.id)}" aria-label="将${escapeHtml(item.name)}加入购物车" title="加入购物车"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2.1 10.1a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L20 7H6.2M9.5 20a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm9 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg></button>` : ''}
        </div>
        <div class="product-card-body">
          <h3><a href="${businessLink(`/products/${item.id}`)}">${escapeHtml(item.name)}</a></h3>
          ${item.price ? `<div class="commerce-price"><strong>¥${Number(item.price).toFixed(2)}</strong><span>/${escapeHtml(item.unit || '件')}</span>${item.originalPrice > item.price ? `<del>¥${Number(item.originalPrice).toFixed(2)}</del>` : ''}</div>` : ''}
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
          ${sectionHeading('CORE BUSINESS', '一条围绕棉田生产的服务链', '从投入品到田间作业，再到订单与服务记录，展示平台提供的核心业务。')}
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

  async function renderCommerceHome() {
    setMeta('首页', '川月智能，提供棉花生产资料、农机作业、商户入驻和本地供需信息服务')
    setActiveNav('home')
    const promotedProducts = data.products
      .filter(item => item.hasPromotion && item.price > 0)
      .sort((left, right) => Number(Boolean(right.isFlashSale)) - Number(Boolean(left.isFlashSale)))
    const campaignProducts = (promotedProducts.length ? promotedProducts : data.products).slice(0, 4)
    const campaignEndsAt = promotedProducts
      .map(item => new Date(item.promotionEndsAt).getTime())
      .filter(value => Number.isFinite(value) && value > Date.now())
      .sort((left, right) => left - right)[0]
    const campaignSlides = promotedProducts.slice(0, 2).map((item, index) => ({
      theme: index % 2 ? 'inputs' : 'promotion',
      kicker: item.isFlashSale ? '限时秒杀' : (item.promotionLabel || '限时优惠'),
      title: item.promotionName || item.name,
      description: `${item.name}，活动价 ¥${Number(item.price).toFixed(2)}${item.originalPrice > item.price ? `，较原价优惠 ¥${(item.originalPrice - item.price).toFixed(2)}` : ''}。活动规则及库存以商品详情和订单确认页为准。`,
      href: businessLink(`/products/${item.id}`),
      action: '查看活动商品'
    }))
    const heroSlides = [
      {
        theme: 'cotton',
        kicker: '川月智能 · 新疆棉区',
        title: '服务棉花生产，连接本地供需',
        description: '棉花种子、肥料、农药、农膜和滴灌材料在线选购，连接农机作业与本地商户。',
        href: businessLink('/products'),
        action: '进入商品中心'
      },
      ...campaignSlides,
      {
        theme: 'machinery',
        kicker: '棉花生产服务',
        title: '从整地播种到采收转运',
        description: '按作业阶段查找农机服务，提交地块、面积和农时需求，与服务方确认档期和价格。',
        href: businessLink('/machinery'),
        action: '查看生产服务'
      },
      ...(campaignSlides.length ? [] : [{
        theme: 'merchant',
        kicker: '商户入驻',
        title: '让本地优质农资更容易被找到',
        description: '提交经营主体和商品资料，审核通过后即可管理商品、订单与促销活动。',
        href: '/portal/register.html?role=merchant',
        action: '申请商户入驻'
      }])
    ]
    let merchants = []
    try {
      const result = await runtime.requestJson('/api/commerce/merchants')
      merchants = (Array.isArray(result.data) ? result.data : []).slice(0, 3)
    } catch {}
    main.innerHTML = `
      <section class="commerce-hero commerce-carousel-hero" id="commerceHero" aria-roledescription="轮播图" aria-label="首页活动">
        <div class="commerce-carousel-track">
          ${heroSlides.map((slide, index) => `
            <article class="commerce-carousel-slide theme-${slide.theme}${index === 0 ? ' active' : ''}" data-carousel-slide aria-hidden="${index === 0 ? 'false' : 'true'}"${index === 0 ? '' : ' inert'}>
              <div class="commerce-hero-shade"></div>
              <div class="shell commerce-hero-inner">
                <div class="commerce-hero-copy">
                  <span class="hero-kicker">${escapeHtml(slide.kicker)}</span>
                  <h1>${escapeHtml(slide.title)}</h1>
                  <p>${escapeHtml(slide.description)}</p>
                  <div class="hero-actions"><a class="button primary" href="${escapeHtml(slide.href)}">${escapeHtml(slide.action)}</a></div>
                </div>
              </div>
            </article>`).join('')}
        </div>
        <div class="shell commerce-carousel-footer">
          <div class="commerce-carousel-controls">
            <button type="button" data-carousel-previous aria-label="上一张">‹</button>
            <div class="commerce-carousel-dots" aria-label="选择活动">${heroSlides.map((_, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-carousel-dot="${index}" aria-label="第${index + 1}张" aria-current="${index === 0 ? 'true' : 'false'}"></button>`).join('')}</div>
            <button type="button" data-carousel-next aria-label="下一张">›</button>
          </div>
        </div>
      </section>

      <section class="section-block simple-core-section">
        <div class="shell">
          ${sectionHeading('CORE BUSINESS', '核心业务', '两大业务板块，服务棉花生产中的商品采购与田间作业。')}
          <div class="simple-core-grid">
            <article><span>01</span><h2>川月商品中心</h2><p>提供棉花种子、肥料、农药、地膜和滴灌材料等生产资料的线上选购服务，商品信息由入驻商户维护。</p><ul><li>分类查找商品</li><li>查看价格与库存</li><li>购物车与在线下单</li></ul><a href="${businessLink('/products')}"><strong>进入商品中心</strong><b aria-hidden="true">→</b></a></article>
            <article><span>02</span><h2>棉花生产服务</h2><p>连接农机作业、本地运输、加工服务和供需信息，帮助用户快速找到对应经营主体。</p><ul><li>农机作业服务</li><li>本地商户名录</li><li>供应与求购信息</li></ul><a href="${businessLink('/machinery')}"><strong>查看生产服务</strong><b aria-hidden="true">→</b></a></article>
          </div>
        </div>
      </section>

      <section class="section-block home-campaign-section">
        <div class="shell">
          ${sectionHeading(promotedProducts.length ? 'LIMITED OFFERS' : 'SELECTED PRODUCTS', promotedProducts.length ? '限时优惠' : '优选商品', promotedProducts.length ? '展示当前生效的真实促销商品。' : '查看平台商户发布的在售商品。', `<a class="section-action" href="${businessLink('/products')}">查看全部商品</a>`)}
          ${campaignEndsAt ? `<div class="campaign-countdown" data-campaign-countdown="${campaignEndsAt}"><span>距离活动结束</span><strong data-countdown-days>00</strong><em>天</em><strong data-countdown-hours>00</strong><em>时</em><strong data-countdown-minutes>00</strong><em>分</em><strong data-countdown-seconds>00</strong><em>秒</em></div>` : ''}
          <div class="product-grid home-campaign-grid">${campaignProducts.map(productCard).join('')}</div>
        </div>
      </section>

      <section class="section-block simple-merchants-section">
        <div class="shell">
          ${sectionHeading('MERCHANT NETWORK', '本地优质商户', '汇集审核通过的农资经营主体与棉花生产服务商。', `<a class="section-action" href="${businessLink('/merchants')}">查看全部商户 <span aria-hidden="true">→</span></a>`)}
          ${merchants.length ? `<div class="simple-merchant-grid">${merchants.map(item => `<article><span>${escapeHtml(item.name.slice(0, 1))}</span><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.category)}</p>${item.phone ? `<a href="tel:${escapeHtml(item.phone)}">${escapeHtml(item.phone)}</a>` : item.wechat ? `<strong>客服微信：${escapeHtml(item.wechat)}</strong>` : '<strong>联系方式由商户补充</strong>'}</article>`).join('')}</div>` : ''}
          <div class="merchant-recruit-panel${merchants.length ? '' : ' merchant-recruit-panel-empty'}">
            <div class="merchant-recruit-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M8 20h32v21H8zM5 10h38l-4 10H9zm9 17h8v14h-8zm14 0h7v7h-7z"/></svg></div>
            <div class="merchant-recruit-copy">
              <span>商户招募</span>
              <h2>欢迎棉花产业相关商户入驻</h2>
              <p>提交经营主体、经营品类和服务资料，审核通过后即可发布商品、管理订单并展示企业信息。</p>
              <div class="merchant-recruit-steps" aria-label="入驻流程"><span><b>01</b>填写资料</span><i aria-hidden="true"></i><span><b>02</b>平台审核</span><i aria-hidden="true"></i><span><b>03</b>发布商品</span></div>
            </div>
            <a class="button primary merchant-recruit-action" href="/portal/register.html?role=merchant">申请商户入驻 <span aria-hidden="true">→</span></a>
          </div>
        </div>
      </section>`

    const hero = document.getElementById('commerceHero')
    const slides = Array.from(hero.querySelectorAll('[data-carousel-slide]'))
    const dots = Array.from(hero.querySelectorAll('[data-carousel-dot]'))
    let activeSlide = 0
    let carouselTimer = null
    const showSlide = value => {
      activeSlide = (value + slides.length) % slides.length
      slides.forEach((slide, index) => {
        const active = index === activeSlide
        slide.classList.toggle('active', active)
        slide.setAttribute('aria-hidden', String(!active))
        slide.inert = !active
      })
      dots.forEach((dot, index) => {
        const active = index === activeSlide
        dot.classList.toggle('active', active)
        dot.setAttribute('aria-current', String(active))
      })
    }
    const stopCarousel = () => {
      clearInterval(carouselTimer)
      carouselTimer = null
    }
    const startCarousel = () => {
      stopCarousel()
      if (slides.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        carouselTimer = setInterval(() => showSlide(activeSlide + 1), 6000)
      }
    }
    hero.querySelector('[data-carousel-previous]').addEventListener('click', () => {
      showSlide(activeSlide - 1)
      startCarousel()
    })
    hero.querySelector('[data-carousel-next]').addEventListener('click', () => {
      showSlide(activeSlide + 1)
      startCarousel()
    })
    dots.forEach(dot => dot.addEventListener('click', () => {
      showSlide(Number(dot.dataset.carouselDot))
      startCarousel()
    }))
    hero.addEventListener('mouseenter', stopCarousel)
    hero.addEventListener('mouseleave', startCarousel)
    hero.addEventListener('focusin', stopCarousel)
    hero.addEventListener('focusout', startCarousel)
    document.addEventListener('visibilitychange', () => document.hidden ? stopCarousel() : startCarousel())
    startCarousel()

    const countdown = document.querySelector('[data-campaign-countdown]')
    if (countdown) {
      const updateCountdown = () => {
        const remaining = Math.max(0, Number(countdown.dataset.campaignCountdown) - Date.now())
        const seconds = Math.floor(remaining / 1000)
        countdown.querySelector('[data-countdown-days]').textContent = String(Math.floor(seconds / 86400)).padStart(2, '0')
        countdown.querySelector('[data-countdown-hours]').textContent = String(Math.floor(seconds % 86400 / 3600)).padStart(2, '0')
        countdown.querySelector('[data-countdown-minutes]').textContent = String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')
        countdown.querySelector('[data-countdown-seconds]').textContent = String(seconds % 60).padStart(2, '0')
        if (!remaining) countdown.classList.add('ended')
      }
      updateCountdown()
      const countdownTimer = setInterval(updateCountdown, 1000)
      window.addEventListener('pagehide', () => clearInterval(countdownTimer), { once: true })
    }
  }

  async function renderGlobalSearch() {
    const query = (new URLSearchParams(location.search).get('q') || '').trim()
    setMeta(query ? `搜索：${query}` : '全站搜索', '同时查找川月智能平台的商品与入驻商家')
    setActiveNav('')
    const merchants = await loadCommerceMerchants()
    const needle = query.toLowerCase()
    const products = query ? data.products.filter(item => `${item.name} ${item.categoryName} ${item.summary} ${item.merchantName} ${item.highlights.join(' ')}`.toLowerCase().includes(needle)) : []
    const matchedMerchants = query ? merchants.filter(item => `${item.name} ${item.category} ${item.location} ${item.intro}`.toLowerCase().includes(needle)) : []
    main.innerHTML = `
      ${pageHero('SITE SEARCH', '全站搜索', query ? `“${query}”的商品与商家搜索结果` : '输入关键词查找商品和入驻商家。', 'search-results-hero')}
      <section class="section-block global-search-results"><div class="shell">
        ${query ? `
          <div class="search-result-summary"><strong>共找到 ${products.length + matchedMerchants.length} 条结果</strong><span>${products.length} 件商品 · ${matchedMerchants.length} 家商户</span></div>
          <section class="search-result-group">
            ${sectionHeading('PRODUCTS', '商品', '', `<a class="section-action" href="${businessLink('/products')}?q=${encodeURIComponent(query)}">在商品中心查看</a>`)}
            ${products.length ? `<div class="product-grid">${products.slice(0, 8).map(productCard).join('')}</div>` : '<div class="empty-state compact"><h2>没有找到相关商品</h2><p>可以尝试搜索品类、用途或商家名称。</p></div>'}
          </section>
          <section class="search-result-group">
            ${sectionHeading('MERCHANTS', '商家')}
            ${matchedMerchants.length ? `<div class="merchant-directory">${matchedMerchants.map(item => `<article><span class="merchant-avatar">${escapeHtml(item.name.slice(0, 1))}</span><div><small>${escapeHtml(item.category)}</small><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.intro)}</p><dl><div><dt>所在地区</dt><dd>${escapeHtml(item.location)}</dd></div><div><dt>在售商品</dt><dd>${item.productCount} 项</dd></div></dl><div class="merchant-contact"><span>${item.phone ? `电话：${escapeHtml(item.phone)}` : '联系方式由商家补充'}</span><a href="${businessLink('/products')}?merchant=${item.id}">查看商品 →</a></div></div></article>`).join('')}</div>` : '<div class="empty-state compact"><h2>没有找到相关商家</h2><p>可以尝试搜索主营品类或所在地区。</p></div>'}
          </section>` : `
          <div class="search-start-panel"><span>搜索范围</span><h2>商品与商家</h2><p>可输入商品名称、品类、用途、商家名称或所在地区。</p><div class="search-start-hot">${['棉花种子', '滴灌带', '复合肥', '地膜', '植保无人机'].map(item => `<a href="${businessLink('/search')}?q=${encodeURIComponent(item)}">${item}</a>`).join('')}</div></div>`}
      </div></section>`
  }

  function renderProducts() {
    setMeta('商品中心', '浏览平台商户发布的棉花种子、肥料、植保、农膜和滴灌材料')
    setActiveNav('products')

    const params = new URLSearchParams(location.search)
    const initialCategory = params.get('category') || 'all'
    const initialQuery = params.get('q') || ''
    const initialMerchant = params.get('merchant') || ''

    main.innerHTML = `
      ${pageHero('PRODUCT CENTER', '商品中心', '在售商品由平台商户发布，支持按品类和关键词查找。购买前请核对规格、库存、配送和售后信息。', 'products-hero')}
      <section class="section-block">
        <div class="shell">
          <div class="catalog-toolbar">
            <div class="filter-tabs" id="productFilters">
              ${data.productCategories.map(item => `<button type="button" class="${item.id === initialCategory ? 'active' : ''}" data-category="${item.id}">${escapeHtml(item.name)}</button>`).join('')}
            </div>
            <label class="catalog-search"><span>搜索商品</span><input id="productSearch" type="search" value="${escapeHtml(initialQuery)}" placeholder="输入商品名称、用途或商户"></label>
          </div>
          <div class="catalog-count" id="catalogCount">共 ${data.products.length} 件商品</div>
          <div class="product-grid" id="productGrid">${data.products.map(productCard).join('')}</div>
          <div class="empty-state hidden" id="productEmpty"><h2>没有找到匹配品类</h2><p>请更换分类或搜索关键词。</p></div>
        </div>
      </section>
      <section class="notice-band">
        <div class="shell"><strong>交易与使用提示</strong><p>本页商品支持在线选购、加入购物车和提交订单，价格、库存、规格及配送信息以订单确认页为准。下单前请核对商品标签、登记信息、执行标准和批次；农药、肥料应遵循产品标签及属地技术指导使用。</p></div>
      </section>`

    let category = data.productCategories.some(item => item.id === initialCategory) ? initialCategory : 'all'
    let query = initialQuery
    const grid = document.getElementById('productGrid')
    const empty = document.getElementById('productEmpty')
    const count = document.getElementById('catalogCount')

    const update = () => {
      const filtered = data.products.filter(item => {
        const matchesCategory = category === 'all' || item.category === category
        const haystack = `${item.name}${item.categoryName}${item.summary}${item.highlights.join('')}`.toLowerCase()
        const matchesMerchant = !initialMerchant || item.merchantId === initialMerchant
        return matchesCategory && matchesMerchant && haystack.includes(query.toLowerCase())
      })
      grid.innerHTML = filtered.map(productCard).join('')
      grid.classList.toggle('hidden', filtered.length === 0)
      empty.classList.toggle('hidden', filtered.length !== 0)
      count.textContent = `共 ${filtered.length} 件商品`
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
    update()
  }

  function renderProductDetail(item) {
    if (!item) return renderNotFound()
    setMeta(item.name, item.summary)
    setActiveNav('products')

    const related = data.products.filter(product => product.id !== item.id && product.category === item.category)
    const fallbackRelated = related
      .concat(data.products.filter(product => product.id !== item.id && product.category !== item.category))
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
            ${item.price ? `<div class="commerce-detail-price"><span class="price-label">商品价</span><strong>¥${Number(item.price).toFixed(2)}</strong><span>/${escapeHtml(item.unit || '件')}</span><small>已售 ${Number(item.sold || 0)}</small></div>` : ''}
            <div class="consult-box">
              <span>商品与交易</span>
              <strong>选择数量后可加入购物车或立即购买</strong>
              <p>${escapeHtml(item.service)}</p>
            </div>
            ${item.price ? `<div class="purchase-quantity"><span>购买数量</span><div class="quantity-stepper"><button type="button" data-quantity-change="-1" aria-label="减少数量">−</button><input id="productQuantity" type="number" min="1" max="${Math.max(1, Number(item.stock || 999))}" value="1" inputmode="numeric" aria-label="购买数量"><button type="button" data-quantity-change="1" aria-label="增加数量">＋</button></div><small>${Number(item.stock || 0) > 0 ? `库存 ${Number(item.stock)} ${escapeHtml(item.unit || '件')}` : '库存请向商户确认'}</small></div>` : ''}
            <div class="detail-actions product-purchase-actions">
              ${item.price ? `<button class="button outline" type="button" data-favorite-product="${escapeHtml(item.id)}">收藏商品</button><button class="button cart-button" type="button" data-cart-product="${escapeHtml(item.id)}" data-quantity-source="productQuantity">加入购物车</button><button class="button primary" type="button" data-buy-product="${escapeHtml(item.id)}" data-quantity-source="productQuantity">立即购买</button>` : `<a class="button primary" href="${link(`/contact?product=${item.id}`)}">咨询此品类</a>`}
              <a class="button outline" href="${link('/products')}">返回产品列表</a>
            </div>
          </div>
        </div>
      </section>
      <section class="section-block detail-content-section">
        <div class="shell detail-content-grid">
          <article class="rich-article">
            ${item.sections.map(section => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p></section>`).join('')}
            <aside class="safety-note"><strong>购买提示</strong><p>商品信息由入驻商户发布。下单前请核对真实包装、标签、登记信息、执行标准、批次、配送范围和售后约定；农资使用应遵循产品标签与属地农业技术指导。</p></aside>
          </article>
          <aside class="spec-panel">
            <h2>商品参数</h2>
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
      ${pageHero('NEWS & INSIGHTS', '新闻资讯', '整理棉花产业、质量标准、市场供需和加工动态，内容保留原始来源。', 'news-hero')}
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
    setMeta('关于我们', '了解川月智能并联系我们')
    setActiveNav('about')
    main.innerHTML = `
      ${pageHero('ABOUT US', '关于我们', '了解川月智能，与我们建立联系。', 'about-hero')}

      <section class="section-block simple-about-company" id="company">
        <div class="shell simple-about-company-inner">
          <div><span class="eyebrow">COMPANY PROFILE</span><h2>公司简介</h2></div>
          <div><p>川月智能是一家面向农业产业提供数字化服务的企业，围绕新疆棉花生产与流通场景，建设连接棉农、商户和农机服务方的线上平台。</p><p>平台聚焦农资商品、农机服务、商户入驻和本地供需，为用户提供清晰的商品与服务信息入口，帮助经营主体展示真实业务能力，提升信息查询、需求沟通和服务协同效率。</p></div>
        </div>
      </section>

      <section class="section-block simple-about-contact" id="contact">
        <div class="shell">
          ${sectionHeading('CONTACT US', '联系我们', '欢迎通过以下方式与川月智能取得联系。')}
          <div class="simple-contact-grid">
            <article><span>址</span><small>公司地址</small><strong>陆家嘴环路958号<br>华能联合大厦3403A</strong></article>
            <article><span>电</span><small>咨询电话</small><strong><a href="tel:02166286003">021-66286003</a></strong></article>
            <article><span>邮</span><small>电子邮箱</small><strong><a href="mailto:lijiale@cyaia.cn">lijiale@cyaia.cn</a></strong></article>
          </div>
        </div>
      </section>

      <section class="section-block simple-about-message">
        <div class="shell simple-message-layout">
          <div><span class="eyebrow">ONLINE MESSAGE</span><h2>在线留言</h2><p>请填写您的联系方式和需求，我们会根据留言内容安排工作人员与您沟通。</p><div class="simple-message-note"><strong>联系信息</strong><span>021-66286003</span><span>lijiale@cyaia.cn</span></div></div>
          <form class="contact-form" id="aboutMessageForm">
            <div class="form-grid">
              <label><span>您的姓名 *</span><input name="name" maxlength="30" autocomplete="name" required></label>
              <label><span>联系电话 *</span><input name="phone" inputmode="tel" maxlength="20" autocomplete="tel" required></label>
              <label><span>电子邮箱</span><input name="email" type="email" maxlength="120" autocomplete="email"></label>
              <label><span>留言类型 *</span><select name="type" required><option value="">请选择</option><option>产品资料</option><option>供货服务</option><option>农机服务</option><option>渠道合作</option><option>公司合作</option><option>其他商务需求</option></select></label>
              <label class="full"><span>留言内容 *</span><textarea name="message" maxlength="1200" required placeholder="请简要说明您的需求或问题"></textarea></label>
            </div>
            <button class="button primary" type="submit">提交留言</button>
            <p id="aboutMessageStatus" role="status" aria-live="polite"></p>
          </form>
        </div>
      </section>`

    document.getElementById('aboutMessageForm').addEventListener('submit', async event => {
      event.preventDefault()
      const form = event.currentTarget
      const values = Object.fromEntries(new FormData(form).entries())
      const button = form.querySelector('button[type="submit"]')
      const status = document.getElementById('aboutMessageStatus')
      button.disabled = true
      status.textContent = '正在提交...'
      try {
        const result = await publicServiceRequest('/business-inquiries', {
          name: values.name,
          phone: values.phone,
          type: values.type,
          region: '',
          message: `${values.email ? `邮箱：${values.email}｜` : ''}${values.message}`,
          referenceType: 'online_message',
          referenceId: '',
          referenceName: '关于我们在线留言',
          sourcePath: location.pathname
        })
        status.textContent = result.msg || '留言已提交。'
        form.reset()
      } catch (error) {
        status.textContent = error.message
      } finally { button.disabled = false }
    })
  }

  function renderContact() {
    setMeta('商务联系', '联系川月智能商务团队，提交农资、农机、渠道或合作需求')
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
              <div><dt>服务覆盖</dt><dd>${escapeHtml(data.company.serviceCoverage)}</dd></div>
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
      ${pageHero('PRIVACY & ACCOUNT DATA', '个人信息使用说明', '说明川月智能在账号、交易和服务需求中如何使用信息，并提供可追踪的处理申请入口。', 'privacy-hero')}
      <section class="section-block">
        <div class="shell privacy-layout">
          <article class="privacy-content">
            <section><span class="eyebrow">SCOPE</span><h2>我们处理哪些信息</h2><p>注册和登录时使用手机号、密码哈希、姓名或称呼及可选地区信息；使用购物、收藏、本地商圈和商务联系功能时，记录用户主动提交的商品、订单、收货、服务需求和联系方式。</p></section>
            <section><span class="eyebrow">PURPOSE</span><h2>信息用于什么目的</h2><p>信息仅用于账号识别、提供商品与服务、处理订单和售后、回复商务需求、保障账号安全及履行必要的运营审计。浏览公开商品和商户信息无需登录。</p></section>
            <section><span class="eyebrow">THIRD-PARTY SERVICES</span><h2>必要的外部服务</h2><p>登录、支付、物流和对象存储可能由对应服务商处理完成。平台只传递完成相关功能所必需的数据，请勿在公开供需信息中填写身份证号、银行卡号等敏感信息。</p></section>
            <section><span class="eyebrow">STORAGE</span><h2>保存与安全</h2><p>账号、订单和服务记录保存在平台数据库；业务图片和必要凭证保存在受控文件卷或对象存储。平台通过访问控制、上传限制、登录保护、日志和备份措施降低信息安全风险。</p></section>
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
              <a class="button primary full" href="${businessLink('/login')}?next=%2Fbusiness%2Fprivacy">登录川月智能账号</a>`}
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

  async function renderMerchants() {
    setMeta('入驻商户', '查看平台审核通过的入驻商户、经营品类和联系方式')
    setActiveNav('merchants')
    main.innerHTML = `${pageHero('VERIFIED MERCHANTS', '入驻商户', '集中展示审核通过的经营主体、主营品类、服务区域和公开联系方式。', 'merchant-hero')}<section class="section-block"><div class="shell"><div class="loading-panel">正在加载商户信息...</div></div></section>`
    try {
      const result = await runtime.requestJson('/api/commerce/merchants')
      const rows = Array.isArray(result.data) ? result.data : []
      main.innerHTML = `
        ${pageHero('VERIFIED MERCHANTS', '入驻商户', '集中展示审核通过的经营主体、主营品类、服务区域和公开联系方式。', 'merchant-hero')}
        <section class="section-block"><div class="shell">
          <div class="merchant-page-head"><p>共 ${rows.length} 家审核通过的商户</p><a class="button primary" href="/portal/register.html?role=merchant">申请商户入驻</a></div>
          ${rows.length ? `<div class="merchant-directory">${rows.map(item => `<article><span class="merchant-avatar">${escapeHtml(item.name.slice(0, 1))}</span><div><small>${escapeHtml(item.category)}</small><h2>${escapeHtml(item.name)}</h2><p>${escapeHtml(item.intro)}</p><dl><div><dt>所在地区</dt><dd>${escapeHtml(item.location)}</dd></div><div><dt>在售商品</dt><dd>${item.productCount} 项</dd></div></dl><div class="merchant-contact">${item.phone ? `<a href="tel:${escapeHtml(item.phone)}">电话：${escapeHtml(item.phone)}</a>` : item.wechat ? `<span>客服微信：${escapeHtml(item.wechat)}</span>` : '<span>联系方式由商户补充</span>'}<a href="${businessLink('/products')}?merchant=${item.id}">查看商品 →</a></div></div></article>`).join('')}</div>` : '<div class="empty-state"><h2>暂无公开商户</h2><p>商户审核通过后将在这里展示。</p></div>'}
        </div></section>`
    } catch (error) {
      main.querySelector('.loading-panel').textContent = error.message
    }
  }

  async function renderLocalMarket() {
    setMeta('本地商圈', '浏览和发布棉花生产相关的本地供应、求购、农机、运输与加工信息')
    setActiveNav('local')
    let rows = []
    try {
      const result = await runtime.requestJson('/api/commerce/listings')
      rows = Array.isArray(result.data) ? result.data : []
    } catch {}
    const loggedIn = Boolean(localStorage.getItem('knowledge_token'))
    main.innerHTML = `
      ${pageHero('LOCAL MARKET', '本地商圈', '汇集棉花生产相关的供应、求购、农机、运输和加工信息，公开展示发布人与联系方式。', 'local-hero')}
      <section class="section-block"><div class="shell local-market-layout">
        <div><div class="market-toolbar"><strong>${rows.length} 条公开信息</strong><span>请自行核实主体身份、商品质量和履约条件</span></div>
          ${rows.length ? `<div class="market-list">${rows.map(item => `<article><span class="market-type">${escapeHtml(item.listing_type)}</span><div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.content)}</p><div class="market-meta"><span>${escapeHtml(item.region || '新疆喀什地区')}</span><span>${escapeHtml(item.contact_name || '发布人')}</span><a href="tel:${escapeHtml(item.contact_phone)}">${escapeHtml(item.contact_phone)}</a></div></div></article>`).join('')}</div>` : '<div class="empty-state"><h2>暂无已发布信息</h2><p>新信息审核通过后将在这里展示。</p></div>'}
        </div>
        <aside class="market-publish-card"><span class="eyebrow">PUBLISH</span><h2>发布供需信息</h2><p>提交后由平台审核。姓名、电话和信息内容将在审核通过后公开展示。</p>
          ${loggedIn ? `<form id="marketPublishForm"><label><span>信息类型</span><select name="type" required><option>供应</option><option>求购</option><option>农机服务</option><option>运输服务</option><option>加工服务</option></select></label><label><span>标题</span><input name="title" minlength="4" maxlength="120" required></label><label><span>详细信息</span><textarea name="content" minlength="10" maxlength="1500" required></textarea></label><label><span>所在地区</span><input name="region" maxlength="120" required></label><label><span>联系人</span><input name="contactName" maxlength="64" required></label><label><span>联系电话</span><input name="contactPhone" inputmode="numeric" maxlength="11" required></label><label class="consent"><input type="checkbox" required><span>我确认有权公开上述联系方式，并同意平台审核展示</span></label><button class="button primary full" type="submit">提交审核</button><p id="marketPublishMessage" role="status"></p></form>` : `<a class="button primary full" href="${businessLink('/login')}?next=${encodeURIComponent(location.pathname)}">登录后发布</a><a class="button outline full" href="${businessLink('/login')}?mode=register&next=${encodeURIComponent(location.pathname)}">注册个人账号</a>`}
        </aside>
      </div></section>`
    const form = document.getElementById('marketPublishForm')
    if (form) form.addEventListener('submit', async event => {
      event.preventDefault()
      const button = form.querySelector('button[type="submit"]')
      const message = document.getElementById('marketPublishMessage')
      button.disabled = true
      message.textContent = '正在提交...'
      try {
        const values = Object.fromEntries(new FormData(form).entries())
        const result = await runtime.requestJson('/api/commerce/listings', { method: 'POST', body: JSON.stringify(values) }, { token: localStorage.getItem('knowledge_token') })
        message.textContent = result.msg
        form.reset()
      } catch (error) {
        message.textContent = error.message
      } finally { button.disabled = false }
    })
  }

  function renderCommerceActivities() {
    setMeta('平台活动', '查看平台活动、优惠信息和参与规则')
    setActiveNav('activities')
    main.innerHTML = `
      ${pageHero('PROMOTIONS', '平台活动', '活动信息分为平台公告与优惠活动，适用商品、有效期和使用条件以页面规则为准。', 'activity-hero')}
      <section class="section-block"><div class="shell">
        <div class="activity-tabs"><button class="active">平台活动</button><button>平台公告</button></div>
        <div class="commerce-activity-grid"><article><span>新用户专享</span><h2>完成注册，开始使用平台服务</h2><p>注册后可以发布本地供需信息、保存收藏并使用个人服务入口。</p><a class="button primary" href="${businessLink('/login')}?mode=register&next=${encodeURIComponent(businessLink('/'))}">立即注册</a></article><article><span>商户招募</span><h2>棉花产业相关商户入驻</h2><p>提交经营主体、经营品类与服务资料，审核通过后可管理商品和订单。</p><a class="button outline" href="/portal/register.html?role=merchant">申请入驻</a></article></div>
        <aside class="rule-notice"><strong>活动规则说明</strong><p>平台不会展示虚构折扣、销量或优惠券。实际优惠活动发布后，页面将明确活动主体、有效期、适用范围、数量限制和退款规则。</p></aside>
      </div></section>`
  }

  function renderCart() {
    setMeta('购物车', '查看已加入购物车的商品')
    setActiveNav('cart')
    const cart = readLocalList(cartKey)
    const items = cart.map(entry => ({ entry, product: productById(String(entry.id)) })).filter(item => item.product)
    const total = items.reduce((sum, item) => sum + Number(item.product.price || 0) * Number(item.entry.qty || 1), 0)
    main.innerHTML = `${pageHero('SHOPPING CART', '购物车', '确认商品、数量与金额后进入订单确认。', 'cart-hero')}<section class="section-block"><div class="shell cart-layout"><div>${items.length ? `<div class="cart-list">${items.map(({ entry, product }) => `<article>${productVisual(product)}<div><small>${escapeHtml(product.categoryName)}</small><h2><a href="${businessLink(`/products/${product.id}`)}">${escapeHtml(product.name)}</a></h2><p>${escapeHtml(product.merchantName || '')}</p></div><strong>¥${Number(product.price || 0).toFixed(2)}</strong><div class="cart-qty">数量 ${Number(entry.qty || 1)}</div><button type="button" data-remove-cart="${escapeHtml(product.id)}">删除</button></article>`).join('')}</div>` : '<div class="empty-state"><h2>购物车还是空的</h2><p>浏览商品后，可以把需要的商品加入购物车。</p><a class="button primary" href="/business/products">去选购商品</a></div>'}</div><aside class="cart-summary"><span>商品合计</span><strong>¥${total.toFixed(2)}</strong><p>配送费用和可用优惠将在确认订单时计算。</p><button class="button primary full" type="button" ${items.length ? '' : 'disabled'} data-checkout>确认订单</button></aside></div></section>`
  }

  function renderFavorites() {
    setMeta('我的收藏', '查看收藏的商品')
    setActiveNav('favorites')
    const ids = readLocalList(favoriteKey).map(String)
    const items = data.products.filter(item => ids.includes(String(item.id)))
    main.innerHTML = `${pageHero('FAVORITES', '我的收藏', '收藏保存在当前浏览器中，登录后的跨设备同步将在后续版本开放。', 'favorites-hero')}<section class="section-block"><div class="shell">${items.length ? `<div class="product-grid">${items.map(productCard).join('')}</div>` : '<div class="empty-state"><h2>暂无收藏商品</h2><p>在商品卡片或详情页点击“收藏”即可保存。</p><a class="button primary" href="/business/products">浏览商品</a></div>'}</div></section>`
  }

  function renderCommerceLogin() {
    const params = new URLSearchParams(location.search)
    const requestedNext = params.get('next') || ''
    const next = requestedNext.startsWith('/business/') ? requestedNext : businessLink('/account')
    let mode = params.get('mode') === 'register' ? 'register' : 'login'

    if (localStorage.getItem('knowledge_token')) {
      location.replace(next)
      return
    }

    setMeta('登录注册', '登录或注册川月智能账号，使用购物、订单和本地供需服务')
    setActiveNav('')
    main.innerHTML = `
      ${pageHero('CHUANYUE ACCOUNT', '川月智能账号', '登录后可管理购物车、订单、收藏和本地供需信息。', 'login-hero')}
      <section class="section-block">
        <div class="shell public-auth-layout">
          <div class="public-auth-context">
            <span class="eyebrow">ONE ACCOUNT</span>
            <h2>连接商品与生产服务</h2>
            <p>个人用户与商家使用同一注册入口。个人账号注册后即可使用；商家提交主体资料后，由管理员审核开通。</p>
            <div><strong>无需登录</strong><span>浏览商品、农机服务、入驻商户和公开供需信息</span></div>
            <div><strong>注册后</strong><span>个人可管理订单与购物车，审核通过的商家可发布和管理商品</span></div>
          </div>
          <div class="public-auth-card">
            <div class="public-auth-tabs"><button type="button" data-auth-mode="login">登录</button><button type="button" data-auth-mode="register">注册</button></div>
            <form id="commerceLoginForm">
              <label><span>手机号</span><input name="phone" inputmode="numeric" maxlength="11" autocomplete="tel" required></label>
              <label><span>登录密码</span><input name="password" type="password" maxlength="20" autocomplete="current-password" required></label>
              <button class="button primary full" type="submit">登录</button>
              <p class="auth-message" id="commerceLoginMessage" role="status"></p>
            </form>
            <div class="auth-registration hidden" id="commerceRegistration">
              <div class="register-kind-tabs" role="tablist" aria-label="选择注册类型">
                <button type="button" class="active" data-register-kind="personal">个人注册</button>
                <button type="button" data-register-kind="merchant">商家注册</button>
              </div>
              <form id="commercePersonalRegisterForm">
                <div class="auth-form-grid">
                  <label><span>手机号 *</span><input name="phone" inputmode="numeric" maxlength="11" autocomplete="tel" placeholder="请输入11位手机号" required></label>
                  <label><span>邮箱 *</span><input name="email" type="email" maxlength="254" autocomplete="email" placeholder="用于账号联系与找回" required></label>
                  <label><span>姓名或称呼 *</span><input name="real_name" maxlength="30" autocomplete="name" required></label>
                  <label><span>所在地区</span><input name="location" maxlength="128" placeholder="未填写时默认为喀什地区莎车县"></label>
                  <label><span>设置密码 *</span><input name="password" type="password" minlength="6" maxlength="20" autocomplete="new-password" required></label>
                  <label><span>确认密码 *</span><input name="password_confirm" type="password" minlength="6" maxlength="20" autocomplete="new-password" required></label>
                  <label class="auth-captcha-field"><span>图形验证码 *</span><span class="auth-captcha-control"><input name="captcha_code" maxlength="4" autocomplete="off" placeholder="输入验证码" required><img data-captcha-image alt="图形验证码"><button type="button" data-refresh-captcha>换一张</button></span><input name="captcha_id" type="hidden"></label>
                </div>
                <label class="consent auth-consent"><input name="privacy_consent" type="checkbox" required><span>我已阅读并同意 <a href="${businessLink('/help/privacy')}" target="_blank" rel="noopener noreferrer">隐私政策</a> 与 <a href="${businessLink('/help/terms')}" target="_blank" rel="noopener noreferrer">服务条款</a></span></label>
                <button class="button primary full" type="submit">个人注册并登录</button>
                <p class="auth-message" id="commercePersonalRegisterMessage" role="status"></p>
              </form>
              <form class="hidden" id="commerceMerchantRegisterForm">
                <div class="auth-form-grid merchant-register-grid">
                  <label><span>商家主体类型 *</span><select name="company_type" required><option value="enterprise">企业</option><option value="individual">个体工商户</option><option value="cooperative">农民专业合作社</option></select></label>
                  <label><span>店铺或企业名称 *</span><input name="company_name" maxlength="128" autocomplete="organization" required></label>
                  <label><span>营业执照号 *</span><input name="business_license" maxlength="18" placeholder="统一社会信用代码" required></label>
                  <label><span>经营品类 *</span><input name="product_category" maxlength="64" placeholder="例如：种子、化肥、农药" required></label>
                  <label><span>联系人姓名 *</span><input name="real_name" maxlength="32" autocomplete="name" required></label>
                  <label><span>联系人手机号 *</span><input name="phone" inputmode="numeric" maxlength="11" autocomplete="tel" required></label>
                  <label><span>联系人邮箱 *</span><input name="email" type="email" maxlength="254" autocomplete="email" required></label>
                  <label class="auth-field-full"><span>经营或注册地址 *</span><input name="registered_address" maxlength="255" autocomplete="street-address" placeholder="请填写省、市/地区、县及详细地址" required></label>
                  <label><span>设置密码 *</span><input name="password" type="password" minlength="6" maxlength="20" autocomplete="new-password" required></label>
                  <label><span>确认密码 *</span><input name="password_confirm" type="password" minlength="6" maxlength="20" autocomplete="new-password" required></label>
                  <label class="auth-captcha-field"><span>图形验证码 *</span><span class="auth-captcha-control"><input name="captcha_code" maxlength="4" autocomplete="off" placeholder="输入验证码" required><img data-captcha-image alt="图形验证码"><button type="button" data-refresh-captcha>换一张</button></span><input name="captcha_id" type="hidden"></label>
                </div>
                <p class="merchant-register-note">提交后账号进入审核状态；审核通过后方可登录商家后台并发布商品。</p>
                <label class="consent auth-consent"><input name="privacy_consent" type="checkbox" required><span>我已阅读并同意 <a href="${businessLink('/help/privacy')}" target="_blank" rel="noopener noreferrer">隐私政策</a> 与 <a href="${businessLink('/help/terms')}" target="_blank" rel="noopener noreferrer">服务条款</a></span></label>
                <button class="button primary full" type="submit">提交商家注册申请</button>
                <p class="auth-message" id="commerceMerchantRegisterMessage" role="status"></p>
              </form>
            </div>
            <a class="public-auth-back" href="${escapeHtml(next)}">暂不登录，返回电商页面</a>
          </div>
        </div>
      </section>`

    const switchMode = value => {
      mode = value
      document.getElementById('commerceLoginForm').classList.toggle('hidden', mode !== 'login')
      document.getElementById('commerceRegistration').classList.toggle('hidden', mode !== 'register')
      document.querySelectorAll('[data-auth-mode]').forEach(button => button.classList.toggle('active', button.dataset.authMode === mode))
      if (mode === 'register') {
        const activeForm = document.querySelector('[data-register-kind].active').dataset.registerKind === 'merchant'
          ? document.getElementById('commerceMerchantRegisterForm')
          : document.getElementById('commercePersonalRegisterForm')
        if (!activeForm.elements.captcha_id.value) loadCaptcha(activeForm)
      }
    }
    document.querySelector('.public-auth-tabs').addEventListener('click', event => {
      const button = event.target.closest('[data-auth-mode]')
      if (button) switchMode(button.dataset.authMode)
    })
    const saveSession = (payload, phone) => {
      localStorage.setItem('knowledge_token', payload.token)
      localStorage.setItem('knowledge_user', JSON.stringify({ ...payload, phone }))
    }

    const loadCaptcha = async form => {
      const image = form.querySelector('[data-captcha-image]')
      const idInput = form.elements.captcha_id
      image.removeAttribute('src')
      image.alt = '验证码加载中'
      try {
        const result = await runtime.requestJson('/api/community-auth/captcha')
        idInput.value = result.data.id
        image.src = result.data.image
        image.alt = '图形验证码，点击换一张可刷新'
        form.elements.captcha_code.value = ''
      } catch (error) {
        idInput.value = ''
        image.alt = '验证码加载失败'
      }
    }

    document.querySelectorAll('[data-refresh-captcha]').forEach(button => {
      button.addEventListener('click', () => loadCaptcha(button.closest('form')))
    })

    document.querySelector('.register-kind-tabs').addEventListener('click', event => {
      const button = event.target.closest('[data-register-kind]')
      if (!button) return
      const merchant = button.dataset.registerKind === 'merchant'
      document.querySelectorAll('[data-register-kind]').forEach(item => item.classList.toggle('active', item === button))
      document.getElementById('commercePersonalRegisterForm').classList.toggle('hidden', merchant)
      document.getElementById('commerceMerchantRegisterForm').classList.toggle('hidden', !merchant)
      const form = merchant ? document.getElementById('commerceMerchantRegisterForm') : document.getElementById('commercePersonalRegisterForm')
      if (!form.elements.captcha_id.value) loadCaptcha(form)
    })

    document.getElementById('commerceLoginForm').addEventListener('submit', async event => {
      event.preventDefault()
      const form = event.currentTarget
      const values = Object.fromEntries(new FormData(form).entries())
      const message = document.getElementById('commerceLoginMessage')
      const button = form.querySelector('button[type="submit"]')
      message.textContent = '正在登录...'
      button.disabled = true
      try {
        const result = await runtime.requestJson('/api/community-auth/login', { method: 'POST', body: JSON.stringify(values) })
        saveSession(result.data || {}, values.phone)
        location.href = next
      } catch (error) {
        message.textContent = error.message
        button.disabled = false
      }
    })

    document.getElementById('commercePersonalRegisterForm').addEventListener('submit', async event => {
      event.preventDefault()
      const form = event.currentTarget
      const values = Object.fromEntries(new FormData(form).entries())
      const message = document.getElementById('commercePersonalRegisterMessage')
      if (values.password !== values.password_confirm) {
        message.textContent = '两次输入的密码不一致'
        return
      }
      const button = form.querySelector('button[type="submit"]')
      message.textContent = '正在注册...'
      button.disabled = true
      try {
        const result = await runtime.requestJson('/api/community-auth/register', {
          method: 'POST',
          body: JSON.stringify({
            phone: values.phone,
            email: values.email,
            password: values.password,
            real_name: values.real_name,
            location: values.location,
            captcha_id: values.captcha_id,
            captcha_code: values.captcha_code,
            privacy_consent: values.privacy_consent === 'on'
          })
        })
        saveSession(result.data || {}, values.phone)
        location.href = next
      } catch (error) {
        message.textContent = error.message
        button.disabled = false
        loadCaptcha(form)
      }
    })

    document.getElementById('commerceMerchantRegisterForm').addEventListener('submit', async event => {
      event.preventDefault()
      const form = event.currentTarget
      const values = Object.fromEntries(new FormData(form).entries())
      const message = document.getElementById('commerceMerchantRegisterMessage')
      if (values.password !== values.password_confirm) {
        message.textContent = '两次输入的密码不一致'
        return
      }
      const button = form.querySelector('button[type="submit"]')
      message.textContent = '正在提交商家注册申请...'
      button.disabled = true
      try {
        const result = await runtime.requestJson('/api/community-auth/register/merchant', {
          method: 'POST',
          body: JSON.stringify({ ...values, privacy_consent: values.privacy_consent === 'on' })
        })
        message.textContent = result.msg || '商家注册申请已提交，请等待审核'
        form.reset()
        loadCaptcha(form)
      } catch (error) {
        message.textContent = error.message
        button.disabled = false
        loadCaptcha(form)
      }
    })
    switchMode(mode)
  }

  function renderAccount() {
    const account = (() => { try { return JSON.parse(localStorage.getItem('knowledge_user') || 'null') } catch { return null } })()
    if (!account) {
      location.replace(`${businessLink('/login')}?next=${encodeURIComponent(location.pathname)}`)
      return
    }
    setMeta('个人中心', '管理个人账号与常用服务')
    setActiveNav('account')
    const displayName = account.real_name || account.nickname || '平台用户'
    const phone = String(account.phone || '')
    const maskedPhone = /^1\d{10}$/.test(phone) ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone
    main.innerHTML = `
      ${pageHero('MY ACCOUNT', '个人中心', '查看订单、收藏和购物车。', 'account-hero')}
      <section class="section-block business-account-section">
        <div class="shell business-account-dashboard">
          <div class="business-account-card">
            <div class="business-account-identity">
              <span class="business-account-avatar">${escapeHtml(displayName.slice(0, 1))}</span>
              <div><small>当前账号</small><h2>${escapeHtml(displayName)}</h2>${maskedPhone ? `<p>${escapeHtml(maskedPhone)}</p>` : ''}</div>
            </div>
            <button class="business-account-logout" id="logoutBusinessAccount" type="button">退出登录</button>
          </div>
          <nav class="business-account-links" aria-label="个人服务">
            <a href="${businessLink('/orders')}"><strong>我的订单</strong><span aria-hidden="true">→</span></a>
            <a href="${businessLink('/favorites')}"><strong>我的收藏</strong><span aria-hidden="true">→</span></a>
            <a href="${businessLink('/cart')}"><strong>购物车</strong><span aria-hidden="true">→</span></a>
          </nav>
        </div>
      </section>`

    document.getElementById('logoutBusinessAccount').addEventListener('click', () => {
      if (!confirm('确定退出当前账号？')) return
      localStorage.removeItem('knowledge_token')
      localStorage.removeItem('knowledge_user')
      location.replace(businessLink('/login'))
    })
  }

  async function renderOrders() {
    const token = localStorage.getItem('knowledge_token') || ''
    if (!token) {
      location.replace(`${businessLink('/login')}?next=${encodeURIComponent(location.pathname)}`)
      return
    }
    setMeta('我的订单', '查询商品订单及履约状态')
    setActiveNav('orders')
    main.innerHTML = `${pageHero('MY ORDERS', '我的订单', '查看商品订单、支付、配送和售后状态。', 'orders-hero')}<section class="section-block"><div class="shell"><div class="loading-panel">正在加载订单...</div></div></section>`
    try {
      const result = await runtime.requestJson('/api/orders/my', {}, { token })
      const rows = Array.isArray(result.data) ? result.data : (result.data?.orders || [])
      const statusNames = { pending: '待处理', paid: '已支付', shipped: '配送中', completed: '已完成', cancelled: '已取消' }
      main.innerHTML = `${pageHero('MY ORDERS', '我的订单', '查看商品订单、支付、配送和售后状态。', 'orders-hero')}<section class="section-block"><div class="shell">${rows.length ? `<div class="order-list">${rows.map(order => `<article><div><small>订单号</small><strong>${escapeHtml(order.order_no || order.orderNo || order.id)}</strong></div><div><small>下单时间</small><span>${escapeHtml(order.created_at || order.createdAt || '')}</span></div><div><small>订单金额</small><strong>¥${Number(order.total_amount || order.totalAmount || 0).toFixed(2)}</strong></div><span class="order-status">${escapeHtml(statusNames[order.status] || order.status || '处理中')}</span></article>`).join('')}</div>` : '<div class="empty-state"><h2>暂无商品订单</h2><p>完成商品选购后，订单会显示在这里。</p><a class="button primary" href="/business/products">浏览商品</a></div>'}</div></section>`
    } catch (error) {
      main.querySelector('.loading-panel').textContent = error.message
    }
  }

  function renderHelp(forcedSection = '') {
    const legacyMap = { ordering: 'faq', delivery: 'faq', payment: 'faq', aftersale: 'service', agreement: 'terms' }
    const requested = forcedSection || pathParts[1] || new URLSearchParams(location.search).get('section') || 'faq'
    const active = ['privacy', 'terms', 'faq', 'service'].includes(requested) ? requested : (legacyMap[requested] || 'faq')
    const titles = { privacy: '隐私政策', terms: '服务条款', faq: '常见问题', service: '售后服务' }
    const navigation = Object.entries(titles).map(([id, title]) => `<a class="${id === active ? 'active' : ''}" href="${businessLink(`/help/${id}`)}"><span>${escapeHtml(title)}</span><b aria-hidden="true">→</b></a>`).join('')
    const updatedAt = '2026年9月4日'

    const privacy = `
      <header class="help-document-head"><span>PRIVACY POLICY</span><h1>隐私政策</h1><p>更新日期：${updatedAt} · 生效日期：${updatedAt}</p></header>
      <div class="help-document-body">
        <p>川月智能重视您的个人信息和隐私安全。本政策说明我们在提供商品浏览、账号、订单、本地供需及客户服务时，如何处理您主动提交或因使用服务产生的信息。</p>
        <section><h2>一、我们收集的信息</h2><p>可能包括手机号、邮箱、姓名或称呼、所在地区、登录与安全记录，以及您在下单、收货、售后、商务咨询或发布本地供需信息时主动填写的内容。商家申请注册时，还会处理企业或店铺名称、主体类型、营业执照号、经营品类、联系人和经营地址等审核所需信息。使用特定功能时，我们只收集完成该功能所必需的信息。</p></section>
        <section><h2>二、信息使用目的</h2><p>用于创建和维护账号、展示商品与商户、处理订单和售后、联系服务需求、保障交易与账号安全、履行法律义务以及改进平台服务。未经另行同意，不会将信息用于与上述目的无关的用途。</p></section>
        <section><h2>三、信息共享与委托处理</h2><p>为完成支付、配送、对象存储或技术运维，必要信息可能提供给对应服务商或订单相关经营主体。我们不会出售个人信息，并会要求接收方仅在约定目的和必要范围内处理。</p></section>
        <section><h2>四、信息保存与安全</h2><p>我们在实现业务目的和法律要求所需的期限内保存信息，并采取 HTTPS 传输、访问控制、登录保护、日志审计和备份等措施。互联网服务无法保证绝对安全，如发生可能影响您权益的安全事件，我们将依法处理。</p></section>
        <section><h2>五、您的权利</h2><p>您可以申请查阅、更正、复制或删除个人信息，也可以申请注销账号或撤回已作出的授权。与未完成交易、退款、争议或法定留存义务有关的信息，可能需要在相应事项结束后再删除或匿名化。</p></section>
        <section><h2>六、未成年人保护</h2><p>本平台主要面向农业生产经营相关成年人。未成年人应在监护人指导和同意下使用服务，不应独立进行商品交易或提交敏感个人信息。</p></section>
        <section><h2>七、政策更新与联系我们</h2><p>政策发生重要变化时，我们会通过页面更新或适当方式提示。需要行使个人信息权利或反馈疑问，可通过“联系我们”页面提交申请，我们会在核验身份后处理。</p></section>
      </div>`

    const terms = `
      <header class="help-document-head"><span>TERMS OF SERVICE</span><h1>服务条款</h1><p>更新日期：${updatedAt} · 使用平台前请仔细阅读</p></header>
      <div class="help-document-body">
        <p>欢迎使用川月智能。本条款适用于网站提供的商品浏览、购物车、在线下单、订单履约、农机服务、本地供需、商户入驻及相关客户服务。</p>
        <section><h2>一、服务范围</h2><p>平台为棉农、商户和农机手提供商品浏览、购物车、在线下单、订单查询、售后申请以及农业生产服务。具体商品或服务由页面标明的经营主体提供，实际规格、成交价格、库存、配送范围和履约时间以订单确认页及交易约定为准。</p></section>
        <section><h2>二、账号注册与安全</h2><p>用户应提供真实、准确、完整的信息并妥善保管账号凭证。不得转让账号、冒用他人身份、批量注册或利用账号实施违法活动。发现异常使用时，应及时联系平台。</p></section>
        <section><h2>三、商品、订单与支付</h2><p>下单前应核对商品标签、规格、数量、收货信息、配送费用及售后条件。订单是否成立、价格调整、缺货处理和支付方式以确认页面及经营主体反馈为准。请勿绕过合规渠道向不明个人账户付款。</p></section>
        <section><h2>四、商户与服务方责任</h2><p>商户和服务方应依法取得经营所需资质，保证发布信息真实，并对商品质量、服务履约和售后承担相应责任。平台依法进行信息审核与协同处理，但不代替经营主体作出超出法律或明确约定的承诺。</p></section>
        <section><h2>五、用户发布内容</h2><p>发布供需或评价信息时，不得包含虚假、违法、侵权、骚扰或泄露他人隐私的内容。为展示和审核该信息，用户授权平台在服务范围内存储、展示和处理其提交内容。</p></section>
        <section><h2>六、服务变更与中断</h2><p>因维护升级、网络故障、不可抗力或监管要求，部分服务可能调整或暂时中断。我们会在合理范围内提前提示或尽快恢复，并依法处理已成立订单和用户权益。</p></section>
        <section><h2>七、知识产权与责任边界</h2><p>网站设计、程序及平台制作内容受法律保护。未经许可不得批量复制、抓取或用于不正当竞争。因用户提供错误信息、违规操作或第三方原因造成的影响，由责任方依法承担；法律另有规定的除外。</p></section>
        <section><h2>八、争议处理</h2><p>发生争议时，用户可先联系订单经营主体或平台协商，也可依法向消费者组织、监管部门投诉，或通过诉讼等法定途径解决。</p></section>
      </div>`

    const faqItems = [
      ['商品与订单', '如何查找需要的农资商品？', '进入商品中心后，可按种子、肥料、农药、地膜和滴灌材料筛选，也可以输入商品名称、用途或商户名称搜索。'],
      ['商品与订单', '页面价格和库存是否一定有效？', '商品信息由入驻商户维护。农忙期库存、配送和价格可能变化，提交订单前请再次核对确认页和商户反馈。'],
      ['商品与订单', '如何查看订单进度？', '登录后进入“个人中心—我的订单”，可查看订单状态。需要修改收货或处理异常时，请尽早联系订单商户或平台。'],
      ['账号相关', '不登录可以浏览吗？', '可以。公开商品、农机服务、商户和供需信息无需登录；下单、查看个人订单或发布供需信息时需要登录。'],
      ['账号相关', '忘记密码或账号异常怎么办？', '请通过“联系我们”提交手机号和问题说明。为保护账号安全，工作人员核验身份后再协助处理。'],
      ['生产服务', '农机服务如何确定价格和档期？', '页面展示服务类型，不代表某台设备实时在岗。需根据地块位置、面积、道路、天气、机型和作业日期，由农机手进一步确认。'],
      ['本地商圈', '公开发布联系方式安全吗？', '供需信息审核通过后，联系人和电话会公开展示。请只填写业务联系信息，不要提交身份证号、银行卡号等敏感信息。'],
      ['售后相关', '收到破损、错发或疑似质量问题商品怎么办？', '请暂停使用并保留外包装、标签、批次、物流单和现场照片，在订单入口或售后页面及时提交申请。']
    ]
    const faq = `<header class="help-document-head"><span>FREQUENTLY ASKED QUESTIONS</span><h1>常见问题</h1><p>快速了解账号、购物、生产服务和售后处理</p></header><div class="faq-list">${faqItems.map((item, index) => `<section class="faq-item ${index === 0 ? 'open' : ''}"><button type="button" aria-expanded="${index === 0}"><span><small>${escapeHtml(item[0])}</small><strong>${escapeHtml(item[1])}</strong></span><b aria-hidden="true">＋</b></button><div><p>${escapeHtml(item[2])}</p></div></section>`).join('')}</div><div class="help-contact-strip"><div><strong>仍然没有找到答案？</strong><p>提交您的问题和联系方式，工作人员会根据业务类型跟进。</p></div><a class="button primary" href="${businessLink('/contact')}">联系我们</a></div>`

    const service = `
      <header class="help-document-head"><span>AFTER-SALES SERVICE</span><h1>售后服务</h1><p>保留凭证、及时申请，让问题处理更清楚</p></header>
      <div class="service-assurance-grid"><article><b>01</b><h2>商品售后</h2><p>处理缺货、错发、运输破损、质量异议及符合规则的退换货申请。</p></article><article><b>02</b><h2>服务售后</h2><p>处理农机作业、配送或其他生产服务中的履约异常和沟通争议。</p></article></div>
      <section class="service-rule-card"><h2>申请前请准备</h2><ul><li>订单号、商品或服务名称</li><li>外包装、标签、生产批次和物流凭证</li><li>能够说明问题的照片、视频或作业记录</li><li>问题经过、发现时间和希望的处理方式</li></ul><p>农资商品是否支持无理由退货，应根据商品性质、包装状态、页面约定和法律规定判断；已拆封、已使用、影响安全或二次销售的商品，处理方式可能不同。</p></section>
      <section class="service-process"><h2>售后处理流程</h2><ol><li><span>1</span><div><strong>提交申请</strong><p>在订单入口或本页填写问题及凭证。</p></div></li><li><span>2</span><div><strong>核验信息</strong><p>平台或经营主体核对订单、批次和责任情况。</p></div></li><li><span>3</span><div><strong>协商方案</strong><p>根据实际情况确认补发、退换、退款、返工或其他方案。</p></div></li><li><span>4</span><div><strong>完成处理</strong><p>履行约定方案并保留处理记录。</p></div></li></ol></section>
      <section class="service-apply-card"><div><span class="eyebrow">SERVICE REQUEST</span><h2>提交售后申请</h2><p>请准确填写联系方式和问题描述。提交后可由平台管理员查看并安排跟进。</p></div><form id="afterSalesForm"><label><span>姓名或称呼 *</span><input name="name" maxlength="30" required></label><label><span>联系电话 *</span><input name="phone" inputmode="tel" maxlength="20" required></label><label><span>订单号</span><input name="orderNo" maxlength="64" placeholder="没有订单号可留空"></label><label><span>售后类型 *</span><select name="serviceType" required><option value="">请选择</option><option>商品售后</option><option>农机服务售后</option><option>配送问题</option><option>其他问题</option></select></label><label class="full"><span>问题描述 *</span><textarea name="message" maxlength="1200" required placeholder="请说明商品或服务、问题经过、发现时间和希望的处理方式"></textarea></label><button class="button primary" type="submit">提交售后申请</button><p id="afterSalesMessage" role="status"></p></form></section>`

    const content = { privacy, terms, faq, service }[active]
    setMeta(`${titles[active]} - 帮助中心`, `川月智能${titles[active]}`)
    setActiveNav('help')
    main.innerHTML = `${pageHero('HELP CENTER', '帮助中心', '查看隐私政策、服务条款、常见问题和售后服务说明。', 'help-hero')}<section class="section-block help-center-section"><div class="shell help-center-layout"><aside class="help-center-nav"><span>HELP CENTER</span><h2>帮助中心</h2><nav>${navigation}</nav><div><strong>需要人工协助？</strong><a href="${businessLink('/contact')}">联系商务团队 →</a></div></aside><article class="help-center-content">${content}</article></div></section>`

    document.querySelectorAll('.faq-item > button').forEach(button => button.addEventListener('click', () => {
      const item = button.closest('.faq-item')
      const open = item.classList.toggle('open')
      button.setAttribute('aria-expanded', String(open))
    }))

    const form = document.getElementById('afterSalesForm')
    if (form) form.addEventListener('submit', async event => {
      event.preventDefault()
      const values = Object.fromEntries(new FormData(form).entries())
      const button = form.querySelector('button[type="submit"]')
      const message = document.getElementById('afterSalesMessage')
      button.disabled = true
      message.textContent = '正在提交...'
      try {
        const result = await publicServiceRequest('/business-inquiries', {
          name: values.name,
          phone: values.phone,
          type: '售后服务',
          region: '',
          message: `${values.serviceType}${values.orderNo ? `｜订单号：${values.orderNo}` : ''}｜${values.message}`,
          referenceType: 'after_sales',
          referenceId: values.orderNo || '',
          referenceName: values.serviceType,
          sourcePath: location.pathname
        })
        message.textContent = result.msg || '售后申请已提交。'
        form.reset()
      } catch (error) {
        message.textContent = error.message
      } finally { button.disabled = false }
    })
  }

  function installCommerceActions() {
    const selectedQuantity = button => {
      const input = button.dataset.quantitySource ? document.getElementById(button.dataset.quantitySource) : null
      const min = Number(input?.min || 1)
      const max = Number(input?.max || 999)
      const quantity = Math.min(max, Math.max(min, Number(input?.value || 1)))
      if (input) input.value = String(quantity)
      return quantity
    }
    document.addEventListener('click', event => {
      const quantityButton = event.target.closest('[data-quantity-change]')
      if (quantityButton) {
        const input = document.getElementById('productQuantity')
        if (!input) return
        const min = Number(input.min || 1)
        const max = Number(input.max || 999)
        const next = Math.min(max, Math.max(min, Number(input.value || min) + Number(quantityButton.dataset.quantityChange)))
        input.value = String(next)
        return
      }
      const cartButton = event.target.closest('[data-cart-product]')
      if (cartButton) {
        if (!localStorage.getItem('knowledge_token')) {
          runtime.notify('请先登录后再加入购物车', 'info')
          const next = `${location.pathname}${location.search}`
          location.href = `${businessLink('/login')}?next=${encodeURIComponent(next)}`
          return
        }
        const id = String(cartButton.dataset.cartProduct)
        const quantity = selectedQuantity(cartButton)
        const cart = readLocalList(cartKey)
        const existing = cart.find(item => String(item.id) === id)
        if (existing) existing.qty = Number(existing.qty || 1) + quantity
        else cart.push({ id, qty: quantity })
        writeLocalList(cartKey, cart)
        const cartCount = document.getElementById('headerCartCount')
        if (cartCount) cartCount.textContent = String(cart.reduce((sum, item) => sum + Number(item.qty || 1), 0))
        runtime.notify(`已将 ${quantity} 件商品加入购物车`, 'success')
        return
      }
      const buyButton = event.target.closest('[data-buy-product]')
      if (buyButton) {
        if (!localStorage.getItem('knowledge_token')) {
          runtime.notify('请先登录后再购买商品', 'info')
          const next = `${location.pathname}${location.search}`
          location.href = `${businessLink('/login')}?next=${encodeURIComponent(next)}`
          return
        }
        const id = String(buyButton.dataset.buyProduct)
        const quantity = selectedQuantity(buyButton)
        const cart = readLocalList(cartKey)
        const existing = cart.find(item => String(item.id) === id)
        if (existing) existing.qty = Math.max(Number(existing.qty || 1), quantity)
        else cart.push({ id, qty: quantity })
        writeLocalList(cartKey, cart)
        location.href = `${businessLink('/cart')}?buyNow=${encodeURIComponent(id)}`
        return
      }
      const favoriteButton = event.target.closest('[data-favorite-product]')
      if (favoriteButton) {
        const id = String(favoriteButton.dataset.favoriteProduct)
        const favorites = readLocalList(favoriteKey).map(String)
        const next = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id]
        writeLocalList(favoriteKey, next)
        runtime.notify(favorites.includes(id) ? '已取消收藏' : '已收藏商品', 'success')
        return
      }
      const removeButton = event.target.closest('[data-remove-cart]')
      if (removeButton) {
        writeLocalList(cartKey, readLocalList(cartKey).filter(item => String(item.id) !== String(removeButton.dataset.removeCart)))
        renderCart()
        return
      }
      if (event.target.closest('[data-checkout]')) runtime.notify('请在小程序中完成收货地址确认和安全支付', 'info', 4600)
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
    const footerPhone = document.getElementById('footerPhone')
    const footerEmail = document.getElementById('footerEmail')
    const footerRegisteredAddress = document.getElementById('footerRegisteredAddress')
    const footerAddress = document.getElementById('footerAddress')
    if (footerPhone) footerPhone.textContent = data.company.phone || '在线商务联系'
    if (footerEmail) footerEmail.textContent = data.company.email || ''
    if (footerRegisteredAddress) footerRegisteredAddress.textContent = data.company.registeredAddress || ''
    if (footerAddress) footerAddress.textContent = `服务区域：${data.company.serviceCoverage}`

    const brand = document.getElementById('siteBrand')
    const brandName = document.getElementById('brandName')
    const brandSub = document.getElementById('brandSub')
    const serviceLabel = document.getElementById('serviceLabel')
    const action = document.getElementById('headerAction')
    const commerceTools = document.getElementById('businessCommerceTools')
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
      brand.setAttribute('aria-label', '川月智能首页')
      brandName.textContent = '川月智能'
      brandSub.textContent = 'CHUANYUE INTELLIGENCE'
      serviceLabel.textContent = '服务新疆棉农、商户和农机手'
      nav.innerHTML = `
        <a href="${businessLink('/')}" data-nav="home">首页</a>
        <a href="${businessLink('/products')}" data-nav="products">商品中心</a>
        <a href="${businessLink('/machinery')}" data-nav="machinery">生产服务</a>
        <a href="${businessLink('/merchants')}" data-nav="merchants">入驻商户</a>
        <a href="${businessLink('/local')}" data-nav="local">本地商圈</a>
        <a href="${businessLink('/about')}" data-nav="about">关于我们</a>`
      let account = null
      try { account = JSON.parse(localStorage.getItem('knowledge_user') || 'null') } catch {}
      action.href = account ? businessLink('/account') : `${businessLink('/login')}?next=${encodeURIComponent(location.pathname)}`
      action.textContent = account ? (account.real_name || '个人中心') : '登录 / 注册'
      const loggedIn = Boolean(localStorage.getItem('knowledge_token'))
      const protectedLink = path => loggedIn ? businessLink(path) : `${businessLink('/login')}?next=${encodeURIComponent(businessLink(path))}`
      const icon = name => ({
        cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h2l2 10h11l2-7H6M9 20h.01M18 20h.01"/></svg>',
        user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>',
        order: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10l2 3v15H5V6l2-3Z"/><path d="M8 10h8M8 14h8"/></svg>',
        favorite: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 20-1.4-1.3C5.4 14 2 10.9 2 7.1A4.6 4.6 0 0 1 6.7 2.5c2.1 0 4.1 1 5.3 2.6a6.7 6.7 0 0 1 5.3-2.6A4.6 4.6 0 0 1 22 7.1c0 3.8-3.4 6.9-8.6 11.6L12 20Z"/></svg>'
      })[name]
      commerceTools.hidden = false
      commerceTools.innerHTML = `
        <div class="header-search-area">
          <div class="header-search-combo">
            <details class="all-category-menu">
              <summary>全部分类 <span class="category-chevron" aria-hidden="true"></span></summary>
              <div class="all-category-panel">
                <a href="${businessLink('/products')}"><b>农</b><span><strong>农资</strong><small>种子、肥料、农药</small></span></a>
                <a href="${businessLink('/machinery')}"><b>机</b><span><strong>农机</strong><small>田间作业服务</small></span></a>
                <a href="${businessLink('/products')}?category=pesticide"><b>防</b><span><strong>病虫害</strong><small>植保防治用品</small></span></a>
                <a href="${businessLink('/products')}?category=film"><b>耗</b><span><strong>耗材</strong><small>农膜、滴灌材料</small></span></a>
              </div>
            </details>
            <form class="header-global-search" id="headerGlobalSearchForm" role="search">
              <label><span class="sr-only">搜索商品和商家</span><input id="headerGlobalSearchInput" type="search" value="${escapeHtml(pageGroup === 'search' ? (new URLSearchParams(location.search).get('q') || '') : '')}" placeholder="搜索商品、商家" autocomplete="off"></label>
              <button type="submit" aria-label="搜索"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16.5 16.5 4 4"/></svg><span class="sr-only">搜索</span></button>
            </form>
          </div>
          <div class="header-hot-searches"><span>热门：</span>${['棉花种子', '滴灌带', '复合肥', '地膜'].map(item => `<a href="${businessLink('/search')}?q=${encodeURIComponent(item)}">${item}</a>`).join('')}</div>
        </div>
        <nav class="header-quick-links" aria-label="快捷导航">
          <a href="${businessLink('/')}">首页</a>
          <a href="${businessLink('/products')}">商品中心</a>
          <a href="${businessLink('/machinery')}">生产服务</a>
          <a href="${businessLink('/merchants')}">入驻商户</a>
          <a href="${businessLink('/about')}">关于我们</a>
        </nav>
        <nav class="header-account-links" aria-label="购物与账户">
          <a class="header-icon-link" href="${businessLink('/cart')}" aria-label="购物车" title="购物车">${icon('cart')}<em id="headerCartCount">${readLocalList(cartKey).reduce((sum, item) => sum + Number(item.qty || 1), 0)}</em></a>
          <details class="header-account-menu">
            <summary aria-label="我的账户" title="我的账户">${icon('user')}</summary>
            <div>
              <a href="${protectedLink('/account')}">${icon('user')}<span>个人中心</span></a>
              <a href="${protectedLink('/orders')}">${icon('order')}<span>我的订单</span></a>
              <a href="${businessLink('/favorites')}">${icon('favorite')}<span>我的收藏</span></a>
              <a href="${loggedIn ? businessLink('/account') : `${businessLink('/login')}?next=${encodeURIComponent(location.pathname)}`}"><span>${loggedIn ? '账户设置' : '登录 / 注册'}</span></a>
            </div>
          </details>
        </nav>`
      document.getElementById('headerGlobalSearchForm').addEventListener('submit', event => {
        event.preventDefault()
        const query = document.getElementById('headerGlobalSearchInput').value.trim()
        location.href = `${businessLink('/search')}${query ? `?q=${encodeURIComponent(query)}` : ''}`
      })
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
  installCommerceActions()

  const startPage = async () => {
  if (platform === 'business') await loadCommerceProducts()
  if (platform === 'public' && pageGroup === 'home') renderPublicHome()
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
  else if (platform === 'business' && pageGroup === 'home') renderCommerceHome()
  else if (platform === 'business' && pageGroup === 'search') renderGlobalSearch()
  else if (platform === 'business' && pageGroup === 'products' && pathParts.length === 1) renderProducts()
  else if (platform === 'business' && pageGroup === 'products') renderProductDetail(productById(pathParts[1]))
  else if (platform === 'business' && pageGroup === 'machinery' && pathParts.length === 1) renderMachinery()
  else if (platform === 'business' && pageGroup === 'machinery') renderMachineryDetail(machineryById(pathParts[1]))
  else if (platform === 'business' && pageGroup === 'news' && pathParts.length === 1) renderNews()
  else if (platform === 'business' && pageGroup === 'news') renderNewsDetail(newsById(pathParts[1]))
  else if (platform === 'business' && pageGroup === 'merchants') renderMerchants()
  else if (platform === 'business' && pageGroup === 'local') renderLocalMarket()
  else if (platform === 'business' && pageGroup === 'activities') renderCommerceActivities()
  else if (platform === 'business' && pageGroup === 'cart') renderCart()
  else if (platform === 'business' && pageGroup === 'favorites') renderFavorites()
  else if (platform === 'business' && pageGroup === 'login') renderCommerceLogin()
  else if (platform === 'business' && pageGroup === 'account') renderAccount()
  else if (platform === 'business' && pageGroup === 'orders') renderOrders()
  else if (platform === 'business' && pageGroup === 'help') renderHelp()
  else if (platform === 'business' && pageGroup === 'privacy') renderHelp('privacy')
  else if (platform === 'business' && pageGroup === 'about') renderAbout()
  else if (platform === 'business' && pageGroup === 'contact') renderContact()
  else renderNotFound()
  }
  startPage()
})()
