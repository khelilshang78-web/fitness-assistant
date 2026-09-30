import { useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Scale, RefreshCw, TrendingDown } from 'lucide-react'
import {
  MIN_WINDOW_ENTRIES,
  TOTAL_DAYS,
  adjustAdvice,
  buildWindows,
  calcMacros,
  currentPhase,
  reverseCarbAdvice,
  todayStr,
  type Plan,
  type WeightEntry,
} from '@/lib/plan'
import { useLocalStorage } from '@/lib/store'

interface Props {
  plan: Plan
  onRecalc: (p: Plan) => void
}

const KIND_STYLE: Record<string, string> = {
  keep: 'border-emerald-300 bg-emerald-50',
  addCarb: 'border-sky-300 bg-sky-50',
  reduceCarb: 'border-amber-300 bg-amber-50',
  pending: 'border-muted bg-muted/40',
}

export default function WeightTracker({ plan, onRecalc }: Props) {
  const [entries, setEntries] = useLocalStorage<WeightEntry[]>('jzzj_weights', [])
  const [date, setDate] = useState(todayStr())
  const [kg, setKg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const phase = useMemo(() => currentPhase(plan.startDate), [plan.startDate])
  const windows = useMemo(() => buildWindows(entries, plan.startDate), [entries, plan.startDate])
  const advice = useMemo(() => adjustAdvice(windows), [windows])

  // 当前进行中窗口的记录进度（不参与对比，只展示）
  const currentWindowCount = useMemo(() => {
    const start = new Date(plan.startDate + 'T00:00:00').getTime()
    const now = new Date()
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const wStart = start + Math.floor((today0 - start) / 86400000 / 10) * 10 * 86400000
    return entries.filter((e) => {
      const t = new Date(e.date + 'T00:00:00').getTime()
      return t >= wStart && t <= today0
    }).length
  }, [entries, plan.startDate])

  // 最近 ≤7 条记录的均值，用于铁律重算与进度展示（比单条更稳）
  const recentAvg = useMemo(() => {
    if (!entries.length) return null
    const last7 = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)
    return last7.reduce((s, e) => s + e.kg, 0) / last7.length
  }, [entries])

  const latest = entries.length
    ? [...entries].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null
  const dropped = recentAvg !== null ? plan.startWeight - recentAvg : 0
  const needRecalc = dropped >= 3

  const chartData = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
    return sorted.map((e, i) => {
      const win = sorted.slice(Math.max(0, i - 6), i + 1)
      const ma7 = win.reduce((s, x) => s + x.kg, 0) / win.length
      return { date: e.date.slice(5), 体重: e.kg, 七天均线: Math.round(ma7 * 100) / 100 }
    })
  }, [entries])

  const addEntry = () => {
    const v = parseFloat(kg)
    if (!v || v <= 0 || !date) return
    const rest = entries.filter((e) => e.date !== date)
    setEntries([...rest, { date, kg: v }].sort((a, b) => a.date.localeCompare(b.date)))
    setKg('')
  }

  const removeEntry = (d: string) => setEntries(entries.filter((e) => e.date !== d))

  // 一键重算：用最近 ≤7 天平均体重替换计算体重，按原档位重乘系数（蛋白/脂肪地板在系数表中已保证）
  const recalc = () => {
    if (recentAvg === null) return
    const w = Math.round(recentAvg * 10) / 10
    const macros = calcMacros(w, plan.gender, plan.tier)
    onRecalc({ ...plan, calcWeight: w, macros })
  }

  // ---- 数据备份：导出 / 导入 ----
  const BACKUP_KEYS = ['jzzj_plan', 'jzzj_weights', 'jzzj_training', 'jzzj_lift_weights', 'jzzj_cardio']
  const exportData = () => {
    const data: Record<string, unknown> = {
      __app: 'jzzj-backup',
      __version: 1,
      exportedAt: new Date().toISOString(),
    }
    for (const k of BACKUP_KEYS) {
      const raw = localStorage.getItem(k)
      if (raw) {
        try {
          data[k] = JSON.parse(raw)
        } catch {
          /* skip corrupted */
        }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `减脂增肌备份-${todayStr()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  const importData = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as Record<string, unknown>
        if (data.__app !== 'jzzj-backup') throw new Error('bad format')
        let n = 0
        for (const k of BACKUP_KEYS) {
          if (k in data) {
            localStorage.setItem(k, JSON.stringify(data[k]))
            n++
          }
        }
        window.alert(`已恢复 ${n} 项数据，页面即将刷新。`)
        window.location.reload()
      } catch {
        window.alert('导入失败：这不是本应用导出的备份文件。')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-4">
      {/* 阶段与进度 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            {phase.label}
            <Badge variant="secondary">
              第 {Math.min(phase.day, TOTAL_DAYS)} 天 / 共 {TOTAL_DAYS} 天
            </Badge>
          </CardTitle>
          <CardDescription>
            当前目标：碳水 {plan.macros.carb} g ｜ 蛋白 {plan.macros.protein} g ｜ 脂肪 {plan.macros.fat} g
            （计算体重 {plan.calcWeight} kg）
          </CardDescription>
        </CardHeader>
        {(phase.isDietBreak || phase.reverseWeek) && (
          <CardContent className="pt-0 space-y-2">
            {phase.isDietBreak && (
              <Alert className="border-violet-300 bg-violet-50">
                <AlertTitle>🍚 第 7 周 · 饮食休息周</AlertTitle>
                <AlertDescription>
                  把碳水加回维持水平（约 +0.8~1.0 g/kg ≈ +{Math.round(plan.calcWeight * 0.9)} g/天），蛋白脂肪不变，吃 7
                  天。体重可能回升 0.5–1.5 kg（水分和糖原），<b>这不是反弹</b>。第 8 周回到缺口继续。
                </AlertDescription>
              </Alert>
            )}
            {phase.reverseWeek && (
              <Alert className="border-emerald-300 bg-emerald-50">
                <AlertTitle>📈 反向过渡进行中</AlertTitle>
                <AlertDescription>
                  {reverseCarbAdvice(phase.reverseWeek!)}
                  过渡期体重回升 1–2 kg（糖原+水分）属正常，腰围不回升才算真成功。
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        )}
      </Card>

      {/* 录入 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-5 w-5 text-primary" />
            今日体重
          </CardTitle>
          <CardDescription>每天早晨空腹、排便后称重。单日 ±1 kg 都是噪声，看趋势不看单日。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="体重 kg"
              value={kg}
              onChange={(e) => setKg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEntry()}
            />
            <Button onClick={addEntry}>记录</Button>
          </div>
          {latest && (
            <p className="mt-2 text-sm text-muted-foreground">
              最新：{latest.date} · {latest.kg} kg ｜ 近 7 次均值较开始 {dropped >= 0 ? '−' : '+'}
              {Math.abs(dropped).toFixed(1)} kg
            </p>
          )}
          {/* 最近记录：支持删除误录 */}
          {entries.length > 0 && (
            <div className="mt-3 space-y-1">
              {[...entries]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 5)
                .map((e) => (
                  <div key={e.date} className="flex items-center justify-between rounded-md border px-3 py-1.5 text-sm">
                    <span>
                      {e.date} · {e.kg} kg
                    </span>
                    <button
                      className="text-xs text-red-500 hover:underline"
                      onClick={() => removeEntry(e.date)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              {entries.length > 5 && (
                <p className="text-xs text-muted-foreground">仅显示最近 5 条，共 {entries.length} 条。</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 图表 */}
      {chartData.length >= 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">体重趋势</CardTitle>
            <CardDescription>每日体重 + 7 天移动均线（方案 4.1）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis domain={['auto', 'auto']} fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="体重" stroke="#94a3b8" dot={{ r: 2 }} strokeWidth={1.5} />
                  <Line type="monotone" dataKey="七天均线" stroke="#059669" dot={false} strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 调整建议 */}
      <Card className={KIND_STYLE[advice.kind]}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingDown className="h-5 w-5" />
            10 天窗口调整建议（方案 4.2）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-semibold">{advice.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{advice.detail}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            当前窗口已记录 {currentWindowCount}/10 天（满 {MIN_WINDOW_ENTRIES} 天且窗口结束后生效）。
          </p>
          {windows.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {windows.map((w) => (
                <Badge key={w.widx} variant="outline" className="bg-white/60">
                  第{w.widx + 1}窗：均值 {w.avg.toFixed(1)} kg · {w.count}/10 天
                  {w.weeklyChangePct !== null &&
                    ` · ${w.weeklyChangePct >= 0 ? '−' : '+'}${Math.abs(w.weeklyChangePct).toFixed(2)}%/周`}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 铁律 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">三条铁律</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>任何情况下蛋白质不低于 1.6 g/kg、脂肪不低于 0.8 g/kg，不可下调。</li>
            <li>每次调整后至少稳定执行 7–10 天再做下一次判断。</li>
            <li>体重每下降 3–5 kg，用新体重重新乘一遍系数。</li>
          </ul>
          {needRecalc && recentAvg !== null && (
            <Alert className="border-amber-300 bg-amber-50">
              <RefreshCw className="h-4 w-4" />
              <AlertTitle>已减重 {dropped.toFixed(1)} kg（近 7 次均值），建议重算系数</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  按近 7 次平均体重 {recentAvg.toFixed(1)} kg 重算：碳水{' '}
                  {calcMacros(recentAvg, plan.gender, plan.tier).carb} g ｜ 蛋白{' '}
                  {calcMacros(recentAvg, plan.gender, plan.tier).protein} g ｜ 脂肪{' '}
                  {calcMacros(recentAvg, plan.gender, plan.tier).fat} g
                </p>
                <Button size="sm" onClick={recalc}>
                  一键按新体重重算
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 数据备份 */}
      <Card className="border-amber-300 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-base">⚠️ 数据备份</CardTitle>
          <CardDescription>
            所有数据只保存在本机浏览器（localStorage）。<b>清理浏览器数据、换设备或浏览器升级异常都会丢失 112
            天的记录</b>——建议每周导出一次备份。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportData}>
            导出备份（JSON）
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            导入恢复
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) importData(f)
              e.target.value = ''
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
