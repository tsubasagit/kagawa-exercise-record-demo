// 医師用・患者さん用・看護師／研究用の3画面で共有する部分。
// デモ版はこの端末のブラウザ（localStorage）にだけ保存する。本番は Firebase に置き換える。
//
// 方針：医学的な判断は医師が行う。アプリは「記録・計算・表示・共有」だけを担当する。
//  - 目標と運動内容は、医師が入力した内容をそのまま表示する（アプリは選ばない・変えない）
//  - 測定値（InBody など）は取り込んで表示するだけで、運動の選択には使わない
//  - 計算は引き算・割り算だけ。「改善」「悪化」「正常」などの評価の言葉や、基準値による色分けはしない
const STORE_KEY = "kankatsu_demo_exercise_v1";
const PROFILE_KEY = "kankatsu_demo_profile_v1";
const PLAN_KEY = "kankatsu_demo_plans_v1";        // 医師が設定した目標・運動内容（研究IDごと）
const MEASURE_KEY = "kankatsu_demo_measures_v1";  // 取り込んだ・入力した測定値

// 運動の種類と強さ（METs）。消費カロリーは「目安」としてだけ使う。
const EXERCISES = [
  { id: "walk", name: "ウォーキング", mets: 3.5 },
  { id: "brisk", name: "早歩き", mets: 4.3 },
  { id: "jog", name: "ジョギング", mets: 7.0 },
  { id: "bike", name: "自転車", mets: 6.8 },
  { id: "swim", name: "水泳", mets: 6.0 },
  { id: "stretch", name: "ストレッチ・体操", mets: 2.5 },
  { id: "muscle", name: "筋トレ（自宅）", mets: 3.5 },
  { id: "other", name: "その他", mets: 3.0 },
];

// 医師が目標に選べる測定項目
const METRICS = [
  { id: "bodyFat", label: "体脂肪率", unit: "％", diffUnit: "パーセントポイント" },
  { id: "weight", label: "体重", unit: "kg", diffUnit: "kg" },
  { id: "muscle", label: "骨格筋量", unit: "kg", diffUnit: "kg" },
];
function metricOf(id) { return METRICS.find(m => m.id === id) || METRICS[0]; }

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}

function loadRecords() { return readJson(STORE_KEY, []); }
function saveRecords(records) { localStorage.setItem(STORE_KEY, JSON.stringify(records)); }
function loadProfile() { return readJson(PROFILE_KEY, {}); }
function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

// 医師の設定：{ [研究ID]: { current: {...}, history: [{...}, ...] } }
function loadPlans() { return readJson(PLAN_KEY, {}); }
function savePlans(p) { localStorage.setItem(PLAN_KEY, JSON.stringify(p)); }
function currentPlan(rid) { const p = loadPlans()[rid]; return p ? p.current : null; }

function loadMeasures() { return readJson(MEASURE_KEY, []); }
function saveMeasures(m) { localStorage.setItem(MEASURE_KEY, JSON.stringify(m)); }

function exerciseName(id) {
  const e = EXERCISES.find(x => x.id === id);
  return e ? e.name : "—";
}

// 消費カロリーの目安 = METs × 体重(kg) × 時間(h) × 1.05
function estimateKcal(exerciseId, minutes, weightKg) {
  const e = EXERCISES.find(x => x.id === exerciseId);
  if (!e || !minutes || !weightKg) return null;
  return Math.round(e.mets * weightKg * (minutes / 60) * 1.05);
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr() { return dateStr(new Date()); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function parseDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function daysBetween(fromStr, toStr) { return Math.round((parseDate(toStr) - parseDate(fromStr)) / 86400000); }

function fmtNum(v) { return Number(Number(v).toFixed(1)).toString(); }

// ---- 測定値（InBody など）----
// 指定した項目の最新の値。{ date, value, source } か null
function latestMeasure(rid, metricId) {
  const rows = loadMeasures()
    .filter(m => m.researchId === rid && m[metricId] !== null && m[metricId] !== undefined && m[metricId] !== "")
    .sort((a, b) => b.date.localeCompare(a.date));
  return rows.length ? { date: rows[0].date, value: Number(rows[0][metricId]), source: rows[0].source } : null;
}

// ---- 目標との比較（引き算と割り算だけ）----
// 戻り値：{ metric, current, currentDate, goal, start, remaining, reached, ratio, message } か null
function goalStatus(rid) {
  const plan = currentPlan(rid);
  if (!plan || plan.goal === null || plan.goal === undefined || plan.goal === "") return null;
  const metric = metricOf(plan.metric);
  const cur = latestMeasure(rid, metric.id);
  const out = { metric, plan, goal: Number(plan.goal), start: Number(plan.start), current: null, currentDate: null,
    remaining: null, reached: false, ratio: 0, message: "" };
  if (!cur) {
    out.message = `${metric.label}の測定値がまだありません。医師が設定した目標は ${fmtNum(out.goal)}${metric.unit} です。`;
    return out;
  }
  out.current = cur.value; out.currentDate = cur.date;
  const dir = out.goal < out.start ? -1 : 1;
  out.remaining = (out.goal - cur.value) * dir;
  out.reached = out.remaining <= 0;
  out.ratio = out.goal === out.start ? (out.reached ? 1 : 0)
    : Math.max(0, Math.min(1, (cur.value - out.start) / (out.goal - out.start)));
  out.message = out.reached
    ? `現在の${metric.label}は${fmtNum(cur.value)}${metric.unit}です。医師が設定した目標${fmtNum(out.goal)}${metric.unit}に届いています。`
    : `現在の${metric.label}は${fmtNum(cur.value)}${metric.unit}です。医師が設定した目標${fmtNum(out.goal)}${metric.unit}まで、あと${fmtNum(out.remaining)}${metric.diffUnit}です。`;
  return out;
}

// ---- 今週（月〜日）の実施状況 ----
// 運動の種類と時間が入っている日を「実施した日」と数える
function weekStatus(rid, today = new Date()) {
  const plan = currentPlan(rid);
  const target = plan && Number(plan.daysPerWeek) ? Number(plan.daysPerWeek) : null;
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const recs = loadRecords().filter(r => r.researchId === rid && r.exercise && r.minutes);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(monday, i), s = dateStr(d);
    days.push({ label: "月火水木金土日"[i], date: s, future: s > dateStr(today), done: recs.some(r => r.date === s) });
  }
  const done = days.filter(d => d.done).length;
  return { days, done, target, rate: target ? Math.min(100, Math.round(done / target * 100)) : null };
}

// ---- 記録の途切れ（事実だけを伝える）----
function lastRecordDate(rid) {
  const ds = loadRecords().filter(r => r.researchId === rid).map(r => r.date).sort();
  return ds.length ? ds[ds.length - 1] : null;
}
// 3日以上あいたら「◯日間、運動記録がありません」。それ以外・記録ゼロのときは null
function gapNotice(rid, today = new Date()) {
  const last = lastRecordDate(rid);
  if (!last) return null;
  const gap = daysBetween(last, dateStr(today));
  return gap >= 3 ? `${gap}日間、運動記録がありません` : null;
}

function knownResearchIds() {
  const s = new Set();
  loadRecords().forEach(r => s.add(r.researchId));
  loadMeasures().forEach(m => s.add(m.researchId));
  Object.keys(loadPlans()).forEach(k => s.add(k));
  return [...s].filter(Boolean).sort();
}

// ---- デモデータ（架空の研究ID 3人）。何度押しても同じ内容に戻る ----
const DEMO_IDS = ["K-001", "K-002", "K-003"];
function seedDemo() {
  const today = new Date();
  const T = n => dateStr(addDays(today, -n));
  const now = today.toISOString();
  const people = [
    { id: "K-001", w: 82, plan: { metric: "bodyFat", start: 30, goal: 28, exerciseText: "毎日30分のウォーキング", daysPerWeek: 5 },
      measures: [[30, 30.0, 25.1], [21, 29.6, 24.8], [10, 29.3, 24.6], [2, 29.0, 24.5]],
      ex: ["walk", 30], skipEvery: 2, lastGap: 0 },
    { id: "K-002", w: 70, plan: { metric: "weight", start: 72, goal: 68, exerciseText: "週3日、自転車を30分", daysPerWeek: 3 },
      measures: [[28, 72.0, null], [14, 71.2, null], [3, 70.4, null]],
      ex: ["bike", 30], skipEvery: 2, lastGap: 1 },
    { id: "K-003", w: 75, plan: { metric: "bodyFat", start: 34, goal: 31, exerciseText: "ストレッチ・体操を毎日15分", daysPerWeek: 7 },
      measures: [[25, 34.0, 23.0], [9, 33.2, 23.1], [5, 32.5, 23.2]],
      ex: ["stretch", 15], skipEvery: 3, lastGap: 4 },
  ];

  const recs = loadRecords().filter(r => !DEMO_IDS.includes(r.researchId));
  const meas = loadMeasures().filter(m => !DEMO_IDS.includes(m.researchId));
  const plans = loadPlans();
  for (const p of people) {
    for (let i = 29; i >= p.lastGap; i--) {
      if (i % p.skipEvery === 0 && i !== p.lastGap) continue;
      const date = T(i);
      const [exId, min] = p.ex;
      recs.push({
        id: `${p.id}-${date}`, researchId: p.id, date,
        steps: 4500 + ((i * 937) % 6000), exercise: exId, minutes: min, kcal: estimateKcal(exId, min, p.w),
        memo: "", createdAt: now,
      });
    }
    for (const [ago, bf, muscle] of p.measures) {
      const isWeight = p.plan.metric === "weight";
      meas.push({
        id: `${p.id}-m-${ago}`, researchId: p.id, date: T(ago),
        bodyFat: isWeight ? null : bf, weight: isWeight ? bf : p.w, muscle, source: "デモデータ",
      });
    }
    plans[p.id] = { current: { ...p.plan, updatedAt: now, updatedBy: "医師（デモ）" }, history: [{ ...p.plan, updatedAt: now, updatedBy: "医師（デモ）" }] };
  }
  saveRecords(recs); saveMeasures(meas); savePlans(plans);
}

// ?demo=1 で開いたとき、まだ何も入っていなければデモデータを入れる
function seedIfDemoRequested() {
  if (new URLSearchParams(location.search).get("demo") === "1" && !Object.keys(loadPlans()).length) seedDemo();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
