const MAX_CHAPTER = 300;
const state = {
  chapters: [],
  current: 1,
  fontSize: Number(localStorage.getItem("mhoh-font-size")) || 18,
  theme: localStorage.getItem("mhoh-theme") || "night",
  menuOpen: false,
};

const elements = {
  chapter: document.querySelector("#chapter"),
  chapterBody: document.querySelector("#chapterBody"),
  chapterCounter: document.querySelector("#chapterCounter"),
  chapterList: document.querySelector("#chapterList"),
  chapterNumber: document.querySelector("#chapterNumber"),
  chapterSearch: document.querySelector("#chapterSearch"),
  chapterTitle: document.querySelector("#chapterTitle"),
  compactTitle: document.querySelector("#compactTitle"),
  fontLabel: document.querySelector("#fontLabel"),
  menuButton: document.querySelector("#menuButton"),
  nextBottom: document.querySelector("#nextBottom"),
  nextLabel: document.querySelector("#nextLabel"),
  nextTop: document.querySelector("#nextTop"),
  previousBottom: document.querySelector("#previousBottom"),
  previousLabel: document.querySelector("#previousLabel"),
  previousTop: document.querySelector("#previousTop"),
  readingProgress: document.querySelector("#readingProgress"),
  sidebar: document.querySelector("#sidebar"),
  sidebarBackdrop: document.querySelector("#sidebarBackdrop"),
  themeToggle: document.querySelector("#themeToggle"),
};

function chapterFile(number) {
  return `chapters/${String(number).padStart(3, "0")}.json`;
}

function chapterName(number) {
  return state.chapters[number - 1]?.title || `Chapter ${number}`;
}

function setTheme(theme) {
  state.theme = theme === "paper" ? "paper" : "night";
  document.documentElement.dataset.theme = state.theme;
  elements.themeToggle.textContent = state.theme === "night" ? "☼" : "◐";
  elements.themeToggle.setAttribute(
    "aria-label",
    state.theme === "night" ? "Switch to paper theme" : "Switch to night theme",
  );
  localStorage.setItem("mhoh-theme", state.theme);
}

function setFontSize(size) {
  state.fontSize = Math.max(15, Math.min(24, size));
  document.documentElement.style.setProperty("--reader-size", `${state.fontSize}px`);
  elements.fontLabel.textContent = `${state.fontSize} px`;
  localStorage.setItem("mhoh-font-size", String(state.fontSize));
}

function setMenu(open) {
  state.menuOpen = open;
  elements.sidebar.classList.toggle("open", open);
  elements.sidebarBackdrop.classList.toggle("open", open);
  elements.menuButton.setAttribute("aria-expanded", String(open));
}

function renderChapterList(filter = "") {
  const query = filter.trim().toLowerCase();
  const matches = state.chapters.filter((chapter) =>
    !query || chapter.title.toLowerCase().includes(query) || String(chapter.number).includes(query),
  );

  if (!matches.length) {
    elements.chapterList.innerHTML = '<div class="empty-search">No edited chapters match that search.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  matches.forEach((chapter) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chapter-item${chapter.number === state.current ? " active" : ""}`;
    button.dataset.chapter = String(chapter.number);
    button.innerHTML = `
      <span class="chapter-item-number">${String(chapter.number).padStart(3, "0")}</span>
      <span class="chapter-item-title">${chapter.title.replace(/^Chapter\s+\d+\s*:\s*/i, "")}</span>
    `;
    button.addEventListener("click", () => loadChapter(chapter.number));
    fragment.appendChild(button);
  });
  elements.chapterList.replaceChildren(fragment);
}

function updateNavigation() {
  const isFirst = state.current === 1;
  const isLast = state.current === MAX_CHAPTER;
  elements.previousTop.disabled = isFirst;
  elements.previousBottom.disabled = isFirst;
  elements.nextTop.disabled = isLast;
  elements.nextBottom.disabled = isLast;
  elements.previousLabel.textContent = isFirst ? "Beginning" : chapterName(state.current - 1);
  elements.nextLabel.textContent = isLast ? "End of edited edition" : chapterName(state.current + 1);
}

function restoreScroll(number) {
  const saved = Number(localStorage.getItem(`mhoh-scroll-${number}`)) || 0;
  requestAnimationFrame(() => window.scrollTo({ top: saved, behavior: "auto" }));
}

async function loadChapter(number, options = {}) {
  const target = Math.max(1, Math.min(MAX_CHAPTER, Number(number) || 1));
  if (state.current) {
    localStorage.setItem(`mhoh-scroll-${state.current}`, String(window.scrollY));
  }

  elements.chapterBody.innerHTML = '<p class="loading-copy">Loading edited chapter…</p>';
  elements.chapterTitle.textContent = chapterName(target);

  try {
    const response = await fetch(chapterFile(target));
    if (!response.ok) throw new Error(`Chapter request failed (${response.status})`);
    const chapter = await response.json();

    state.current = target;
    localStorage.setItem("mhoh-last-chapter", String(target));
    elements.chapterNumber.textContent = String(target).padStart(3, "0");
    elements.chapterTitle.textContent = chapter.title;
    elements.compactTitle.textContent = chapter.title;
    elements.chapterCounter.textContent = `${target} / ${MAX_CHAPTER}`;
    elements.chapterBody.innerHTML = chapter.html;
    document.title = `${chapter.title} — My House of Horrors`;

    const url = new URL(window.location.href);
    url.searchParams.set("chapter", String(target));
    history.replaceState({ chapter: target }, "", url);

    updateNavigation();
    renderChapterList(elements.chapterSearch.value);
    const active = elements.chapterList.querySelector(".chapter-item.active");
    active?.scrollIntoView({ block: "center" });
    setMenu(false);

    if (options.top) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      restoreScroll(target);
    }
    updateReadingProgress();
  } catch (error) {
    elements.chapterBody.innerHTML = `<p class="error-copy">This chapter could not be loaded. ${error.message}</p>`;
  }
}

function moveChapter(direction) {
  const target = state.current + direction;
  if (target >= 1 && target <= MAX_CHAPTER) loadChapter(target, { top: true });
}

function updateReadingProgress() {
  const articleTop = elements.chapter.offsetTop;
  const articleHeight = elements.chapter.offsetHeight;
  const usable = Math.max(1, articleHeight - window.innerHeight);
  const progress = Math.max(0, Math.min(1, (window.scrollY - articleTop) / usable));
  elements.readingProgress.style.width = `${progress * 100}%`;
}

async function initialize() {
  setTheme(state.theme);
  setFontSize(state.fontSize);

  try {
    const response = await fetch("chapters/index.json");
    if (!response.ok) throw new Error("The edited chapter index is unavailable.");
    state.chapters = await response.json();
    if (state.chapters.length !== MAX_CHAPTER) {
      throw new Error(`Expected ${MAX_CHAPTER} edited chapters, found ${state.chapters.length}.`);
    }

    const query = Number(new URLSearchParams(window.location.search).get("chapter"));
    const saved = Number(localStorage.getItem("mhoh-last-chapter"));
    const firstChapter = query >= 1 && query <= MAX_CHAPTER ? query : (saved || 1);
    renderChapterList();
    await loadChapter(firstChapter);
  } catch (error) {
    elements.chapterTitle.textContent = "Reader unavailable";
    elements.chapterBody.innerHTML = `<p class="error-copy">${error.message}</p>`;
  }
}

elements.chapterSearch.addEventListener("input", (event) => renderChapterList(event.target.value));
elements.previousTop.addEventListener("click", () => moveChapter(-1));
elements.previousBottom.addEventListener("click", () => moveChapter(-1));
elements.nextTop.addEventListener("click", () => moveChapter(1));
elements.nextBottom.addEventListener("click", () => moveChapter(1));
elements.decreaseFont = document.querySelector("#decreaseFont");
elements.increaseFont = document.querySelector("#increaseFont");
elements.decreaseFont.addEventListener("click", () => setFontSize(state.fontSize - 1));
elements.increaseFont.addEventListener("click", () => setFontSize(state.fontSize + 1));
elements.themeToggle.addEventListener("click", () => setTheme(state.theme === "night" ? "paper" : "night"));
elements.menuButton.addEventListener("click", () => setMenu(!state.menuOpen));
elements.sidebarBackdrop.addEventListener("click", () => setMenu(false));

window.addEventListener("scroll", updateReadingProgress, { passive: true });
window.addEventListener("resize", updateReadingProgress);
window.addEventListener("beforeunload", () => {
  localStorage.setItem(`mhoh-scroll-${state.current}`, String(window.scrollY));
});
window.addEventListener("keydown", (event) => {
  const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
  if (event.key === "Escape") setMenu(false);
  if (typing) return;
  if (event.key === "[") moveChapter(-1);
  if (event.key === "]") moveChapter(1);
});

initialize();
