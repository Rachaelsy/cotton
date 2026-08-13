require('dotenv').config({ path: require('path').join(__dirname, '../.env') })

const db = require('./database')

// These records are concise reading guides based on authoritative public pages.
// The full text remains on the issuer's website and is linked by original_url.
// Existing rows are never overwritten so edits made in the admin console are kept.
const articles = [
  {
    title: '2026—2028年新疆棉花目标价格政策要点',
    type: 'policy', section: '国家', issuer: '国家发展和改革委员会、财政部',
    region: '新疆维吾尔自治区', documentNo: '发改价格〔2026〕733号', publishedAt: '2026-05-25 09:00:00',
    url: 'https://www.ndrc.gov.cn/xwdt/tzgg/202605/t20260525_1405461_ext.html', featured: 1, sortOrder: -100,
    markdown: `# 政策要点

国家发展改革委、财政部明确，2026—2028年继续在新疆实施棉花目标价格政策。

## 核心信息

- 2026—2028年新疆棉花目标价格为每吨 **18600元**；如市场形势发生重大变化，按程序及时调整。
- 对新疆棉花以固定产量 **510万吨** 进行补贴。
- 引导棉花生产向优势区域集中，并结合地下水超采等情况优化生产布局。
- 完善优质棉补贴机制、补贴领取机制和质量认定标准，保障补贴资金发放到棉农手中。

## 棉农需要关注

目标价格不等于市场收购价。实际补贴的对象、申报、面积核验、交售凭证和兑付安排，仍需以自治区及所在地县市后续实施细则和通知为准。种植户应妥善保存土地、种植面积、籽棉交售和结算票据等材料。

> 本文为官方文件的便民摘要，不替代原文。办理前请点击“政府原文”核对最新口径。`
  },
  {
    title: '新疆棉花目标价格补贴与质量挂钩政策（2024—2025年）解读',
    type: 'policy', section: '自治区', issuer: '新疆维吾尔自治区市场监督管理局等部门',
    region: '新疆维吾尔自治区', documentNo: '', publishedAt: '2024-09-20 09:00:00',
    url: 'https://scjgj.xinjiang.gov.cn/xjaic/zdwjhb/202409/3e70fe30af8743788ff1269e3b9cb9d0.shtml', featured: 1, sortOrder: -90,
    markdown: `# 为什么实行质量挂钩

政策通过质量追溯和质量评价，引导种植、采收、加工各环节共同提高新疆棉花品质。符合条件的实际种植者，在目标价格补贴基础上按规定参与质量补贴。

## 种植和采收注意事项

- 同一追溯地块原则上使用单一品种，按优质高产标准化要求组织生产。
- 使用符合国家标准的农用薄膜，并做好残膜回收。
- 采收环节应重视机采棉卷和质量追溯标识，避免异性纤维、杂质和混等混级。
- 选择参与政策且具备相应条件的加工企业交售，并留存交售凭证。

## 办理提醒

参加范围、加工企业名单、追溯设备、质量评价结果和补贴兑付，以当地年度公告为准。不要仅凭口头承诺决定交售企业。

> 本文是政策阅读提示，具体权利义务以自治区文件和县市执行通知为准。`
  },
  {
    title: '新疆2025年乡村全面振兴实施方案中的棉花政策',
    type: 'policy', section: '自治区', issuer: '新疆维吾尔自治区党委、自治区人民政府',
    region: '新疆维吾尔自治区', documentNo: '', publishedAt: '2025-03-03 09:00:00',
    url: 'https://www.kashi.gov.cn/ksdqxzgs/c112183/202511/03312aedddfb4b019ed41fca6ddbafdc.shtml', featured: 0, sortOrder: -80,
    markdown: `# 与棉花生产直接相关的部署

自治区提出巩固棉花产业优势地位，坚持优化布局、提升单产和品质，推动生产进一步向优势产区集中。

## 重点方向

- 棉花总产保持稳定，实施棉花全过程质量提升行动。
- 推进高标准农田、水肥一体化和精准调控技术应用。
- 加强农业气象灾害和农作物病虫害监测预警，推进统防统治。
- 加快突破性品种培育与推广，推动棉花生产提质增效。
- 围绕棉花和纺织服装产业集群，推动加工、设备更新和产业链延伸。

## 对生产经营主体的启示

规划类文件明确的是发展方向，具体项目的申报对象、补助标准和时间由各主管部门另行发布。农户、合作社和企业可重点关注所在地农业农村、发展改革、财政等部门的专项通知。

> 请结合发布日期阅读，并以主管部门最新申报公告为准。`
  },
  {
    title: '喀什地区优质棉主产区与产业布局规划',
    type: 'policy', section: '地区', issuer: '喀什地区行政公署',
    region: '喀什地区', documentNo: '', publishedAt: '2023-01-12 09:00:00',
    url: 'https://www.kashi.gov.cn/ksdqxzgs/c106719/202301/8659cd4c3d2845a4bd113728ffab6980.shtml', featured: 0, sortOrder: -70,
    markdown: `# 棉花产业布局

喀什地区相关规划提出优化棉花产业布局，引导退出风险棉区、压缩次宜棉区、巩固宜棉区并支持发展优势棉区。

## 重点主产区

规划明确以 **疏勒、伽师、岳普湖、麦盖提、莎车、巴楚** 等县为主要优质棉产区，重点发展优势高产棉区和优质棉花基地。

## 生产能力建设方向

- 以高标准农田建设为基础，推进良地、良种、良法、良机配套。
- 提高机采水平和高效节水灌溉覆盖率。
- 推动生产全程机械化、投入品施用精准化和田间管理智能化。
- 完善加工、农业社会化服务和农产品产销衔接体系。

> 该内容用于了解地区中长期产业方向，年度种植安排和项目申报以最新文件为准。`
  },
  {
    title: '喀什地区2024—2026年农机购置与应用补贴办理提示',
    type: 'policy', section: '地区', issuer: '喀什地区农业农村局、财政局',
    region: '喀什地区', documentNo: '', publishedAt: '2024-10-15 09:00:00',
    url: 'https://www.kashi.gov.cn/ksdqxzgs/c112190/202410/17b422460b8e438eb333458080d17829.shtml', featured: 1, sortOrder: -60,
    markdown: `# 政策用途

喀什地区印发2024—2026年农机购置与应用补贴实施方案，支持农民和农业生产经营组织购置使用先进适用农业机械。

## 申办前先核对

1. 购机主体是否符合当地补贴对象规定。
2. 拟购机具是否在当年补贴机具种类范围和产品投档信息中。
3. 机具发票、出厂编号、铭牌、人机合影等材料是否真实完整。
4. 是否需要牌证管理、现场核验或完成规定作业量。

## 风险提醒

- 补贴资格、补贴额和办理进度以补贴申请办理服务系统及县市主管部门审核为准。
- 不要相信“包办补贴”“先收费后返款”等承诺。
- 发现产品质量或违规办理问题，可通过官方公布的投诉渠道反映。

> 详细机具范围、补贴额一览表及办理程序请查看政府原文和所在地县市公告。`
  },
  {
    title: '巴楚县棉花目标价格补贴超单产数据核查提醒',
    type: 'policy', section: '县级', issuer: '巴楚县人民政府',
    region: '巴楚县', documentNo: '', publishedAt: '2025-07-18 09:00:00',
    url: 'https://www.bachu.gov.cn/bcx/c107073/202507/37088fb49a5b4c6c81aa1ae95d8b18ce.shtml', featured: 0, sortOrder: -50,
    markdown: `# 核查事项

巴楚县依据自治区关于棉花目标价格补贴超单产数据核查的工作要求，对超过预警上限的种植及籽棉交售信息开展逐级核验。

## 核查流程要点

- 乡镇人民政府对相关信息逐村、逐条审核。
- 对真实、合理的高产原因进行核定并按要求公示。
- 公示无异议后报农业农村部门复核。
- 补贴认定以真实种植、真实交售及完整凭证为基础。

## 棉农应准备

建议保留土地承包或经营材料、种植面积信息、品种及投入记录、采收和交售结算凭证。收到核查通知时，应通过村、乡镇或县主管部门的正式渠道提交材料，谨防非官方人员索要账号、验证码或费用。

> 本文依据政府公开会议内容整理，具体名单、公示期和办理要求以巴楚县正式通知为准。`
  },
  {
    title: '莎车县棉花良种推广与种子权益保护提示',
    type: 'policy', section: '县级', issuer: '莎车县人民政府',
    region: '莎车县', documentNo: '', publishedAt: '2026-05-08 09:00:00',
    url: 'https://www.shache.gov.cn/scx/c109062/202605/c0cfb545d4294a75a495ab2a75e8b947.shtml', featured: 0, sortOrder: -40,
    markdown: `# 政策背景

新修订的《新疆维吾尔自治区实施〈中华人民共和国种子法〉办法》自2026年5月1日起施行，为品种创新、合法生产经营和种植者权益保护提供制度依据。

## 对棉农的实际意义

- 选购棉种时应核对经营资质、品种审定或登记信息、标签和使用说明。
- 保存购种发票、包装袋和标签，发生质量争议时便于追溯。
- 结合土壤盐碱程度、积温、生育期和机采模式选择适宜品种，不单纯追求宣传产量。
- 良种必须与规范播种、水肥管理和病虫害防控配套，不能替代田间管理。

莎车县正在开展耐盐碱高产棉花品种示范推广。具体主推品种、供种单位和技术规程，应以县农业农村部门当年发布的信息为准。

> 本文为政策应用提示，不构成具体品种推荐或质量担保。`
  },
  {
    title: '喀什棉花产业链加快向纺纱和精深加工延伸',
    type: 'industry', section: '产业', issuer: '喀什地区行政公署（信息来源：新疆日报）',
    region: '喀什地区', documentNo: '', publishedAt: '2026-01-06 09:00:00',
    url: 'https://www.kashi.gov.cn/ksdqxzgs/c106692/202601/e091889785084701bfaec41b1e623289.shtml', featured: 1, sortOrder: -100,
    markdown: `# 产业动态

喀什棉花产业科技示范区的100万锭纺纱项目竣工投产，产业链从种植、轧花继续向纺纱、检测和配套服务延伸。

## 公开信息要点

- 项目建设内容包括生产厂房、原料堆场、综合动力站、检测中心和物料仓库等。
- 项目投产有助于提高本地棉花转化能力，带动上下游产业协同发展。
- 喀什是新疆重要产棉区，正在构建更完整的纺织服装产业链体系。

## 对种植端的影响

加工能力提升不等于所有棉花都能获得同样溢价。品种一致性、纤维品质、含杂率、回潮率、采收清洁度和质量追溯仍是影响收购与加工适配的重要因素。种植户应以当地质量标准和加工企业公开收购规则为准。

> 本文为产业信息摘要，不构成采购、销售或投资建议。`
  },
  {
    title: '2026年喀什春耕农机投入与补贴信息',
    type: 'industry', section: '农机', issuer: '喀什地区农业农村局',
    region: '喀什地区', documentNo: '', publishedAt: '2026-03-17 09:00:00',
    url: 'https://www.kashi.gov.cn/ksdqxzgs/c106693/202603/7a88de832adc4b2081c5adfe8e29104e.shtml', featured: 0, sortOrder: -90,
    markdown: `# 春耕装备准备情况

喀什地区围绕春耕生产开展农机检修、机手培训、补贴落实和主推机具推广。

## 公开数据摘要

- 计划投入15.52万台（套）农机装备参与春耕生产。
- 推进农机具检修调试和农机手、修理工培训。
- 争取中央、自治区农机购置与应用补贴资金，支持春耕生产装备更新。
- 推广分流式整地机、种肥一体播种机、高地隙喷雾机和残膜回收机等装备。

## 使用建议

作业前应检查安全防护、导航标定、播量和播深、铺膜质量及滴灌带位置。跨区作业或委托社会化服务时，建议书面约定作业面积、质量标准、价格、验收方式和故障责任。

> 机具补贴资格和作业服务价格以主管部门、经营主体的正式信息为准。`
  },
  {
    title: '喀什地区科学安全使用农药指导要点',
    type: 'industry', section: '农资', issuer: '喀什地区农业农村局',
    region: '喀什地区', documentNo: '', publishedAt: '2025-02-28 09:00:00',
    url: 'https://www.kashi.gov.cn/ksdqxzgs/c106693/202502/6e6c7201048948c99d71f60b38b70245.shtml', featured: 1, sortOrder: -80,
    markdown: `# 购买农药先做“四看”

喀什地区农业农村局提示，农户应从资质齐全、信誉良好的正规经营门店购买农药，并核对产品信息。

1. 看农药登记证、生产许可证和产品标准等信息是否齐全。
2. 看登记作物和防治对象是否与实际需求相符。
3. 看使用方法、剂量和施药方式是否适用。
4. 看注意事项、安全间隔期和中毒急救说明。

## 使用过程

- 先识别病虫草害，再选择对症药剂；无法判断时咨询农技人员。
- 严格按照标签剂量配药，不随意混配、加量或扩大使用范围。
- 做好个人防护，避开大风、高温时段和水源保护区域。
- 包装废弃物不得随意丢弃，应按当地要求回收处理。

## 棉田特别提醒

关注棉蚜、棉铃虫、红蜘蛛等监测预警，坚持达标防治和精准施药，保护天敌，避免只按日历盲目施药。

> 农药使用必须以产品标签、登记范围和当地植保技术指导为准。`
  },
  {
    title: '2025年全国棉花产量数据发布：新疆仍是核心产区',
    type: 'industry', section: '市场', issuer: '国家统计局',
    region: '全国', documentNo: '', publishedAt: '2025-12-26 09:00:00',
    url: 'https://www.stats.gov.cn/sj/zxfb/202512/t20251226_1962156.html', featured: 0, sortOrder: -70,
    markdown: `# 统计结果

国家统计局公布2025年全国棉花生产情况。数据由主产区遥感测量、抽样调查和相关统计相结合取得。

## 主要数据

- 全国棉花播种面积2979.2千公顷，比上年增长5.0%。
- 全国棉花单位面积产量2229.0公斤/公顷，比上年增长2.6%。
- 全国棉花总产量664.1万吨，比上年增长7.7%。
- 新疆棉花总产量616.5万吨，是全国棉花生产的核心区域。

## 如何使用这些数据

产量和面积可以帮助判断供应基本面，但不能单独用于预测收购价或期货价格。市场还会受到质量结构、库存、消费、进口、物流和宏观环境等因素影响。经营决策应同时核对交易所、行业机构及当地收购企业发布的最新信息。

> 本文仅作产业信息阅读，不构成价格预测、交易报价或投资建议。`
  },
  {
    title: '喀什地区2025年气候趋势与农业防灾提示',
    type: 'industry', section: '气象', issuer: '喀什地区行政公署',
    region: '喀什地区', documentNo: '', publishedAt: '2025-06-06 09:00:00',
    url: 'https://www.kashi.gov.cn/ksdqxzgs/c106719/202506/c5cedb350697415dba2ce9e3aacd6bb1.shtml', featured: 0, sortOrder: -60,
    markdown: `# 气候趋势摘要

喀什地区2025年度地质灾害防治方案结合气象预测，对降水、气温及灾害性天气风险作出研判。

## 需要关注的天气风险

- 喀什平原地区年平均气温预计较常年偏高。
- 年降水量可能较常年偏多，但降水时空分布仍可能不均。
- 春季阶段性低温、大风、沙尘，以及局地冰雹、暴雨洪涝等极端天气风险需重点防范。
- 5—9月是部分自然灾害风险较集中的时段。

## 棉田管理提示

播种期关注低温、大风和土壤墒情；苗蕾期关注风沙、冰雹和棉蚜迁飞；花铃期关注持续高温与灌溉调度；吐絮采收期关注降雨、大风和早霜。具体作业应结合地块位置、短临预报、土壤墒情和作物长势判断。

> 趋势预测不能替代逐日天气预报和灾害预警。请及时查看当地气象部门发布的最新信息。`
  }
]

async function run() {
  let inserted = 0
  let skipped = 0

  for (const article of articles) {
    const [[existing]] = await db.query(
      'SELECT id,title FROM policy_articles WHERE original_url=? LIMIT 1',
      [article.url]
    )
    if (existing) {
      skipped += 1
      console.log(`[skip] #${existing.id} ${existing.title}`)
      continue
    }

    const summary = article.markdown
      .replace(/[#>*_`~\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180)
    const level = article.type === 'policy' ? article.section : '行业资讯'
    const [result] = await db.query(
      `INSERT INTO policy_articles
       (title,summary,body_markdown,content_type,policy_level,category,issuer,region,document_no,deadline,
        original_url,status,is_featured,sort_order,published_at,created_by,updated_by)
       VALUES (?,?,?,?,?,?,?,?,?, '', ?, 'published',?,?,?,NULL,NULL)`,
      [article.title, summary, article.markdown, article.type, level, article.section, article.issuer,
        article.region, article.documentNo, article.url, article.featured, article.sortOrder, article.publishedAt]
    )
    inserted += 1
    console.log(`[insert] #${result.insertId} ${article.title}`)
  }

  const [[homeQueue]] = await db.query(
    "SELECT COUNT(*) AS total FROM policy_articles WHERE status='published' AND is_home_featured=1"
  )
  if (Number(homeQueue.total || 0) === 0) {
    await db.query(`
      UPDATE policy_articles SET is_home_featured=1,home_featured_at=COALESCE(published_at,updated_at,NOW())
       WHERE id IN (
         SELECT id FROM (
           SELECT id FROM policy_articles
            WHERE status='published' AND is_featured=1
            ORDER BY sort_order ASC,published_at DESC,id DESC LIMIT 5
         ) initial_home
       )
    `)
    console.log('[homepage] initialized from up to five published priority articles')
  }

  const [[total]] = await db.query("SELECT COUNT(*) AS count FROM policy_articles WHERE status='published'")
  console.log(`Official policy seed complete: inserted=${inserted}, skipped=${skipped}, published=${total.count}`)
}

run()
  .catch(error => {
    console.error('[official-policy-seed]', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.end()
  })
