import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UtensilsCrossed, BookOpenCheck, Scale } from 'lucide-react'
import { FOOD_SWAPS, MEAL_TEMPLATE, type Plan } from '@/lib/plan'

interface Props {
  plan: Plan | null
}

export default function Meals({ plan }: Props) {
  const total = MEAL_TEMPLATE.reduce(
    (s, m) => ({ carb: s.carb + m.carb, protein: s.protein + m.protein, fat: s.fat + m.fat }),
    { carb: 0, protein: 0, fat: 0 },
  )
  const totalKcal = total.carb * 4 + total.protein * 4 + total.fat * 9

  return (
    <div className="space-y-4">
      {/* 一日餐单模板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            一日五餐模板（方案 6.2）
          </CardTitle>
          <CardDescription>
            85 kg 男性修正版示例（目标 碳水 212 / 蛋白 145 / 脂肪 77 ≈ 2121 kcal）。数值为约数，以你的食物秤和记录
            App 实际数据为准。
            {plan &&
              ` 你的目标是 ${plan.macros.carb}/${plan.macros.protein}/${plan.macros.fat} g，可按比例增减主食和肉量。`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3 whitespace-nowrap">餐次</th>
                <th className="py-2 pr-3">食物</th>
                <th className="py-2 pr-2 text-right">碳水</th>
                <th className="py-2 pr-2 text-right">蛋白</th>
                <th className="py-2 text-right">脂肪</th>
              </tr>
            </thead>
            <tbody>
              {MEAL_TEMPLATE.map((m) => (
                <tr key={m.meal} className="border-b last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap font-medium">{m.meal}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{m.food}</td>
                  <td className="py-2 pr-2 text-right">{m.carb} g</td>
                  <td className="py-2 pr-2 text-right">{m.protein} g</td>
                  <td className="py-2 text-right">{m.fat} g</td>
                </tr>
              ))}
              <tr className="font-semibold bg-emerald-50">
                <td className="py-2 pr-3">合计</td>
                <td className="py-2 pr-3 text-muted-foreground font-normal">
                  对照目标偏差 &lt; 5%，记录时按实测微调
                </td>
                <td className="py-2 pr-2 text-right">{total.carb} g</td>
                <td className="py-2 pr-2 text-right">{total.protein} g</td>
                <td className="py-2 text-right">{total.fat} g</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-sm">
            合计热量 ≈ <b>{totalKcal} kcal</b>
          </p>
        </CardContent>
      </Card>

      {/* 食物替换表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpenCheck className="h-5 w-5 text-primary" />
            食物替换表（方案 6.3）
          </CardTitle>
          <CardDescription>同类替换后必须按实际营养成分重新核算，不做「等重替换」。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-sky-700">蛋白质来源</p>
            <div className="flex flex-wrap gap-2">
              {FOOD_SWAPS.protein.map((f) => (
                <Badge key={f} variant="secondary" className="bg-sky-50 text-sky-800">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-emerald-700">碳水来源</p>
            <div className="flex flex-wrap gap-2">
              {FOOD_SWAPS.carb.map((f) => (
                <Badge key={f} variant="secondary" className="bg-emerald-50 text-emerald-800">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-orange-700">脂肪来源</p>
            <div className="flex flex-wrap gap-2">
              {FOOD_SWAPS.fat.map((f) => (
                <Badge key={f} variant="secondary" className="bg-orange-50 text-orange-800">
                  {f}
                </Badge>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <p>🥬 蔬菜每天 400–600 g，不计热量，是缺口期对抗饥饿的主力。</p>
            <p>💧 饮水：体重 kg × 35–40 ml{plan ? `（你约 ${Math.round(plan.calcWeight * 35)}–${Math.round(plan.calcWeight * 40)} ml）` : ''}。</p>
            <p>🍺 酒精尽量归零：7 kcal/g，且抑制脂肪氧化和肌肉合成。</p>
          </div>
        </CardContent>
      </Card>

      {/* 记账口径 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-5 w-5 text-primary" />
            记账口径（方案 6.1）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              <b className="text-foreground">所有入口的东西都计入</b>
              ：水果、坚果、酱料、饮料、烹调油全部入账——漏掉这些会少记 150–200 kcal。
            </li>
            <li>
              米饭面条按<b className="text-foreground">生重</b>计；肉类按
              <b className="text-foreground">可食部生重</b>（去皮去骨）计；蔬菜不计热量但计入饱腹感规划。
            </li>
            <li>厨房食物秤（精度 1 g）是本方案的根基，估重误差足以吃掉整个热量缺口。</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
