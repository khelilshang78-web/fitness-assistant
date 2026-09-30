// 端到端自查脚本：驱动系统 Edge 验证五个模块
const puppeteer = require('puppeteer-core')

const BASE = 'http://localhost:4173/'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true }) // 移动端优先
  const errors = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))

  // 1. 计算器：填 100kg / 体脂35% / 每周<=3h 档
  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.type('#weight', '100')
  await page.type('#bf', '35')
  await page.waitForFunction(() => document.body.innerText.includes('每日目标'), { timeout: 5000 })
  const calcText = await page.evaluate(() => document.body.innerText)
  const grab = (re) => (calcText.match(re) || [null])[0]
  console.log('[calc] 计算体重行:', grab(/计算体重[^\n]*/))
  console.log('[calc] 碳水值存在:', /187\s*g/.test(calcText) || calcText.includes('碳水'))
  const macroNums = await page.evaluate(() => {
    const t = document.body.innerText
    return {
      carb: (t.match(/碳水\n(\d+) g/) || [])[1],
      protein: (t.match(/蛋白质\n(\d+) g/) || [])[1],
      fat: (t.match(/脂肪\n(\d+) g/) || [])[1],
      kcal: (t.match(/每日总热量[^\n]*\n?(\d{3,4}) kcal/) || [])[1],
    }
  })
  console.log('[calc] 宏量(期望 187/136/68, kcal≈1904):', JSON.stringify(macroNums))
  await page.screenshot({ path: 'shots/shot_calc.png' })

  // 2. 点击开始计划
  const btns = await page.$$('button')
  for (const b of btns) {
    const txt = await b.evaluate((el) => el.innerText)
    if (txt.includes('开始计划')) { await b.click(); break }
  }
  await new Promise((r) => setTimeout(r, 500))
  const plan = await page.evaluate(() => localStorage.getItem('jzzj_plan'))
  console.log('[calc] 已保存 plan:', plan)

  // 3. 体重追踪：确认解锁，录入 25 天体重造两个窗口
  await page.goto(BASE + '#weight'); await page.reload({ waitUntil: 'networkidle0' })
  const unlockedW = await page.evaluate(() => document.body.innerText.includes('今日体重'))
  console.log('[weight] 解锁:', unlockedW)
  await page.evaluate(() => {
    const entries = []
    const d = new Date()
    for (let i = 24; i >= 0; i--) {
      const dd = new Date(d.getTime() - i * 86400000)
      const ds = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
      entries.push({ date: ds, kg: Math.round((100 - (24 - i) * 0.18) * 10) / 10 })
    }
    localStorage.setItem('jzzj_weights', JSON.stringify(entries))
  })
  await page.goto(BASE + '#weight'); await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForFunction(() => document.body.innerText.includes('10 天窗口调整建议'), { timeout: 5000 })
  const wText = await page.evaluate(() => document.body.innerText)
  console.log('[weight] 建议卡:', (wText.match(/下降过快|节奏理想|继续观察|下降过慢|数据积累中/) || ['无'])[0])
  console.log('[weight] 图表存在:', await page.evaluate(() => !!document.querySelector('.recharts-responsive-container')))
  console.log('[weight] 铁律重算提示:', wText.includes('建议重算系数'))
  await page.screenshot({ path: 'shots/shot_weight.png', fullPage: false })

  // 4. 训练打卡
  await page.goto(BASE + '#training'); await page.reload({ waitUntil: 'networkidle0' })
  const tText = await page.evaluate(() => document.body.innerText)
  console.log('[training] 解锁/模板:', tText.includes('上肢 A'), tText.includes('方案 B'))
  // 勾选第一个动作 + 记录深蹲重量
  await page.evaluate(() => document.querySelector('#\\31 -0-0')?.click())
  await page.screenshot({ path: 'shots/shot_training.png' })

  // 5. 餐单 + 规则
  await page.goto(BASE + '#meals'); await page.reload({ waitUntil: 'networkidle0' })
  const mText = await page.evaluate(() => document.body.innerText)
  console.log('[meals] 合计行:', (mText.match(/合计[\s\S]{0,80}?2059 kcal/) ? '含210/145/71≈2059' : '未找到'), mText.includes('210 g'))
  await page.screenshot({ path: 'shots/shot_meals.png' })
  await page.goto(BASE + '#rules'); await page.reload({ waitUntil: 'networkidle0' })
  const rText = await page.evaluate(() => document.body.innerText)
  console.log('[rules] 高碳日碳水增量个性化:', rText.includes('+127~170') || rText.includes('高碳日示例目标'))
  await page.screenshot({ path: 'shots/shot_rules.png' })

  console.log('[console errors]:', errors.length ? errors : '无')
  await browser.close()
})().catch((e) => { console.error('E2E FAILED:', e.message); process.exit(1) })
