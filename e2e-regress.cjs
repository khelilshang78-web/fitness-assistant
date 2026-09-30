// 回归验证脚本：移动端溢出、持久化、覆盖/删除、窗口对齐、导入导出
const puppeteer = require('puppeteer-core')
const fs = require('fs')

const BASE = 'http://localhost:4173/'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const seedPlan = {
  gender: 'male', tier: 0, startWeight: 100, calcWeight: 87.5,
  macros: { carb: 193, protein: 140, fat: 70 }, startDate: null, // 运行时填今天
}
const local = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: 'new', args: ['--no-sandbox', '--disable-gpu'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 360, height: 780, isMobile: true, hasTouch: true })
  const errors = []
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  page.on('dialog', (d) => d.accept())

  // ---- 0. 造数据：计划从今天开始；窗口1 满10天，窗口2 只记7天（验证≥7天即生效），窗口3 进行中3天
  const today = new Date()
  const day0 = new Date(today.getTime() - 22 * 86400000) // 开始于 22 天前
  const startDate = local(day0)
  seedPlan.startDate = startDate
  const entries = []
  for (let i = 0; i < 10; i++) entries.push({ date: local(new Date(day0.getTime() + i * 86400000)), kg: 100 - i * 0.15 })
  for (let i = 10; i < 17; i++) entries.push({ date: local(new Date(day0.getTime() + i * 86400000)), kg: 98.5 - (i - 10) * 0.15 })
  for (let i = 20; i < 23; i++) entries.push({ date: local(new Date(day0.getTime() + i * 86400000)), kg: 97.4 - (i - 20) * 0.1 })

  await page.goto(BASE, { waitUntil: 'networkidle0' })
  await page.evaluate((p, w) => {
    localStorage.setItem('jzzj_plan', JSON.stringify(p))
    localStorage.setItem('jzzj_weights', JSON.stringify(w))
  }, seedPlan, entries)

  // ---- 1. 全部 tab 横向溢出检查（360px）
  for (const t of ['calc', 'weight', 'training', 'meals', 'rules']) {
    await page.goto(BASE + '#' + t)
    await page.reload({ waitUntil: 'networkidle0' })
    await new Promise((r) => setTimeout(r, 700))
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    console.log(`[溢出] #${t}: ${overflow <= 0 ? 'OK' : '横向溢出 ' + overflow + 'px'}`)
  }

  // ---- 2. iOS 输入字号
  await page.goto(BASE + '#calc'); await page.reload({ waitUntil: 'networkidle0' })
  const fontSize = await page.evaluate(() => getComputedStyle(document.querySelector('#weight')).fontSize)
   console.log("[iOS zoom] 输入框字号:", fontSize, parseFloat(fontSize) >= 16 ? 'OK' : 'FAIL')

  // ---- 3. 持久化：录入→刷新→仍在；同日重复录入覆盖；删除
  await page.goto(BASE + '#weight'); await page.reload({ waitUntil: 'networkidle0' })
  await page.waitForSelector('input[type="date"]')
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('jzzj_weights')).length)
  // 同日录入两次不同值
  await page.type('input[inputmode="decimal"]', '96.9')
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText === '记录')?.click())
  await page.evaluate(() => { document.querySelector('input[inputmode="decimal"]').value = '' })
  await page.type('input[inputmode="decimal"]', '96.5')
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText === '记录')?.click())
  await new Promise((r) => setTimeout(r, 300))
  const afterOverwrite = await page.evaluate((ds) => {
    const w = JSON.parse(localStorage.getItem('jzzj_weights'))
    return { total: w.length, today: w.find((e) => e.date === ds)?.kg }
  }, local(today))
  console.log(`[覆盖] 录入前 ${before} 条 → 同日录入两次后 ${afterOverwrite.total} 条，今日值=${afterOverwrite.today}（期望 +1 条且为 96.5）`)
  await page.reload({ waitUntil: 'networkidle0' })
  const persisted = await page.evaluate((ds) => JSON.parse(localStorage.getItem('jzzj_weights')).find((e) => e.date === ds)?.kg, local(today))
  console.log('[持久化] 刷新后今日记录:', persisted === 96.5 ? 'OK 96.5' : 'FAIL ' + persisted)
  // 删除
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText === '删除')?.click())
  await new Promise((r) => setTimeout(r, 300))
  const afterDel = await page.evaluate((ds) => JSON.parse(localStorage.getItem('jzzj_weights')).some((e) => e.date === ds), local(today))
  console.log('[删除] 删除今日记录后仍存在?', afterDel ? 'FAIL' : 'OK')

  // ---- 4. 窗口对齐与数据门槛
  const wText = await page.evaluate(() => document.body.innerText)
  console.log('[窗口] 第1窗(10/10):', wText.includes('第1窗') && wText.includes('10/10 天') ? 'OK' : 'FAIL')
  console.log('[窗口] 第2窗(7/10 生效):', wText.includes('7/10 天') ? 'OK' : 'FAIL')
  console.log('[窗口] 进行中窗口提示:', /当前窗口已记录 \d+\/10 天/.test(wText) ? wText.match(/当前窗口已记录 \d+\/10 天/)[0] : 'FAIL')
  console.log('[建议卡]:', (wText.match(/下降过快|节奏理想|继续观察|下降过慢|数据积累中/) || ['无'])[0])

  // ---- 5. 导出 / 导入
  fs.mkdirSync('shots/dl', { recursive: true })
  const cdp = await page.createCDPSession()
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: require('path').resolve('shots/dl') })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.includes('导出备份'))?.click())
  await new Promise((r) => setTimeout(r, 1500))
  const dl = fs.readdirSync('shots/dl').filter((f) => f.endsWith('.json'))
  console.log('[导出] 下载文件:', dl.length ? 'OK ' + dl[0] : 'FAIL')
  // 清空后导入恢复
  await page.evaluate(() => localStorage.removeItem('jzzj_weights'))
  const input = await page.$('input[type="file"]')
  await input.uploadFile('shots/dl/' + dl[0])
  await page.waitForFunction(() => document.body.innerText.includes('今日体重'), { timeout: 8000 })
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('jzzj_weights') || '[]').length)
  console.log('[导入] 清空后导入恢复条数:', restored, restored >= 20 ? 'OK' : 'FAIL')

  console.log('[pageerror]:', errors.length ? errors : '无')
  await browser.close()
})().catch((e) => { console.error('REGRESS FAILED:', e.message); process.exit(1) })
