import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dumbbell, Footprints, HeartPulse } from 'lucide-react'
import {
  PROGRAM_A,
  PROGRAM_B,
  currentPhase,
  todayStr,
  type Plan,
  type TrainingDay,
} from '@/lib/plan'
import { useLocalStorage } from '@/lib/store'

interface Props {
  plan: Plan
}

interface TrainingState {
  program: 'A' | 'B'
  checks: Record<string, boolean> // key: `${week}-${dayIdx}-${exIdx}` 或 `${week}-rest-${dayIdx}`
}

interface WeightLog {
  [exerciseName: string]: { date: string; kg: number }[]
}

interface CardioLog {
  [date: string]: { zone2: boolean; steps: number | null }
}

export default function Training({ plan }: Props) {
  const [state, setState] = useLocalStorage<TrainingState>('jzzj_training', { program: 'A', checks: {} })
  const [weightLog, setWeightLog] = useLocalStorage<WeightLog>('jzzj_lift_weights', {})
  const [cardio, setCardio] = useLocalStorage<CardioLog>('jzzj_cardio', {})
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({})

  const phase = useMemo(() => currentPhase(plan.startDate), [plan.startDate])
  const week = Math.max(1, Math.ceil(phase.day / 7))
  const days: TrainingDay[] = state.program === 'A' ? PROGRAM_A : PROGRAM_B
  const today = todayStr()
  const todayCardio = cardio[today] ?? { zone2: false, steps: null }

  const toggle = (key: string) =>
    setState((s) => ({ ...s, checks: { ...s.checks, [key]: !s.checks[key] } }))

  const addWeight = (name: string) => {
    const v = parseFloat(weightInputs[name] ?? '')
    if (!v || v <= 0) return
    setWeightLog((log) => {
      const list = [...(log[name] ?? [])]
      // 同一天覆盖
      const idx = list.findIndex((r) => r.date === today)
      if (idx >= 0) list[idx] = { date: today, kg: v }
      else list.push({ date: today, kg: v })
      return { ...log, [name]: list }
    })
    setWeightInputs((m) => ({ ...m, [name]: '' }))
  }

  const setTodayCardio = (patch: Partial<{ zone2: boolean; steps: number | null }>) =>
    setCardio((c) => ({ ...c, [today]: { ...todayCardio, ...patch } }))

  return (
    <div className="space-y-4">
      {/* 方案选择 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="h-5 w-5 text-primary" />
            抗阻训练（方案 5.1）
          </CardTitle>
          <CardDescription>
            减脂期训练的第一目标是给肌肉一个留下的理由。当前为计划第 {week} 周，勾选本周完成情况。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              variant={state.program === 'A' ? 'default' : 'outline'}
              className="h-auto flex-col py-3"
              onClick={() => setState((s) => ({ ...s, program: 'A' }))}
            >
              <span className="font-semibold">方案 A · 每周 4 次上下肢分化</span>
              <span className="text-xs opacity-70">推荐每周能练 4 小时以上者</span>
            </Button>
            <Button
              variant={state.program === 'B' ? 'default' : 'outline'}
              className="h-auto flex-col py-3"
              onClick={() => setState((s) => ({ ...s, program: 'B' }))}
            >
              <span className="font-semibold">方案 B · 每周 3 次全身训练</span>
              <span className="text-xs opacity-70">推荐每周 2–3 小时者</span>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            渐进超负荷（双重渐进）：某动作所有组都能做到次数上限时，下次加 2.5 kg（上肢）或 5
            kg（下肢），回到次数下限重新爬。若某动作连续 2 周表现下降超过 10%，按 4.2 节加碳水。
          </p>
        </CardContent>
      </Card>

      {/* 每周模板 */}
      {days.map((day, di) => (
        <Card key={`${state.program}-${di}`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{day.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {day.rest ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`rest-${di}`}
                  checked={!!state.checks[`${week}-rest-${di}`]}
                  onCheckedChange={() => toggle(`${week}-rest-${di}`)}
                />
                <label htmlFor={`rest-${di}`} className="text-sm">
                  已完成（休息 / Zone 2 有氧 / 散步）
                </label>
              </div>
            ) : (
              day.exercises.map((ex, ei) => {
                const key = `${week}-${di}-${ei}`
                const log = weightLog[ex.name]
                const lastW = log && log.length ? log[log.length - 1] : null
                const prevW = log && log.length > 1 ? log[log.length - 2] : null
                return (
                  <div key={key} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox id={key} checked={!!state.checks[key]} onCheckedChange={() => toggle(key)} />
                      <label htmlFor={key} className="flex-1 text-sm font-medium">
                        {ex.name}
                      </label>
                      <Badge variant="secondary">{ex.sets}</Badge>
                    </div>
                    {ex.trackWeight && (
                      <div className="flex items-center gap-2 pl-7">
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="重量 kg"
                          className="h-8 w-24"
                          value={weightInputs[ex.name] ?? ''}
                          onChange={(e) => setWeightInputs((m) => ({ ...m, [ex.name]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addWeight(ex.name)}
                        />
                        <Button size="sm" variant="outline" onClick={() => addWeight(ex.name)}>
                          记录
                        </Button>
                        {lastW && (
                          <span className="text-xs text-muted-foreground">
                            上次 {lastW.kg} kg（{lastW.date.slice(5)}）
                            {prevW &&
                              (lastW.kg > prevW.kg ? ' ↑' : lastW.kg < prevW.kg ? ' ↓' : ' →')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      ))}

      {/* 有氧与步数 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HeartPulse className="h-5 w-5 text-primary" />
            有氧与日常活动（方案 5.2）
          </CardTitle>
          <CardDescription>
            Zone 2 有氧每周 2–3 次、每次 25–40 分钟；每日步数 8000–10000 步——盯住步数比加练更重要。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="zone2"
              checked={todayCardio.zone2}
              onCheckedChange={(v) => setTodayCardio({ zone2: !!v })}
            />
            <label htmlFor="zone2" className="text-sm">
              今天已完成 Zone 2 有氧（能说话不能唱歌的强度，25–40 分钟）
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Footprints className="h-4 w-4 text-muted-foreground" />
            <Input
              type="number"
              inputMode="numeric"
              placeholder="今日步数"
              className="w-32"
              value={todayCardio.steps ?? ''}
              onChange={(e) =>
                setTodayCardio({ steps: e.target.value ? parseInt(e.target.value, 10) : null })
              }
            />
            {todayCardio.steps !== null && (
              <Badge variant={todayCardio.steps >= 8000 ? 'default' : 'outline'}>
                {todayCardio.steps >= 8000
                  ? '✅ 达标'
                  : `还差 ${8000 - todayCardio.steps} 步到 8000`}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
