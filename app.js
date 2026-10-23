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

// ---------------- rendering ----------------

function render() {
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
      <nav class="cats">${catsHtml}<div class="add-cat">${addCatHtml}</div></nav>
      <main class="panel">${mainHtml}</main>
    </div>`;

  wireNav();
}

function renderMain() {
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
  subscribeEntries(id);
  render();
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
