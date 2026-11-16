import type { Lang } from './data/plan'

/** [Arabic (Syrian dialect), English] */
const dict = {
  appName: ['برنامج الجيم', 'Gym Plan'],
  appSub: ['٣ أيام بالأسبوع · Gold\'s Gym', '3 days a week · Gold\'s Gym'],
  navHome: ['الرئيسية', 'Home'],
  navWeek: ['الأسبوع', 'Week'],
  navWorkout: ['التمرين', 'Workout'],
  navHistory: ['السجل', 'History'],
  settings: ['الإعدادات', 'Settings'],
  whoTrains: ['مين عم يتمرن؟', 'Who\'s training?'],
  todaySuggested: ['تمرين اليوم المقترح', 'Suggested for today'],
  startWorkout: ['ابدأ التمرين', 'Start workout'],
  continueWorkout: ['كمّل التمرين', 'Continue workout'],
  weekProgress: ['تقدّم هالأسبوع', 'This week'],
  sessionsOf: ['{a} من {b} تمارين', '{a} of {b} sessions'],
  weekDone: ['برافو! خلصت تمارين الأسبوع 💪', 'Well done! Week complete 💪'],
  streak: ['أسابيع متتالية', 'Week streak'],
  streakHint: ['أسابيع ورا بعض فيها تمرين واحد عالأقل', 'Consecutive weeks with at least one session'],
  totalSessions: ['كل التمارين', 'Total sessions'],
  restDay: ['راحة', 'Rest'],
  schedule: ['جدول الأسبوع', 'Weekly schedule'],
  day: ['اليوم', 'Day'],
  workout: ['التمرين', 'Workout'],
  scheduleTip: [
    'فيكن تختاروا أي ٣ أيام، المهم يكون في يوم راحة بين كل تمرينين.',
    'You can pick any 3 days, as long as there is a rest day between sessions.',
  ],
  rulesTitle: ['طريقة التمرين', 'Training rules'],
  rule1: ['<b>٣ جولات</b> لكل تمرين (حسب غيث).', '<b>3 sets</b> per exercise (per Ghaith).'],
  rule2: [
    '<b>١٠–١٢ عدة</b> بكل جولة، وراحة <b>٦٠–٩٠ ثانية</b>. (غيث ما حدد عدد العدات – هاد اقتراح عام، اسألوه إذا بدو غير هيك.)',
    '<b>10–12 reps</b> per set, <b>60–90 s</b> rest. (Ghaith didn\'t specify reps – this is a general suggestion, ask him if he wants otherwise.)',
  ],
  rule3: [
    'اختار وزن تكون آخر عدتين فيه صعبين بس الحركة نظيفة. لما تكمّل ١٢ عدة بالـ٣ جولات، زيد الوزن المرة الجاية.',
    'Pick a weight where the last two reps are hard but form stays clean. Once you hit 12 reps on all 3 sets, add weight next time.',
  ],
  rule4: [
    'إحماء ٥–١٠ دقايق (عجلة أو مشاية) + جولة خفيفة من أول تمرين.',
    'Warm up 5–10 minutes (bike or treadmill) + one light set of the first exercise.',
  ],
  rule5: [
    'نفس البرنامج للتنين، بس الأوزان بتختلف. مي عندها إضافات صغيرة بآخر كل يوم (بطن، ضهر سفلي، أرداف) حسب هدفها.',
    'Same programme for both, only the weights differ. Mai has small extras at the end of each day (core, lower back, glutes) for her goals.',
  ],
  vocabTitle: ['كلمات بتفيد بالجيم', 'Useful gym German'],
  showMachine: ['شوف الجهاز', 'Machine'],
  showVideo: ['شوف التمرين', 'Watch'],
  setN: ['جولة {n}', 'Set {n}'],
  done: ['تم', 'Done'],
  optional: ['اختياري', 'Optional'],
  restTimer: ['مؤقت الراحة', 'Rest timer'],
  off: ['بدون', 'Off'],
  sec: ['ث', 's'],
  rest: ['راحة', 'Rest'],
  restOver: ['خلصت الراحة – يلا! 💪', 'Rest over – go! 💪'],
  skip: ['تخطي', 'Skip'],
  finishWorkout: ['إنهاء التمرين', 'Finish workout'],
  finishHint: ['علّم جولة وحدة عالأقل لتحفظ التمرين', 'Tick at least one set to save the session'],
  saved: ['انحفظ التمرين ✅', 'Workout saved ✅'],
  clearTicks: ['مسح العلامات', 'Clear ticks'],
  setsDone: ['{a} / {b} جولة', '{a} / {b} sets'],
  kg: ['كغ', 'kg'],
  noMachine: ['بدون جهاز', 'No machine'],
  equipment: ['الأدوات', 'Equipment'],
  howToSetup: ['طريقة ضبط الجهاز', 'How to set it up'],
  howToDo: ['طريقة التمرين', 'How to do it'],
  openMachinePage: ['فتح صفحة الجهاز', 'Open product page'],
  photoMissing: ['لسا ما في صورة', 'No photo yet'],
  noVideo: ['لسا ما في فيديو محدد لهالتمرين.', 'No video picked for this exercise yet.'],
  offlineVideo: ['ما في نت – الفيديو بيشتغل بس أونلاين.', 'You\'re offline – videos need a connection.'],
  searchYoutube: ['فتح البحث عاليوتيوب', 'Open YouTube search'],
  otherVideos: ['فيديوهات تانية عاليوتيوب', 'More videos on YouTube'],
  close: ['إغلاق', 'Close'],
  history: ['سجل التمارين', 'Workout history'],
  noSessions: ['لسا ما في تمارين محفوظة.', 'No saved sessions yet.'],
  delete: ['حذف', 'Delete'],
  confirmDelete: ['حذف هالتمرين من السجل؟', 'Delete this session from history?'],
  minutes: ['{n} د', '{n} min'],
  language: ['اللغة', 'Language'],
  weightLog: ['تسجيل الأوزان (كغ)', 'Weight logging (kg)'],
  weightLogHint: ['لما يتفعّل بيطلع حقل وزن تحت كل جولة.', 'When on, a weight field appears under each set.'],
  restTimerHint: ['بيبدأ لحاله بعد كل جولة وبيهز الموبايل لما يخلص.', 'Starts automatically after each set and vibrates when done.'],
  sync: ['المزامنة بين الموبايلين', 'Sync between phones'],
  syncOffHint: [
    'Firebase مو مفعّل – التطبيق شغّال محلياً عهالموبايل بس. شوف ملف README للتفعيل.',
    'Firebase isn\'t configured – the app runs locally on this phone only. See the README to enable it.',
  ],
  household: ['كود البيت', 'Household code'],
  householdHint: ['نفس الكود عالموبايلين (٦ أحرف عالأقل).', 'Same code on both phones (at least 6 characters).'],
  save: ['حفظ', 'Save'],
  syncNow: ['مزامنة هلأ', 'Sync now'],
  syncing: ['عم يزامن…', 'Syncing…'],
  syncOk: ['آخر مزامنة: {t}', 'Last sync: {t}'],
  syncErr: ['فشلت المزامنة: {e}', 'Sync failed: {e}'],
  syncNeedCode: ['دخّل كود البيت لتبدأ المزامنة.', 'Enter a household code to start syncing.'],
  pending: ['{n} بانتظار المزامنة', '{n} waiting to sync'],
} satisfies Record<string, [string, string]>

export type TKey = keyof typeof dict

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
/** Localise digits: Arabic-Indic numerals in Arabic, Latin in English. */
export const num = (v: number | string, lang: Lang) =>
  lang === 'ar' ? String(v).replace(/\d/g, (d) => AR_DIGITS[+d]) : String(v)

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>) {
  let s: string = dict[key][lang === 'ar' ? 0 : 1]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, num(v, lang))
  return s
}

export const locale = (lang: Lang) => (lang === 'ar' ? 'ar-SY-u-nu-arab' : 'en-GB')
