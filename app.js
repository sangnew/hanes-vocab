import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc, query, orderBy,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);

const state = {
  categories: [],
  activeCat: null,
  entries: [],
  activeTab: "word",
  unsubEntries: null,
  showAddCat: false,
  showAddEntry: false,
  editingId: null,
};

const appEl = document.getElementById("app");
const toastEl = document.getElementById("toast");
const statusEl = document.getElementById("status");
let toastTimer = null;

function showStatus(msg) {
  statusEl.textContent = msg;
  statusEl.hidden = false;
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

// custom confirm modal (native confirm() is unreliable in some mobile webviews)
function askConfirm(message) {
  return new Promise((resolve) => {
    const backdrop = document.getElementById("confirmBackdrop");
    const title = document.getElementById("confirmTitle");
    const ok = document.getElementById("confirmOk");
    const cancel = document.getElementById("confirmCancel");
    title.textContent = message;
    backdrop.hidden = false;
    function cleanup(result) {
      backdrop.hidden = true;
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
  });
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function byOrder(a, b) { return (a.order || 0) - (b.order || 0); }

// ---------------- static alphabet reference data ----------------

const KOREAN_CONSONANTS = [
  { letter: "ㄱ", name: "기역 giyeok", pron: "g / k" },
  { letter: "ㄴ", name: "니은 nieun", pron: "n" },
  { letter: "ㄷ", name: "디귿 digeut", pron: "d / t" },
  { letter: "ㄹ", name: "리을 rieul", pron: "r / l" },
  { letter: "ㅁ", name: "미음 mieum", pron: "m" },
  { letter: "ㅂ", name: "비읍 bieup", pron: "b / p" },
  { letter: "ㅅ", name: "시옷 siot", pron: "s (sh before ㅣ)" },
  { letter: "ㅇ", name: "이응 ieung", pron: "(silent) / ng" },
  { letter: "ㅈ", name: "지읒 jieut", pron: "j" },
  { letter: "ㅊ", name: "치읓 chieut", pron: "ch (aspirated)" },
  { letter: "ㅋ", name: "키읔 kieuk", pron: "k (aspirated)" },
  { letter: "ㅌ", name: "티읕 tieut", pron: "t (aspirated)" },
  { letter: "ㅍ", name: "피읖 pieup", pron: "p (aspirated)" },
  { letter: "ㅎ", name: "히읗 hieut", pron: "h" },
];

const KOREAN_CONSONANTS_TENSE = [
  { letter: "ㄲ", name: "쌍기역 ssanggiyeok", pron: "kk (tense)" },
  { letter: "ㄸ", name: "쌍디귿 ssangdigeut", pron: "tt (tense)" },
  { letter: "ㅃ", name: "쌍비읍 ssangbieup", pron: "pp (tense)" },
  { letter: "ㅆ", name: "쌍시옷 ssangsiot", pron: "ss (tense)" },
  { letter: "ㅉ", name: "쌍지읒 ssangjieut", pron: "jj (tense)" },
];

const KOREAN_VOWELS = [
  { letter: "ㅏ", rom: "a", pron: "ah (father)" },
  { letter: "ㅑ", rom: "ya", pron: "yah" },
  { letter: "ㅓ", rom: "eo", pron: "uh (law)" },
  { letter: "ㅕ", rom: "yeo", pron: "yuh" },
  { letter: "ㅗ", rom: "o", pron: "oh" },
  { letter: "ㅛ", rom: "yo", pron: "yoh" },
  { letter: "ㅜ", rom: "u", pron: "oo (moon)" },
  { letter: "ㅠ", rom: "yu", pron: "yoo" },
  { letter: "ㅡ", rom: "eu", pron: "uh (unrounded, 'u' in put)" },
  { letter: "ㅣ", rom: "i", pron: "ee" },
];

const KOREAN_VOWELS_COMPOUND = [
  { letter: "ㅐ", rom: "ae", pron: "eh/ae (cat)" },
  { letter: "ㅒ", rom: "yae", pron: "yae" },
  { letter: "ㅔ", rom: "e", pron: "eh (bed)" },
  { letter: "ㅖ", rom: "ye", pron: "yeh" },
  { letter: "ㅘ", rom: "wa", pron: "wah" },
  { letter: "ㅙ", rom: "wae", pron: "weh" },
  { letter: "ㅚ", rom: "oe", pron: "weh" },
  { letter: "ㅝ", rom: "wo", pron: "wuh" },
  { letter: "ㅞ", rom: "we", pron: "weh" },
  { letter: "ㅟ", rom: "wi", pron: "wee" },
  { letter: "ㅢ", rom: "ui", pron: "weui (uh+ee glide)" },
];

const SPANISH_ALPHABET = [
  { letter: "A a", name: "a", ipa: "/a/", example: "agua" },
  { letter: "B b", name: "be", ipa: "/b/", example: "burro" },
  { letter: "C c", name: "ce", ipa: "/k, s/", example: "casa" },
  { letter: "D d", name: "de", ipa: "/d/", example: "dedo" },
  { letter: "E e", name: "e", ipa: "/e/", example: "elefante" },
  { letter: "F f", name: "efe", ipa: "/f/", example: "flor" },
  { letter: "G g", name: "ge", ipa: "/g, x/", example: "gato" },
  { letter: "H h", name: "hache", ipa: "(silent)", example: "hola" },
  { letter: "I i", name: "i", ipa: "/i/", example: "isla" },
  { letter: "J j", name: "jota", ipa: "/x/", example: "jugo" },
  { letter: "K k", name: "ka", ipa: "/k/", example: "kilo" },
  { letter: "L l", name: "ele", ipa: "/l/", example: "luna" },
  { letter: "M m", name: "eme", ipa: "/m/", example: "mesa" },
  { letter: "N n", name: "ene", ipa: "/n/", example: "nube" },
  { letter: "Ñ ñ", name: "eñe", ipa: "/ɲ/", example: "niño" },
  { letter: "O o", name: "o", ipa: "/o/", example: "oso" },
  { letter: "P p", name: "pe", ipa: "/p/", example: "perro" },
  { letter: "Q q", name: "cu", ipa: "/k/", example: "queso" },
  { letter: "R r", name: "ere", ipa: "/r, ɾ/", example: "ratón" },
  { letter: "S s", name: "ese", ipa: "/s/", example: "sol" },
  { letter: "T t", name: "te", ipa: "/t/", example: "taza" },
  { letter: "U u", name: "u", ipa: "/u/", example: "uva" },
  { letter: "V v", name: "uve", ipa: "/b/", example: "vaca" },
  { letter: "W w", name: "uve doble", ipa: "/w/", example: "web" },
  { letter: "X x", name: "equis", ipa: "/ks, s/", example: "examen" },
  { letter: "Y y", name: "ye", ipa: "/i, ʝ/", example: "yo" },
  { letter: "Z z", name: "zeta", ipa: "/s, θ/", example: "zapato" },
];

// ---------------- rendering ----------------

function render() {
  const alphaActive = state.activeCat === "__alphabet__" ? " active" : "";
  const alphaBtn = `<button class="cat-btn alphabet-btn${alphaActive}" data-cat="__alphabet__">` +
    `<span class="ko">🔤 알파벳</span><span class="en">Alphabet</span></button>`;

  const catsHtml = state.categories.slice().sort(byOrder).map((c) => {
    const active = c.id === state.activeCat ? " active" : "";
    return (
      `<button class="cat-btn${active}" data-cat="${esc(c.id)}">` +
      `<span class="ko">${esc(c.name)}</span>` +
      (c.nameEn ? `<span class="en">${esc(c.nameEn)}</span>` : "") +
      `</button>`
    );
  }).join("");

  const addCatHtml = state.showAddCat
    ? `<form class="cat-form" id="catForm">
        <input id="newCatKo" placeholder="한글 이름 (예: 쇼핑)" required />
        <input id="newCatEn" placeholder="English (e.g. Shopping)" />
        <button class="btn" type="submit">추가</button>
        <button class="btn ghost" type="button" id="cancelCat">취소</button>
      </form>`
    : `<button class="add-toggle" id="openAddCat" type="button">+ 카테고리 추가</button>`;

  const mainHtml = renderMain();

  appEl.innerHTML =
    `<div class="board">
      <nav class="cats">${alphaBtn}<hr class="nav-rule" />${catsHtml}<div class="add-cat">${addCatHtml}</div></nav>
      <main class="panel">${mainHtml}</main>
    </div>`;

  wireNav();
}

function renderAlphabet() {
  const koCard = (c) => `<div class="alpha-card"><div class="alpha-letter kr">${esc(c.letter)}</div><div class="alpha-name">${esc(c.name)}</div><div class="alpha-pron">${esc(c.pron)}</div></div>`;
  const koVowelCard = (c) => `<div class="alpha-card"><div class="alpha-letter kr">${esc(c.letter)}</div><div class="alpha-name">${esc(c.rom)}</div><div class="alpha-pron">${esc(c.pron)}</div></div>`;
  const esCard = (c) => `<div class="alpha-card"><div class="alpha-letter es">${esc(c.letter)}</div><div class="alpha-name">${esc(c.name)} <span class="ipa">${esc(c.ipa)}</span></div><div class="alpha-pron">${esc(c.example)}</div></div>`;

  return (
    `<div class="cat-head"><h1>🔤 알파벳</h1><span class="en">Alphabet &amp; Pronunciation</span></div>

    <section class="alpha-section">
      <h2 class="alpha-h kr">한글 자모 <span class="en">Hangul</span></h2>
      <h3 class="alpha-sub">자음 Consonants (기본 14)</h3>
      <div class="alpha-grid">${KOREAN_CONSONANTS.map(koCard).join("")}</div>
      <h3 class="alpha-sub">쌍자음 Tense consonants (5)</h3>
      <div class="alpha-grid">${KOREAN_CONSONANTS_TENSE.map(koCard).join("")}</div>
      <h3 class="alpha-sub">모음 Vowels (기본 10)</h3>
      <div class="alpha-grid">${KOREAN_VOWELS.map(koVowelCard).join("")}</div>
      <h3 class="alpha-sub">이중모음 Compound vowels (11)</h3>
      <div class="alpha-grid">${KOREAN_VOWELS_COMPOUND.map(koVowelCard).join("")}</div>
    </section>

    <section class="alpha-section">
      <h2 class="alpha-h es">Alfabeto español <span class="en">Spanish alphabet</span></h2>
      <div class="alpha-grid">${SPANISH_ALPHABET.map(esCard).join("")}</div>
    </section>`
  );
}

function renderMain() {
  if (state.activeCat === "__alphabet__") return renderAlphabet();
  const cat = state.categories.find((c) => c.id === state.activeCat);
  if (!cat) return `<p class="state-note">왼쪽에서 카테고리를 선택하거나 새로 만들어 보세요.</p>`;

  const words = state.entries.filter((e) => e.type !== "sentence").sort(byOrder);
  const sentences = state.entries.filter((e) => e.type === "sentence").sort(byOrder);
  const list = state.activeTab === "sentence" ? sentences : words;

  const rows = list.length
    ? list.map(renderEntry).join("")
    : `<li class="empty-note">${state.activeTab === "sentence" ? "아직 추가된 문장이 없어요." : "아직 추가된 단어가 없어요."} 아래에서 추가해 보세요.</li>`;

  const formHtml = state.showAddEntry
    ? renderEntryForm()
    : `<button class="add-toggle" id="openAddEntry" type="button">+ ${state.activeTab === "sentence" ? "문장" : "단어"} 추가</button>`;

  return (
    `<div class="cat-head"><h1>${esc(cat.name)}</h1>` +
    (cat.nameEn ? `<span class="en">${esc(cat.nameEn)}</span>` : "") +
    `</div>
    <div class="tabs">
      <button class="tab-btn${state.activeTab === "word" ? " active" : ""}" data-tab="word">단어 <span class="n">${words.length}</span></button>
      <button class="tab-btn${state.activeTab === "sentence" ? " active" : ""}" data-tab="sentence">문장 <span class="n">${sentences.length}</span></button>
    </div>
    <ul class="entries">${rows}</ul>
    ${formHtml}`
  );
}

function renderEntry(e) {
  if (state.editingId === e.id) return renderEntryForm(e);
  return (
    `<li class="entry" data-id="${esc(e.id)}">
      <div class="side kr"><span class="flag">한국어</span><div class="word">${esc(e.ko)}</div>
        ${e.koPhon ? `<div class="sub">${esc(e.koPhon)}</div>` : ""}</div>
      <div class="side es"><span class="flag">Español</span><div class="word">${esc(e.es)}</div>
        ${e.esMeaning ? `<div class="sub">${esc(e.esMeaning)}</div>` : ""}</div>
      <div class="entry-actions">
        <button class="icon-btn edit" title="수정" data-id="${esc(e.id)}">✎</button>
        <button class="icon-btn del" title="삭제" data-id="${esc(e.id)}">×</button>
      </div>
    </li>`
  );
}

function renderEntryForm(existing) {
  const isSentence = state.activeTab === "sentence";
  const e = existing || {};
  const idAttr = existing ? ` data-editing="${esc(existing.id)}"` : "";
  const koLabel = isSentence ? "한국어 문장" : "한국어 단어";
  const esLabel = isSentence ? "Oración en español" : "Palabra en español";
  return (
    `<form class="entry-form" id="entryForm"${idAttr}>
      <div><label for="fKo">${koLabel}</label><input id="fKo" required value="${esc(e.ko)}" /></div>
      <div><label for="fEs">${esLabel}</label><input id="fEs" required value="${esc(e.es)}" /></div>
      <div><label for="fKoPhon">발음 (영문 표기 / pronunciation)</label><input id="fKoPhon" placeholder="예: an-nyong-ha-se-yo" value="${esc(e.koPhon)}" /></div>
      <div><label for="fEsMeaning">English meaning / explicación</label><input id="fEsMeaning" placeholder="e.g. a polite greeting" value="${esc(e.esMeaning)}" /></div>
      <div class="form-row">
        <button class="btn" type="submit">${existing ? "저장" : "추가"}</button>
        <button class="btn ghost" type="button" id="cancelEntry">취소</button>
      </div>
    </form>`
  );
}

// ---------------- wiring ----------------

function wireNav() {
  appEl.querySelectorAll(".cat-btn").forEach((btn) => {
    btn.addEventListener("click", () => setActiveCategory(btn.getAttribute("data-cat")));
  });

  const openAddCat = document.getElementById("openAddCat");
  if (openAddCat) openAddCat.addEventListener("click", () => { state.showAddCat = true; render(); });
  const cancelCat = document.getElementById("cancelCat");
  if (cancelCat) cancelCat.addEventListener("click", () => { state.showAddCat = false; render(); });
  const catForm = document.getElementById("catForm");
  if (catForm) catForm.addEventListener("submit", onAddCategory);

  appEl.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.activeTab = btn.getAttribute("data-tab");
      state.showAddEntry = false;
      state.editingId = null;
      render();
    });
  });

  const openAddEntry = document.getElementById("openAddEntry");
  if (openAddEntry) openAddEntry.addEventListener("click", () => { state.showAddEntry = true; render(); });
  const cancelEntry = document.getElementById("cancelEntry");
  if (cancelEntry) cancelEntry.addEventListener("click", () => { state.showAddEntry = false; state.editingId = null; render(); });
  const entryForm = document.getElementById("entryForm");
  if (entryForm) entryForm.addEventListener("submit", onSaveEntry);

  appEl.querySelectorAll(".icon-btn.edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.editingId = btn.getAttribute("data-id");
      state.showAddEntry = false;
      render();
    });
  });
  appEl.querySelectorAll(".icon-btn.del").forEach((btn) => {
    btn.addEventListener("click", () => onDeleteEntry(btn.getAttribute("data-id")));
  });
}

// ---------------- data actions ----------------

function setActiveCategory(id) {
  if (id === state.activeCat) return;
  state.activeCat = id;
  state.activeTab = "word";
  state.showAddEntry = false;
  state.editingId = null;
  if (id === "__alphabet__") {
    if (state.unsubEntries) { state.unsubEntries(); state.unsubEntries = null; }
    state.entries = [];
    render();
  } else {
    subscribeEntries(id);
    render();
  }
}

function subscribeEntries(catId) {
  if (state.unsubEntries) { state.unsubEntries(); state.unsubEntries = null; }
  state.entries = [];
  if (!catId) return;
  const q = query(collection(db, "categories", catId, "entries"), orderBy("order"));
  state.unsubEntries = onSnapshot(
    q,
    (snap) => {
      state.entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      render();
    },
    (err) => { console.error("entries subscribe error", err); showStatus("목록을 불러오지 못했어요: " + err.message); }
  );
}

function onAddCategory(ev) {
  ev.preventDefault();
  const ko = document.getElementById("newCatKo").value.trim();
  const en = document.getElementById("newCatEn").value.trim();
  if (!ko) return;
  const order = state.categories.length;
  addDoc(collection(db, "categories"), { name: ko, nameEn: en, order, createdAt: new Date().toISOString() })
    .then((ref) => {
      state.showAddCat = false;
      setActiveCategory(ref.id);
    })
    .catch((err) => { console.error(err); toast("카테고리를 추가하지 못했어요."); });
}

function onSaveEntry(ev) {
  ev.preventDefault();
  const form = ev.target;
  const editingId = form.getAttribute("data-editing");
  const body = {
    type: state.activeTab,
    ko: document.getElementById("fKo").value.trim(),
    es: document.getElementById("fEs").value.trim(),
    koPhon: document.getElementById("fKoPhon").value.trim(),
    esMeaning: document.getElementById("fEsMeaning").value.trim(),
  };
  if (!body.ko || !body.es) return;

  const col = collection(db, "categories", state.activeCat, "entries");
  const p = editingId
    ? updateDoc(doc(col, editingId), body)
    : addDoc(col, { ...body, order: state.entries.length, createdAt: new Date().toISOString() });

  p.then(() => {
    state.showAddEntry = false;
    state.editingId = null;
    render();
  }).catch((err) => { console.error(err); toast("저장하지 못했어요."); });
}

async function onDeleteEntry(id) {
  if (!id) return;
  const ok = await askConfirm("이 항목을 삭제할까요?");
  if (!ok) return;
  deleteDoc(doc(collection(db, "categories", state.activeCat, "entries"), id))
    .catch((err) => { console.error(err); toast("삭제하지 못했어요."); });
}

// ---------------- boot ----------------

window.addEventListener("error", (e) => showStatus("오류: " + e.message));
window.addEventListener("unhandledrejection", (e) => showStatus("오류: " + (e.reason && e.reason.message || e.reason)));

function boot() {
  const q = query(collection(db, "categories"), orderBy("order"));
  onSnapshot(
    q,
    (snap) => {
      state.categories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!state.activeCat && state.categories.length) {
        state.activeCat = state.categories.slice().sort(byOrder)[0].id;
        subscribeEntries(state.activeCat);
      }
      render();
    },
    (err) => { console.error("categories subscribe error", err); showStatus("불러오지 못했어요: " + err.message); render(); }
  );
  render();
}

boot();
