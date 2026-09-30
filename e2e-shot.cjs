const puppeteer = require('puppeteer-core')
;(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  })
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true })
  await page.goto('http://localhost:4173/', { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    localStorage.setItem('jzzj_plan', JSON.stringify({
      gender: 'male', tier: 0, startWeight: 100, calcWeight: 87.5,
      macros: { carb: 193, protein: 140, fat: 70 }, startDate: '2026-09-30',
    }))
    const entries = []
    const d = new Date()
    for (let i = 24; i >= 0; i--) {
      const dd = new Date(d.getTime() - i * 86400000)
      const ds = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`
      entries.push({ date: ds, kg: Math.round((100 - (24 - i) * 0.18) * 10) / 10 })
    }
    localStorage.setItem('jzzj_weights', JSON.stringify(entries))
  })
  await page.goto('http://localhost:4173/#weight')
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 800))
  // 打印第一个卡片文本，排查空白
  const first = await page.evaluate(() => {
    const main = document.querySelector('main')
    return main ? main.innerText.slice(0, 300) : 'no main'
  })
  console.log('--- weight page top text ---')
  console.log(first)
  await page.screenshot({ path: 'shots/shot_weight_full.png', fullPage: true })
  await browser.close()
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
