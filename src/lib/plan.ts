// 减脂增肌方案核心数据与计算逻辑（忠实来源：减脂增肌方案.md）

export type Gender = 'male' | 'female'
export type Tier = 0 | 1 | 2 | 3

export const TIER_LABELS = ['≤ 3 小时', '4–5 小时', '6–7 小时', '≥ 8 小时']
export const TIER_SESSIONS = ['抗阻 2 次', '抗阻 3 次', '抗阻 4 次', '抗阻 5 次+']

export interface Coeff {
  carb: number
  protein: number
  fat: number
}

// 方案 3.2 节修正版系数表（g/kg）
export const COEFFS: Record<Gender, Coeff[]> = {
  male: [
    { carb: 2.2, protein: 1.6, fat: 0.8 },
    { carb: 2.5, protein: 1.7, fat: 0.9 },
    { carb: 3.0, protein: 1.8, fat: 1.0 },
    { carb: 3.5, protein: 2.0, fat: 1.0 },
  ],
  female: [
    { carb: 2.0, protein: 1.6, fat: 1.0 },
    { carb: 2.3, protein: 1.7, fat: 1.0 },
    { carb: 2.7, protein: 1.8, fat: 1.1 },
    { carb: 3.2, protein: 2.0, fat: 1.1 },
  ],
}

// 体脂率阈值（方案 3.1）：男 ≥25% / 女 ≥32% 时用目标体重
export const BF_THRESHOLD: Record<Gender, number> = { male: 25, female: 32 }
export const BMI_THRESHOLD = 28

// 铁律下限（方案 4.2）
export const PROTEIN_FLOOR = 1.6
export const FAT_FLOOR = 0.8

export interface Macros {
  carb: number
  protein: number
  fat: number
}

export interface Plan {
  gender: Gender
  tier: Tier
  startWeight: number // 开始计划时的当前体重
  calcWeight: number // 计算体重
  macros: Macros
  startDate: string // YYYY-MM-DD
}

export function calcMacros(calcWeight: number, gender: Gender, tier: Tier): Macros {
  const c = COEFFS[gender][tier]
  return {
    carb: Math.round(calcWeight * c.carb),
    protein: Math.round(calcWeight * c.protein),
    fat: Math.round(calcWeight * c.fat),
  }
}

export function kcalOf(m: Macros): number {
  return Math.round(m.carb * 4 + m.protein * 4 + m.fat * 9)
}

// 估算维持热量：体重 × 30–33（方案 3.3）
export function maintenanceRange(weight: number): [number, number] {
  return [Math.round(weight * 30), Math.round(weight * 33)]
}

export interface WindowStat {
  widx: number // 自开始日期起第几个窗口（0 起），用于连续性判断
  index: number // 展示序号（1 起）
  avg: number
  count: number // 该窗口实际记录天数
  weeklyChangePct: number | null // 相对上一相邻窗口的每周变化率（%）
}

export interface WeightEntry {
  date: string // YYYY-MM-DD
  kg: number
}

// 一个窗口至少记录 7 天才参与对比，避免数据不足的窗口误触发建议
export const MIN_WINDOW_ENTRIES = 7

// 10 天决策窗口（方案 4.1/4.2）：分界对齐计划开始日期（第 1–10 天 / 第 11–20 天…）
export function buildWindows(
  entries: WeightEntry[],
  startDate: string,
  size = 10,
  today = new Date(),
): WindowStat[] {
  const start = new Date(startDate + 'T00:00:00').getTime()
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const currentWidx = Math.floor((now - start) / 86400000 / size)

  const buckets = new Map<number, number[]>()
  for (const e of entries) {
    const t = new Date(e.date + 'T00:00:00').getTime()
    if (isNaN(t)) continue
    const di = Math.floor((t - start) / 86400000)
    if (di < 0) continue
    const w = Math.floor(di / size)
    if (!buckets.has(w)) buckets.set(w, [])
    buckets.get(w)!.push(e.kg)
  }

  // 仅「已完整结束」且「记录天数达标」的窗口参与对比；进行中的窗口不触发建议
  const windows: WindowStat[] = []
  const validWidx = [...buckets.keys()]
    .filter((w) => w < currentWidx && buckets.get(w)!.length >= MIN_WINDOW_ENTRIES)
    .sort((a, b) => a - b)
  for (const w of validWidx) {
    const vals = buckets.get(w)!
    const avg = vals.reduce((s, x) => s + x, 0) / vals.length
    const prev = windows[windows.length - 1]
    // 仅与相邻窗口对比；中间隔着无效窗口时不算连续
    const totalPct = prev && prev.widx === w - 1 ? ((prev.avg - avg) / prev.avg) * 100 : null
    windows.push({
      widx: w,
      index: windows.length + 1,
      avg,
      count: vals.length,
      weeklyChangePct: totalPct === null ? null : (totalPct / size) * 7,
    })
  }
  return windows
}

export type AdviceKind = 'keep' | 'addCarb' | 'reduceCarb' | 'pending'

export interface Advice {
  kind: AdviceKind
  title: string
  detail: string
}

// 方案 4.2 调整规则
export function adjustAdvice(windows: WindowStat[]): Advice {
  const done = windows.filter((w) => w.weeklyChangePct !== null)
  if (windows.length < 2 || done.length === 0) {
    return {
      kind: 'pending',
      title: '数据积累中',
      detail: `每 10 天为一个决策窗口（对齐计划开始日期，每窗至少记录 ${MIN_WINDOW_ENTRIES} 天才生效）。已产生 ${windows.length} 个有效窗口，攒满 2 个相邻窗口后给出调整建议。`,
    }
  }
  const last = done[done.length - 1]
  const prevRaw = done.length >= 2 ? done[done.length - 2] : null
  // 「连续 2 个窗口」：两次对比必须构成 w-2→w-1→w 的完整相邻链
  const prev = prevRaw && last && last.widx - prevRaw.widx === 1 ? prevRaw : null
  const lw = last.weeklyChangePct!
  const pw = prev ? prev.weeklyChangePct! : null

  if (lw > 1 && pw !== null && pw > 1) {
    return {
      kind: 'addCarb',
      title: '下降过快：碳水 +20~30 g',
      detail: `最近两个窗口每周下降 ${pw?.toFixed(2)}% / ${lw.toFixed(2)}%，连续超过 1%/周。建议碳水 +20~30 g（约 +0.3 g/kg），蛋白质与脂肪不动。`,
    }
  }
  if (lw < 0.25 && pw !== null && pw < 0.25) {
    return {
      kind: 'reduceCarb',
      title: '下降过慢：碳水 −20~30 g 或加有氧',
      detail: `最近两个窗口每周下降 ${pw?.toFixed(2)}% / ${lw.toFixed(2)}%，连续低于 0.25%/周。建议碳水 −20~30 g，或每周加 1 次 30 分钟有氧（二选一）。先检查：食物是否全部称重（尤其油和酱料）、步数是否掉了、女性是否在经期前一周。`,
    }
  }
  if (lw >= 0.5 && lw <= 1) {
    return {
      kind: 'keep',
      title: '节奏理想：保持不变',
      detail: `当前窗口每周下降 ${lw.toFixed(2)}%，处于 0.5–1.0%/周 的理想区间。继续执行，不动方案。`,
    }
  }
  return {
    kind: 'keep',
    title: '继续观察：暂不满足调整条件',
    detail: `当前窗口每周变化 ${lw.toFixed(2)}%。规则要求「连续 2 个窗口」同向才调整，且每次调整后至少稳定执行 7–10 天再判断。`,
  }
}

// 阶段判定：总 112 天 = 准备 7 天 + 减脂 12 周 + 反向过渡 4 周（方案一）
export const TOTAL_DAYS = 112
export const PREP_DAYS = 7

export interface Phase {
  label: string
  day: number
  cutWeek: number | null // 减脂期第几周
  isDietBreak: boolean // 第 7 周饮食休息周
  reverseWeek: number | null // 反向过渡第几周（1-4，对应第 13–16 周）
}

export function currentPhase(startDate: string, today = new Date()): Phase {
  const start = new Date(startDate + 'T00:00:00')
  const diff = Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
  const day = Math.max(1, diff)
  if (day <= PREP_DAYS) {
    return { label: `第 0 周 · 准备期`, day, cutWeek: null, isDietBreak: false, reverseWeek: null }
  }
  if (day <= PREP_DAYS + 84) {
    const cutWeek = Math.floor((day - PREP_DAYS - 1) / 7) + 1
    return {
      label: `减脂期 · 第 ${cutWeek} 周`,
      day,
      cutWeek,
      isDietBreak: cutWeek === 7,
      reverseWeek: null,
    }
  }
  if (day <= PREP_DAYS + 84 + 28) {
    const rw = Math.floor((day - PREP_DAYS - 85) / 7) + 1
    return { label: `反向过渡期 · 第 ${12 + rw} 周`, day, cutWeek: null, isDietBreak: false, reverseWeek: rw }
  }
  // 第 112 天后进入维持期（方案七）
  return { label: '维持期 · 保持成果', day, cutWeek: null, isDietBreak: false, reverseWeek: null }
}

// 反向过渡碳水建议（方案七）
export function reverseCarbAdvice(reverseWeek: number): string {
  if (reverseWeek <= 1) return '第 13 周：碳水 +25 g/天，其余不变。'
  return `第 ${12 + reverseWeek} 周：在上周基础上每周再 +20–25 g 碳水，直到体重连续 2 周稳定（±0.5 kg 内波动）。`
}

// 训练模板（方案 5.1）
export interface Exercise {
  name: string
  sets: string
  trackWeight?: boolean // 主要动作，记录重量
}

export interface TrainingDay {
  title: string
  exercises: Exercise[]
  rest?: boolean
}

export const PROGRAM_A: TrainingDay[] = [
  {
    title: '第 1 天 · 上肢 A',
    exercises: [
      { name: '平板卧推', sets: '4×6-8', trackWeight: true },
      { name: '杠铃划船', sets: '4×8-10', trackWeight: true },
      { name: '坐姿推肩', sets: '3×8-10', trackWeight: true },
      { name: '高位下拉', sets: '3×10-12' },
      { name: '弯举 + 臂屈伸', sets: '各 2×12' },
    ],
  },
  {
    title: '第 2 天 · 下肢 A',
    exercises: [
      { name: '深蹲', sets: '4×6-8', trackWeight: true },
      { name: '罗马尼亚硬拉', sets: '3×8-10', trackWeight: true },
      { name: '腿举', sets: '3×10-12', trackWeight: true },
      { name: '提踵', sets: '3×15' },
      { name: '平板支撑', sets: '3 组' },
    ],
  },
  { title: '第 3 天 · 休息或 Zone 2 有氧', exercises: [], rest: true },
  {
    title: '第 4 天 · 上肢 B',
    exercises: [
      { name: '上斜哑铃卧推', sets: '4×8-10', trackWeight: true },
      { name: '引体 / 高位下拉', sets: '4×8-10', trackWeight: true },
      { name: '双杠臂屈伸', sets: '3×10' },
      { name: '面拉', sets: '3×15' },
      { name: '锤式弯举', sets: '2×12' },
    ],
  },
  {
    title: '第 5 天 · 下肢 B',
    exercises: [
      { name: '硬拉', sets: '4×5-6', trackWeight: true },
      { name: '保加利亚分腿蹲', sets: '3×10/侧', trackWeight: true },
      { name: '腿弯举', sets: '3×12' },
      { name: '悬垂举腿', sets: '3×12' },
    ],
  },
  { title: '第 6–7 天 · 休息 / 有氧 / 散步', exercises: [], rest: true },
]

export const PROGRAM_B: TrainingDay[] = [
  {
    title: '训练日 1 · 全身',
    exercises: [
      { name: '深蹲或腿举', sets: '4×6-10', trackWeight: true },
      { name: '卧推或俯卧撑', sets: '4×8-10', trackWeight: true },
      { name: '划船或下拉', sets: '4×8-10', trackWeight: true },
      { name: '罗马尼亚硬拉', sets: '3×10', trackWeight: true },
      { name: '推肩', sets: '3×10' },
      { name: '核心', sets: '3 组' },
    ],
  },
  {
    title: '训练日 2 · 全身',
    exercises: [
      { name: '深蹲或腿举', sets: '4×6-10', trackWeight: true },
      { name: '卧推或俯卧撑', sets: '4×8-10', trackWeight: true },
      { name: '划船或下拉', sets: '4×8-10', trackWeight: true },
      { name: '罗马尼亚硬拉', sets: '3×10', trackWeight: true },
      { name: '推肩', sets: '3×10' },
      { name: '核心', sets: '3 组' },
    ],
  },
  {
    title: '训练日 3 · 全身',
    exercises: [
      { name: '深蹲或腿举', sets: '4×6-10', trackWeight: true },
      { name: '卧推或俯卧撑', sets: '4×8-10', trackWeight: true },
      { name: '划船或下拉', sets: '4×8-10', trackWeight: true },
      { name: '罗马尼亚硬拉', sets: '3×10', trackWeight: true },
      { name: '推肩', sets: '3×10' },
      { name: '核心', sets: '3 组' },
    ],
  },
]

// 餐单模板（方案 6.2，85 kg 男性修正版）
export interface MealRow {
  meal: string
  food: string
  carb: number
  protein: number
  fat: number
}

export const MEAL_TEMPLATE: MealRow[] = [
  { meal: '早餐', food: '燕麦 70 g + 全蛋 3 个 + 蓝莓 100 g', carb: 55, protein: 27, fat: 18 },
  { meal: '午餐', food: '生米 90 g + 鸡胸/鱼虾 180 g + 蔬菜 300 g + 烹调油 15 g', carb: 70, protein: 45, fat: 16 },
  { meal: '练前加餐', food: '香蕉 1 根 + 乳清蛋白粉 1 勺', carb: 27, protein: 24, fat: 2 },
  { meal: '晚餐', food: '薯类 280 g + 瘦牛肉 180 g + 蔬菜 300 g + 烹调油 20 g', carb: 50, protein: 40, fat: 25 },
  { meal: '睡前', food: '无糖酸奶 200 g + 坚果 15 g', carb: 8, protein: 9, fat: 10 },
]

export const FOOD_SWAPS = {
  protein: ['鸡胸', '鱼虾', '瘦牛肉', '鸡蛋', '乳清蛋白粉', '低脂奶', '豆制品（每餐一掌到一掌半）'],
  carb: ['燕麦', '糙米', '薯类', '杂粮', '水果（训练前后那一餐多放碳水，训练表现更好）'],
  fat: ['橄榄油', '坚果', '蛋黄', '深海鱼（脂肪主要来自烹饪和天然食物，不要额外喝油）'],
}

export const RED_FLAGS = [
  '女性月经周期紊乱或停经',
  '持续失眠、情绪显著低落、训练欲望丧失超过 2 周',
  '出现强烈暴食冲动或已发生失控性进食',
  '静息心率升高、长期疲劳、频繁生病',
  '力量连续 3 周全面下滑',
]

export function todayStr(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
