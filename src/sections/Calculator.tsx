import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { AlertTriangle, Flame, Rocket } from 'lucide-react'
import {
  BMI_THRESHOLD,
  BF_THRESHOLD,
  COEFFS,
  TIER_LABELS,
  TIER_SESSIONS,
  calcMacros,
  kcalOf,
  maintenanceRange,
  todayStr,
  type Gender,
  type Plan,
  type Tier,
} from '@/lib/plan'

interface Props {
  plan: Plan | null
  onStart: (p: Plan) => void
}

export default function Calculator({ plan, onStart }: Props) {
  const [gender, setGender] = useState<Gender>(plan?.gender ?? 'male')
  const [weight, setWeight] = useState<string>(plan ? String(plan.startWeight) : '')
  const [height, setHeight] = useState<string>('') // 可选，用于 BMI 判断
  const [bodyFat, setBodyFat] = useState<string>('') // 可选
  const [tier, setTier] = useState<Tier>(plan?.tier ?? 0)
  const [cutPct, setCutPct] = useState<number>(12.5) // 目标体重下调百分比 10–15
  const [started, setStarted] = useState(false)

  const w = parseFloat(weight)
  const h = parseFloat(height)
  const bf = parseFloat(bodyFat)

  const result = useMemo(() => {
    if (!w || w <= 0) return null
    const bmi = h > 0 ? w / Math.pow(h / 100, 2) : null
    const highBF = !isNaN(bf) && bf >= BF_THRESHOLD[gender]
    const highBMI = bmi !== null && bmi >= BMI_THRESHOLD
    const useTarget = highBF || highBMI
    const calcWeight = useTarget ? Math.round(w * (1 - cutPct / 100) * 10) / 10 : w
    const macros = calcMacros(calcWeight, gender, tier)
    const kcal = kcalOf(macros)
    const [mLow, mHigh] = maintenanceRange(w)
    // 缺口范围：对维持热量低端缺口最大
    const deficitHigh = (1 - kcal / mLow) * 100
    const deficitLow = (1 - kcal / mHigh) * 100
    return { bmi, useTarget, calcWeight, macros, kcal, mLow, mHigh, deficitLow, deficitHigh }
  }, [w, h, bf, gender, tier, cutPct])

  const coeff = COEFFS[gender][tier]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>宏量计算器</CardTitle>
          <CardDescription>
            按方案 3.1–3.3 节计算你的每日碳水 / 蛋白质 / 脂肪目标。蛋白质全程固定，脂肪设地板，碳水是唯一调节变量。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* 性别 */}
          <div className="space-y-2">
            <Label>性别</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['male', 'female'] as Gender[]).map((g) => (
                <Button
                  key={g}
                  variant={gender === g ? 'default' : 'outline'}
                  onClick={() => setGender(g)}
                >
                  {g === 'male' ? '男性' : '女性'}
                </Button>
              ))}
            </div>
          </div>

          {/* 体重 / 身高 / 体脂 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="weight">当前体重（kg）*</Label>
              <Input
                id="weight"
                type="number"
                inputMode="decimal"
                placeholder="如 85"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">身高（cm，可选）</Label>
              <Input
                id="height"
                type="number"
                inputMode="decimal"
                placeholder="用于 BMI 判断"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bf">体脂率（%，可选）</Label>
              <Input
                id="bf"
                type="number"
                inputMode="decimal"
                placeholder={gender === 'male' ? '≥25 启用目标体重' : '≥32 启用目标体重'}
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
              />
            </div>
          </div>

          {/* 训练档位 */}
          <div className="space-y-2">
            <Label>每周训练时长（方案 3.2 系数档）</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TIER_LABELS.map((label, i) => (
                <Button
                  key={label}
                  variant={tier === i ? 'default' : 'outline'}
                  className="flex flex-col h-auto py-2"
                  onClick={() => setTier(i as Tier)}
                >
                  <span>{label}</span>
                  <span className="text-xs opacity-70">{TIER_SESSIONS[i]}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* 目标体重滑块 */}
          {result?.useTarget && (
            <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                BMI ≥ 28 或体脂率超标（男 ≥25% / 女 ≥32%），按方案 3.1 使用目标体重计算
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>目标体重下调幅度</span>
                  <span className="font-semibold">{cutPct}%</span>
                </div>
                <Slider
                  min={10}
                  max={15}
                  step={0.5}
                  value={[cutPct]}
                  onValueChange={(v) => setCutPct(v[0])}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>10%</span>
                  <span>15%</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 结果 */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" />
              你的每日目标
            </CardTitle>
            <CardDescription>
              计算体重 <b className="text-foreground">{result.calcWeight} kg</b>
              {result.useTarget && `（当前 ${w} kg − ${cutPct}%）`}
              {result.bmi !== null && ` ｜ BMI ${result.bmi.toFixed(1)}`}
              　×　系数 碳水 {coeff.carb} / 蛋白 {coeff.protein} / 脂肪 {coeff.fat} g/kg
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <div className="text-xs text-muted-foreground">碳水</div>
                <div className="text-2xl font-bold text-emerald-700">{result.macros.carb} g</div>
              </div>
              <div className="rounded-lg bg-sky-50 p-3 text-center">
                <div className="text-xs text-muted-foreground">蛋白质</div>
                <div className="text-2xl font-bold text-sky-700">{result.macros.protein} g</div>
              </div>
              <div className="rounded-lg bg-orange-50 p-3 text-center">
                <div className="text-xs text-muted-foreground">脂肪</div>
                <div className="text-2xl font-bold text-orange-700">{result.macros.fat} g</div>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>每日总热量（碳水×4 + 蛋白×4 + 脂肪×9）</span>
                <b>{result.kcal} kcal</b>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>估算维持热量（体重 × 30–33）</span>
                <span>
                  {result.mLow}–{result.mHigh} kcal
                </span>
              </div>
              <div className="flex justify-between">
                <span>热量缺口（目标 15–25%）</span>
                <b>
                  {result.deficitLow.toFixed(0)}–{result.deficitHigh.toFixed(0)}%
                </b>
              </div>
            </div>

            {result.deficitHigh > 30 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>缺口超过 30%</AlertTitle>
                <AlertDescription>
                  当前热量相对维持热量（低端估算）缺口达 {result.deficitHigh.toFixed(0)}
                  %，超过方案上限 30%，不利于保肌肉和长期坚持。建议选择更高训练档或确认输入无误。
                </AlertDescription>
              </Alert>
            )}
            {result.deficitHigh <= 30 && result.deficitLow < 10 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>缺口可能偏小</AlertTitle>
                <AlertDescription>
                  相对维持热量高端估算缺口不足 10%，若减脂进展缓慢可按 4.2 节规则逐步下调碳水。
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                onStart({
                  gender,
                  tier,
                  startWeight: w,
                  calcWeight: result.calcWeight,
                  macros: result.macros,
                  startDate: plan?.startDate ?? todayStr(),
                })
                setStarted(true)
                setTimeout(() => setStarted(false), 2500)
              }}
            >
              <Rocket className="mr-2 h-4 w-4" />
              {plan ? '更新计划目标' : '开始计划'}
            </Button>
            {(plan || started) && (
              <p className="text-center text-sm text-muted-foreground">
                {started
                  ? '✅ 已保存！体重追踪、训练打卡等模块已解锁。'
                  : plan && `计划进行中：开始于 ${plan.startDate}，目标 ${plan.macros.carb}/${plan.macros.protein}/${plan.macros.fat} g。`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* 系数速查表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">系数表（方案 3.2 修正版）</CardTitle>
          <CardDescription>蛋白质全程固定不动，脂肪不低于 0.8 g/kg 地板，碳水是唯一调节变量。</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-2">每周训练</th>
                <th className="py-2 pr-2">碳水</th>
                <th className="py-2 pr-2">蛋白</th>
                <th className="py-2">脂肪</th>
              </tr>
            </thead>
            <tbody>
              {COEFFS[gender].map((c, i) => (
                <tr key={i} className={i === tier ? 'bg-emerald-50 font-medium' : ''}>
                  <td className="py-2 pr-2">
                    {TIER_LABELS[i]}
                    {i === tier && <Badge className="ml-2" variant="secondary">当前</Badge>}
                  </td>
                  <td className="py-2 pr-2">{c.carb} g/kg</td>
                  <td className="py-2 pr-2">{c.protein} g/kg</td>
                  <td className="py-2">{c.fat} g/kg</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            当前显示{gender === 'male' ? '男性' : '女性'}系数；女性碳水略低、脂肪略高，保护激素水平。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
