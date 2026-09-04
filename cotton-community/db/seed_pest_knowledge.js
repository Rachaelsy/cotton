require('dotenv').config()

const db = require('./database')

const SOURCE_NAME = '全国农业技术推广服务中心《2025年棉花重大病虫害防控技术方案》'
const SOURCE_URL = 'https://www.natesc.org.cn/admin/UeditorUploadFiles/file/20250228/6387632541475976564699731.pdf'
const WARNING = '涉及农药时，应以农药登记范围、产品标签、安全间隔期和当地植保部门指导为准；不得任意加大剂量或混配，注意轮换不同作用机制并做好个人防护。'

const items = [
  {
    name: '棉蚜', category: 'pest', icon: '🐛', sortOrder: 10, featured: 1,
    summary: '棉蚜主要聚集在嫩叶背面、生长点和幼嫩组织吸食汁液。发生较重时可造成叶片卷缩、植株生长受阻，并可能因蜜露引起叶面污染。判断时应同时查看有蚜株率、卷叶程度和天敌数量。',
    symptoms: ['嫩叶背面或生长点可见成蚜、若蚜聚集', '叶片向背面卷缩，幼嫩组织生长受阻', '叶面出现黏性蜜露，严重时伴随煤污状污染', '常先在田边、局部旺长区或虫源附近形成中心株'],
    treatment: '采用固定路线和定点样株连续调查，记录有蚜株率、卷叶株率及瓢虫、草蛉、食蚜蝇等天敌数量。苗蕾期应保护和利用自然天敌，避免见虫即全田使用广谱药剂。达到当地防治指标时，按照属地病虫情报和登记标签实施点片或精准防治，重点保证叶背和嫩梢有效覆盖。'
  },
  {
    name: '棉叶螨（红蜘蛛）', category: 'pest', icon: '🕷️', sortOrder: 20, featured: 1,
    summary: '棉叶螨多在高温干旱条件下加快繁殖，通常从田边、道路旁和杂草寄主附近开始扩展。受害叶片先出现细小失绿斑，随后可变红、变褐并提前脱落。',
    symptoms: ['叶面出现密集针尖状失绿斑点，逐渐连成黄白或红褐色斑', '翻看叶背可见螨体、卵或细微蛛丝', '严重叶片干枯脱落，植株早衰', '田间常表现为由地边或局部中心向外扩展'],
    treatment: '加强田边、道路旁和干旱区域监测，调查时必须翻看叶背，并标记中心株和扩展边界。清理田边寄主杂草，合理安排水肥，减轻持续干旱造成的植株胁迫。出现点片发生时优先开展局部处置；确需用药时选用登记产品并注意作用机制轮换和喷施覆盖，避免连续单一用药。'
  },
  {
    name: '棉蓟马', category: 'pest', icon: '🪰', sortOrder: 30, featured: 0,
    summary: '棉蓟马主要危害出苗后的幼嫩组织。苗期受害后，子叶和真叶可能出现银白色斑痕、皱缩或破裂，生长点受损时容易形成多头苗。',
    symptoms: ['子叶或嫩叶表面出现银白色擦伤状斑痕', '真叶皱缩、畸形或边缘破裂', '生长点受害后主茎生长受阻，可能出现多头苗', '虫体细小，需重点检查幼嫩组织和叶片缝隙'],
    treatment: '出苗后及时开展苗情和虫情联合调查，区分蓟马危害与低温、风沙、药害造成的畸形。通过提高播种和出苗整齐度、及时清除田边寄主等措施降低持续危害。根据当地虫情监测开展早期点片防治，避免等到生长点普遍受损后再处理。'
  },
  {
    name: '棉盲蝽', category: 'pest', icon: '🪲', sortOrder: 40, featured: 0,
    summary: '棉盲蝽取食棉株生长点、嫩叶、花蕾和幼铃，容易造成顶芽受损、叶片破孔、蕾铃脱落和多头生长。田间调查应结合受害痕迹和虫体监测综合判断。',
    symptoms: ['嫩叶展开后出现不规则破孔或撕裂状损伤', '生长点萎缩、坏死，侧枝增多形成多头株', '花蕾和幼铃表面出现刺吸斑点并发生脱落', '田边、邻近寄主作物或杂草区域可能先出现危害'],
    treatment: '结合田边寄主、相邻作物和棉田内部设置调查点，重点查看清晨或阴天的虫体活动及新鲜刺吸痕迹。加强田间杂草和周边寄主管理，避免只根据落蕾现象直接判定。根据属地测报和防治指标把握低龄、低密度阶段的处置窗口，优先点片防治。'
  },
  {
    name: '棉铃虫', category: 'pest', icon: '🦋', sortOrder: 50, featured: 1,
    summary: '棉铃虫幼虫可取食嫩尖、花蕾、花和棉铃。田间应把成虫诱测、卵量、幼虫龄期和蕾铃受害率结合起来，重点关注低龄幼虫防治窗口。',
    symptoms: ['嫩尖、花蕾或幼铃出现取食孔和缺刻', '受害部位附近可见虫粪，蕾铃易脱落或腐烂', '植株顶部、苞叶和花器上可发现卵或低龄幼虫', '发生较重时不同龄期幼虫和多种受害部位同时出现'],
    treatment: '按固定样株检查顶部、花蕾和棉铃，记录卵量、幼虫龄期与受害率，并结合当地诱捕监测和虫情预报判断发生代次。保护天敌并利用性诱等监测措施，避免在虫龄偏大后盲目加大药量。达到属地防治指标时，抓住低龄幼虫期实施精准防治。'
  },
  {
    name: '棉花黄萎病', category: 'disease', icon: '🍂', sortOrder: 60, featured: 1,
    summary: '黄萎病常表现为叶片脉间黄化、斑驳和萎蔫，田间可呈零星或成片发生。类似症状也可能由根区积水、盐害、缺素或药害引起，需要结合分布、根茎和管理记录综合排查。',
    symptoms: ['叶片脉间出现黄白色斑驳，叶脉附近仍保持绿色', '症状逐渐扩展，叶缘焦枯，植株萎蔫或提前落叶', '剖开茎秆后维管束可能出现褐色变色', '田间呈零星、点片状或随水流和耕作方向扩展'],
    treatment: '优先选用抗（耐）病品种和健康种子，做好轮作、田间卫生及农机具清洁，减少带病残体和土壤跨地块传播。合理水肥，避免根区积水和植株过度胁迫。发现疑似病株时记录分布、拍摄整株及根茎，并在必要时送专业机构检测；已发病田以减轻胁迫和防扩散为重点。'
  },
  {
    name: '棉花苗期病害', category: 'disease', icon: '🌱', sortOrder: 70, featured: 0,
    summary: '棉花苗期病害包括立枯病、猝倒病、炭疽病等，可能造成烂种、不出苗、茎基部缢缩和幼苗倒伏。低温、高湿、播深不一及种床条件差会增加发生风险。',
    symptoms: ['播后种子腐烂、幼芽变褐，未能正常出土', '幼苗茎基部出现褐色病斑、缢缩或水渍状软腐', '幼苗倒伏、萎蔫或成片缺苗断垄', '低洼、高湿、覆土过厚或地温偏低区域通常发生较重'],
    treatment: '播前选用适宜当地的健康种子和抗病品种，规范种子处理，校准播深并提高种床一致性。播后根据地温和墒情管理，避免低温条件下过量灌水。发现缺苗或倒伏时挖查种子、根和茎基部，比较不同地势和播深区域，确认病因后按当地技术规程采取补救措施。'
  },
  {
    name: '棉花铃病', category: 'disease', icon: '⚪', sortOrder: 80, featured: 0,
    summary: '铃病包括疫病、炭疽病、红腐病等，多在降雨、高湿、棉田郁闭或棉铃受伤后加重。不同病原症状可能相互叠加，应结合天气、铃期和田间通风条件判断。',
    symptoms: ['棉铃表面出现水渍状、褐色或黑褐色病斑', '病斑扩大后棉铃软腐、僵化或不能正常吐絮', '潮湿条件下病部可能出现霉层或不同颜色的病原物', '下部、郁闭处、受虫伤或机械伤的棉铃往往发生较重'],
    treatment: '改善棉田通风透光和排水条件，合理调控长势，降低持续高湿。及时调查虫伤、机械伤和病铃分布，减少病残组织形成的再侵染来源。降雨后重点复查下部和郁闭部位；出现疑似铃病时结合属地预警和专业诊断确定措施，不要仅凭颜色盲目混配多种药剂。'
  }
]

async function run() {
  let inserted = 0
  for (const item of items) {
    const [result] = await db.query(
      `INSERT INTO community_pest_knowledge
       (name,category,icon,summary,symptoms_json,treatment_advice,medication_warning,source_name,source_url,status,is_featured,sort_order,published_at)
       SELECT ?,?,?,?,?,?,?,?,?, 'published',?,?,NOW()
       WHERE NOT EXISTS (SELECT 1 FROM community_pest_knowledge WHERE name=? LIMIT 1)`,
      [item.name, item.category, item.icon, item.summary, JSON.stringify(item.symptoms), item.treatment,
       WARNING, SOURCE_NAME, SOURCE_URL, item.featured, item.sortOrder, item.name]
    )
    inserted += Number(result.affectedRows || 0)
  }
  console.log(`[seed-pest-knowledge] inserted ${inserted}, skipped ${items.length - inserted}`)
}

run()
  .then(() => db.end())
  .catch(error => { console.error('[seed-pest-knowledge]', error); db.end().finally(() => process.exit(1)) })
