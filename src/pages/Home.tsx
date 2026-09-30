import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Calculator as CalcIcon, Scale, Dumbbell, UtensilsCrossed, BookOpen, Lock } from 'lucide-react'
import Calculator from '@/sections/Calculator'
import WeightTracker from '@/sections/WeightTracker'
import Training from '@/sections/Training'
import Meals from '@/sections/Meals'
import Rules from '@/sections/Rules'
import { useLocalStorage } from '@/lib/store'
import type { Plan } from '@/lib/plan'

const TABS = [
  { id: 'calc', label: '宏量计算', icon: CalcIcon, needPlan: false },
  { id: 'weight', label: '体重追踪', icon: Scale, needPlan: true },
  { id: 'training', label: '训练打卡', icon: Dumbbell, needPlan: true },
  { id: 'meals', label: '餐单食库', icon: UtensilsCrossed, needPlan: false },
  { id: 'rules', label: '规则速查', icon: BookOpen, needPlan: false },
]

function Locked() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <Lock className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          请先在「宏量计算」页完成计算并点击「开始计划」，即可解锁本模块。
        </p>
      </CardContent>
    </Card>
  )
}

export default function Home() {
  const [plan, setPlan] = useLocalStorage<Plan | null>('jzzj_plan', null)
  const [tab, setTab] = useState(() => {
    const h = window.location.hash.replace('#', '')
    return TABS.some((t) => t.id === h) ? h : 'calc'
  })

  const changeTab = (v: string) => {
    setTab(v)
    window.location.hash = v
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <h1 className="text-lg font-bold text-emerald-700">💪 减脂增肌助手</h1>
          <p className="text-xs text-muted-foreground">
            12 周减脂 + 4 周反向过渡 ｜ 热量缺口是发动机，蛋白质是锚，抗阻训练是方向盘
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 pt-4 sm:pb-10">
        <Tabs value={tab} onValueChange={changeTab}>
          {/* 桌面/平板顶部 tab；移动端固定底部导航 */}
          <TabsList className="sticky top-[57px] z-10 mb-4 hidden w-full grid-cols-5 sm:grid">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="calc">
            <Calculator plan={plan} onStart={setPlan} />
          </TabsContent>
          <TabsContent value="weight">{plan ? <WeightTracker plan={plan} onRecalc={setPlan} /> : <Locked />}</TabsContent>
          <TabsContent value="training">{plan ? <Training plan={plan} /> : <Locked />}</TabsContent>
          <TabsContent value="meals">
            <Meals plan={plan} />
          </TabsContent>
          <TabsContent value="rules">
            <Rules plan={plan} />
          </TabsContent>
        </Tabs>
      </main>

      {/* 移动端底部导航 */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        <div className="grid grid-cols-5">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => changeTab(t.id)}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                  active ? 'text-emerald-700 font-semibold' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
