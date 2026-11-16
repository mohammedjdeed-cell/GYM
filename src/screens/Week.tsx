import { plan } from '../data/plan'
import { locale } from '../i18n'
import type { TKey } from '../i18n'
import { useStore, useT } from '../store'
import { Card, De, Rich } from '../components/ui'

const VOCAB: { ar: string; en: string; de: string }[] = [
  { ar: 'جولة / عدة', en: 'Set / rep', de: 'Satz / Wiederholung' },
  { ar: 'الوزن', en: 'The weight', de: 'das Gewicht' },
  { ar: 'الجهاز', en: 'The machine', de: 'das Gerät' },
  { ar: 'الحبل / الكيبل', en: 'The cable', de: 'der Kabelzug' },
  { ar: 'المقعد', en: 'The bench', de: 'die Bank' },
  { ar: 'الراسية / المسكة', en: 'The handle', de: 'der Griff' },
  { ar: 'لسا عم تستعمل الجهاز؟', en: 'Are you still using the machine?', de: 'Brauchst du das Gerät noch?' },
  { ar: 'فيني اتبادل معك؟', en: 'Can I work in with you?', de: 'Kann ich mich abwechseln?' },
]
const RULES: TKey[] = ['rule1', 'rule2', 'rule3', 'rule4', 'rule5']

export function Week() {
  const lang = useStore().settings.lang
  const t = useT()
  const wd = new Intl.DateTimeFormat(locale(lang), { weekday: 'long' })
  // 2024-01-01 was a Monday
  const rows = Array.from({ length: 7 }, (_, i) => {
    const jsDay = (i + 1) % 7
    return { name: wd.format(new Date(2024, 0, 1 + i)), day: plan.days.find((d) => d.weekday === jsDay), today: new Date().getDay() === jsDay }
  })

  return (
    <>
      <Card className="mb-3">
        <h2 className="mb-2 text-lg font-bold">{t('schedule')}</h2>
        <table className="w-full border-collapse text-[.95rem]">
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} className={`border-b border-line last:border-0 ${r.today ? 'font-bold text-accentink' : ''}`}>
                <td className="w-28 py-2.5 pe-2 align-top">{r.name}</td>
                <td className="py-1">
                  {r.day ? (
                    <a href={`#/workout/${r.day.id}`} className="flex min-h-12 flex-col justify-center">
                      <b className={r.today ? '' : 'text-ink'}>{r.day.title[lang]}</b>
                      <De className="text-xs">{r.day.de}</De>
                    </a>
                  ) : (
                    <span className="flex min-h-9 items-center text-muted">{t('restDay')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-muted">{t('scheduleTip')}</p>
      </Card>

      <Card className="mb-3">
        <h2 className="mb-2 text-lg font-bold">{t('rulesTitle')}</h2>
        <ul className="list-disc space-y-1.5 ps-5 text-[.95rem] text-muted">
          {RULES.map((k) => (
            <li key={k}><Rich text={t(k)} /></li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 text-lg font-bold">{t('vocabTitle')}</h2>
        <table className="w-full border-collapse text-[.92rem]">
          <tbody>
            {VOCAB.map((v) => (
              <tr key={v.de} className="border-b border-line last:border-0">
                <td className="py-2 pe-2">{v[lang]}</td>
                <td className="py-2"><De>{v.de}</De></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}
