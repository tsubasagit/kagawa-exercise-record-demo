// 患者さん用と研究用で共有する部分。
// デモ版はこの端末のブラウザ（localStorage）にだけ保存する。本番は Firebase に置き換える。
const STORE_KEY = "kankatsu_demo_exercise_v1";
const PROFILE_KEY = "kankatsu_demo_profile_v1";

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

function loadRecords() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
  catch { return []; }
}

function saveRecords(records) {
  localStorage.setItem(STORE_KEY, JSON.stringify(records));
}

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; }
  catch { return {}; }
}

function saveProfile(p) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

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

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 架空の研究ID 3人分・30日分のデモデータを足す
function seedDemo() {
  const recs = loadRecords();
  const people = [{ id: "K-001", w: 82 }, { id: "K-002", w: 68 }, { id: "K-003", w: 75 }];
  const today = new Date();
  for (const p of people) {
    for (let i = 29; i >= 0; i--) {
      if (Math.random() < 0.25) continue;
      const d = new Date(today); d.setDate(d.getDate() - i);
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const ex = Math.random() < 0.6 ? EXERCISES[Math.floor(Math.random() * 6)].id : "";
      const minutes = ex ? 10 + Math.floor(Math.random() * 40) : null;
      recs.push({
        id: `${p.id}-${date}-${Math.random().toString(36).slice(2, 7)}`,
        researchId: p.id, date,
        steps: 4000 + Math.floor(Math.random() * 7000),
        exercise: ex, minutes, kcal: estimateKcal(ex, minutes, p.w),
        memo: "", createdAt: d.toISOString(),
      });
    }
  }
  saveRecords(recs);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
