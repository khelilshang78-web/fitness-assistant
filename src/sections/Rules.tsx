import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Zap, OctagonAlert, TrendingUp, CalendarClock } from 'lucide-react'
import { RED_FLAGS, type Plan } from '@/lib/plan'

interface Props {
  plan: Plan | null
}

export default function Rules({ plan }: Props) {
  const cw = plan?.calcWeight
  return (
    <div className="space-y-4">
      {/* 高碳日 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-primary" />
            高碳日规则（方案 4.3 修正版）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
            <li>
              <b className="text-foreground">频率</b>：每 10–14 天 1 次，安排在
              <b className="text-foreground">训练强度最大的一天</b>（如深蹲日），不按固定日历。
            </li>
            <li>
              <b className="text-foreground">算法</b>：碳水 +1.5~2.0 g/kg
              {cw ? `（你约 +${Math.round(cw * 1.5)}~${Math.round(cw * 2)} g）` : ''}，
              <b className="text-foreground">蛋白质不变</b>，脂肪 −0.3 g/kg
              {cw ? `（约 −${Math.round(cw * 0.3)} g）` : ''}。
            </li>
            <li>
              <b className="text-foreground">定性</b>：是计划的一部分，不是放纵日；全部食物照常称重记录。
            </li>
            <li>作用是补充肌糖原、维持训练质量、缓解心理疲劳；它不「重启代谢」，不要指望它突破平台期。</li>
          </ul>
          {plan && (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm">
              高碳日示例目标：碳水约 {plan.macros.carb + Math.round(plan.calcWeight * 1.5)}–
              {plan.macros.carb + Math.round(plan.calcWeight * 2)} g ｜ 蛋白 {plan.macros.protein} g（不变）｜ 脂肪约{' '}
              {plan.macros.fat - Math.round(plan.calcWeight * 0.3)} g
            </div>
          )}
        </CardContent>
      </Card>

      {/* 红灯指标 */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-700">
            <OctagonAlert className="h-5 w-5" />
            红灯停损指标（方案八）
          </CardTitle>
          <CardDescription>出现以下任何一条，立即停止热量缺口。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-2">
            {RED_FLAGS.map((r) => (
              <li key={r} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                {r}
              </li>
            ))}
          </ul>
          <Alert variant="destructive">
            <AlertTitle>处理方式</AlertTitle>
            <AlertDescription>
              直接进入饮食休息周（碳水加到维持水平），休息 1–2 周再评估；症状持续则就医。
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* 反向过渡 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-primary" />
            反向过渡规则（方案七，第 13–16 周）
          </CardTitle>
          <CardDescription>这是决定一年后你还在不在原地的一步。</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <b className="text-foreground">第 13 周</b>：碳水 +25 g/天，其余不变。
            </li>
            <li>
              <b className="text-foreground">第 14–16 周</b>：每周再 +20–25 g
              碳水，直到体重连续 2 周稳定（±0.5 kg 内波动）。
            </li>
            <li>过渡期体重回升 1–2 kg（糖原+水分）属正常，腰围不回升才算真成功。</li>
            <li>
              之后进入维持期：保持训练、保持称重习惯（每周 2–3 次）；体重上浮超过过渡后基线 2 kg
              时，回到 4.2 的调整规则微调。
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* 监测节奏 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="h-5 w-5 text-primary" />
            监测节奏（方案 4.1）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li><b className="text-foreground">每天</b>早晨空腹、排便后称重，记录但不解读单日数字。</li>
            <li><b className="text-foreground">每 7 天</b>算一次 7 天平均体重，每周量一次腰围。</li>
            <li><b className="text-foreground">每 10 天</b>为一个决策窗口，对比两个窗口的平均体重。</li>
            <li>不要因为两三天的波动改方案——单日 ±1 kg 都是噪声（水分、糖原、肠道内容物）。</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
