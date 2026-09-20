js
"use strict";

// ============================================================
// POKÉDEX — Lista de Pokémon (index.html)
// ============================================================
// PokeAPI v2. Funcionalidades:
//   - Carga inicial con lotes + skeleton loading
//   - Búsqueda en vivo con autocompletado (debounce 150ms)
//   - Filtros por tipo (múltiples), generación, orden
//   - Carga bajo-demandada con IntersectionObserver + botón load more
//   - Toggle tema dark/light (persistido en localStorage)
//   - Favoritos (persistos en localStorage, estrella ★ en cada tarjeta)
//   - Reintento exponencial (3 intentos) para cada request
//   - Renderizado escalonado con animation-delay

const API = "https://pokeapi.co/api/v2";
const TOTAL = 300;
const BATCH = 10;
const INITIAL = 30;

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const grid = $("#pokemonGrid");
const searchInput = $("#searchInput");
const countBadge = $("#countBadge");
const loading = $("#loading");
const skeletonGrid = $("#skeletonGrid");
const loadMoreContainer = $("#loadMoreContainer");
const loadMoreBtn = $("#loadMoreBtn");
const typeFilters = $("#typeFilters");
const generationFilter = $("#generationFilter");
const sortFilter = $("#sortFilter");
const clearFiltersBtn = $("#clearFiltersBtn");
const themeToggle = $("#themeToggle");
const searchAutocomplete = $("#searchAutocomplete");

let allPokemon = [];
let renderedCount = 0;
let filteredResults = [];
let currentQuery = "";
let activeTypes = new Set();
let activeGen = "all";
let activeSort = "number";
let loadMoreEnabled = true;
let searchTimer = null;
let searchSuggestions = [];

const TYPES = [
  "normal","fire","water","electric","grass","ice","fighting",
  "poison","ground","flying","psychic","bug","rock","ghost",
  "dragon","dark","steel","fairy"
];

const TYPE_COLORS = {
  normal:"#A8A878",fire:"#F08030",water:"#6890F0",electric:"#F8D030",
  grass:"#78C850",ice:"#98D8D8",fighting:"#C03028",poison:"#A850A8",
  ground:"#E0C068",flying:"#A890F0",psychic:"#F85888",bug:"#A8B820",
  rock:"#B8A038",ghost:"#705898",dragon:"#7038F8",dark:"#705848",
  steel:"#B8B8D0",fairy:"#EE99AC"
};

const GEN_MAP = {
  "generation-i":"Gen I","generation-ii":"Gen II","generation-iii":"Gen III",
  "generation-iv":"Gen IV","generation-v":"Gen V","generation-vi":"Gen VI",
  "generation-vii":"Gen VII","generation-viii":"Gen VIII","generation-ix":"Gen IX"
};
const GENS = Object.keys(GEN_MAP);

function init() {
  applyTheme();
  themeToggle.addEventListener("click", toggleTheme);
  searchInput.addEventListener("input", onSearchInput);
  searchInput.addEventListener("keydown", onSearchKeydown);
  searchInput.addEventListener("blur", () => setTimeout(hideAutocomplete, 150));
  typeFilters.addEventListener("click", onTypeFilterClick);
  generationFilter.addEventListener("change", () => { activeGen = generationFilter.value; applyFiltersAndRender(); });
  sortFilter.addEventListener("change", () => { activeSort = sortFilter.value; applyFiltersAndRender(); });
  clearFiltersBtn.addEventListener("click", clearFilters);
  buildTypeFilters();
  buildGenerationOptions();
  renderSkeletons(INITIAL);
  fetchAllPokemon().then(() => {
    applyFiltersAndRender();
    setupAutoLoadMore();
  }).catch(err => {
    loading.innerHTML = `<div class="error-box">⚠️ Error cargando Pokédex: ${err.message}. <button onclick="location.reload()">Reintentar</button></div>`;
  });
}

// ── Tema ──
function applyTheme() {
  const t = localStorage.getItem("pokedex-theme") || "dark";
  document.documentElement.setAttribute("data-theme", t);
}
function toggleTheme() {
  const c = document.documentElement.getAttribute("data-theme");
  const n = c === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", n);
  localStorage.setItem("pokedex-theme", n);
}

// ── Type filters ──
function buildTypeFilters() {
  typeFilters.innerHTML = TYPES.map(t =>
    `<button class="type-filter-btn" data-type="${t}" style="--tc:${TYPE_COLORS[t]}">${cap(t)}</button>`
  ).join("");
}
function onTypeFilterClick(e) {
  const btn = e.target.closest(".type-filter-btn");
  if (!btn) return;
  const t = btn.dataset.type;
  if (activeTypes.has(t)) { activeTypes.delete(t); btn.classList.remove("active"); }
  else { activeTypes.add(t); btn.classList.add("active"); }
  applyFiltersAndRender();
}

// ── Búsqueda ──
function onSearchInput() {
  const q = searchInput.value.trim();
  currentQuery = q;
  clearTimeout(searchTimer);
  if (q.length >= 1) {
    searchTimer = setTimeout(() => {
      searchSuggestions = allPokemon
        .filter(p => {
          if (!p._detail) return false;
          const n = p.name.toLowerCase();
          const i = String(p._detail.id);
          return n.includes(q.toLowerCase()) || i.includes(q.toLowerCase());
        })
        .slice(0, 8)
        .map(p => ({ name: p.name, id: p._detail.id }));
      showAutocomplete();
    }, 150);
  } else {
    hideAutocomplete();
    applyFiltersAndRender();
  }
}
function onSearchKeydown(e) {
  if (e.key === "Enter") { hideAutocomplete(); applyFiltersAndRender(); }
  else if (e.key === "Escape") {
    searchInput.value = ""; currentQuery = ""; hideAutocomplete(); applyFiltersAndRender();
  } else if (e.key === "ArrowDown" && searchSuggestions.length) {
    e.preventDefault();
    const first = searchSuggestions.shift();
    searchInput.value = first.name;
    currentQuery = first.name.toLowerCase();
    showAutocomplete();
  }
}
function showAutocomplete() {
  if (!searchSuggestions.length) { hideAutocomplete(); return; }
  searchAutocomplete.innerHTML = searchSuggestions.map(s =>
    `<button class="ac-item" data-name="${s.name}" data-id="${s.id}">
      <span class="ac-id">#${String(s.id).padStart(3,"0")}</span>
      <span class="ac-name">${cap(s.name)}</span>
    </button>`
  ).join("");
  searchAutocomplete.classList.remove("hidden");
  searchAutocomplete.querySelectorAll(".ac-item").forEach(item => {
    item.addEventListener("click", () => {
      searchInput.value = item.dataset.name;
      currentQuery = item.dataset.name.toLowerCase();
      hideAutocomplete();
      applyFiltersAndRender();
    });
  });
}
function hideAutocomplete() {
  searchAutocomplete.classList.add("hidden");
  searchSuggestions = [];
}

// ── Filtros ──
function buildGenerationOptions() {
  generationFilter.innerHTML = '<option value="all">Todas</option>' +
    GENS.map(g => `<option value="${g}">${GEN_MAP[g]}</option>`).join("");
}
function clearFilters() {
  activeTypes.clear();
  $$(".type-filter-btn").forEach(b => b.classList.remove("active"));
  generationFilter.value = "all"; activeGen = "all";
  sortFilter.value = "number"; activeSort = "number";
  searchInput.value = ""; currentQuery = "";
  hideAutocomplete();
  applyFiltersAndRender();
}

// ── Aplicar filtros y renderizar ──
function applyFiltersAndRender() {
  filteredResults = applyFilters(allPokemon);
  renderedCount = Math.min(INITIAL, filteredResults.length);
  renderGrid(filteredResults.slice(0, renderedCount));
  countBadge.textContent = `${filteredResults.length} Pokémon`;
  updateLoadMore();
  renderSkeletons(0);
}

function applyFilters(list) {
  let r = [...list];
  if (activeTypes.size > 0) {
    r = r.filter(p => {
      if (!p._detail) return false;
      const types = p._detail.types.map(t => t.type.name);
      return [...activeTypes].some(t => types.includes(t));
    });
  }
  if (activeGen !== "all") {
    r = r.filter(p => {
      if (!p._detail) return false;
      return p._detail.species.generation?.name === activeGen;
    });
  }
  if (currentQuery) {
    const q = currentQuery.toLowerCase();
    r = r.filter(p => {
      if (!p._detail) return false;
      return p.name.toLowerCase().includes(q) || String(p._detail.id).includes(q);
    });
  }
  r.sort((a, b) => {
    if (activeSort === "number") return a._detail.id - b._detail.id;
    if (activeSort === "name") return a.name.localeCompare(b.name);
    if (activeSort === "stat-total") {
      const sa = a._detail.stats.reduce((s,st) => s+st.base_stat, 0);
      const sb = b._detail.stats.reduce((s,st) => s+st.base_stat, 0);
      return sb - sa;
    }
    return 0;
  });
  return r;
}

// ── Render grid ──
function renderGrid(list) {
  grid.innerHTML = "";
  list.forEach((p, i) => {
    if (!p._detail) return;
    grid.appendChild(createCard(p, p._detail, i));
  });
}

function createCard(p, d, i) {
  const id = d.id;
  const favorite = isFav(id);
  const img = d.sprites.other?.official_artwork?.front_default
    || d.sprites.other?.showdown?.front_default
    || d.sprites.front_default;
  const pt = d.types[0]?.type.name || "normal";
  const st = d.types[1]?.type.name;
  const gen = GEN_MAP[d.species.generation?.name] || "";

  const card = document.createElement("div");
  card.className = "pokemon-card";
  card.style.animationDelay = `${(i % 20) * 0.03}s`;
  card.dataset.id = id;
  card.innerHTML = `
    <div class="card-fav-star ${favorite ? "favorite" : ""}" data-id="${id}" title="Marcar como favorito">★</div>
    <span class="card-number" style="background:${TYPE_COLORS[pt]};color:#fff">#${String(id).padStart(3,"0")}</span>
    <div class="card-img-wrapper">
      <img class="card-img" src="${img}" alt="${cap(p.name)}" loading="lazy"
        onerror="this.parentElement.innerHTML='<span style=\\"font-size:2.5rem\\">💥</span>'">
    </div>
    <div class="card-name">${cap(p.name)}</div>
    <div class="card-types">
      <span class="type-badge" style="background:${TYPE_COLORS[pt]};color:#fff;border:1px solid ${TYPE_COLORS[pt]}">${cap(pt)}</span>
      ${st ? `<span class="type-badge" style="background:${TYPE_COLORS[st]};color:#fff;border:1px solid ${TYPE_COLORS[st]}">${cap(st)}</span>` : ""}
    </div>
    ${gen ? `<div class="card-gen">${gen}</div>` : ""}
  `;
  card.addEventListener("click", (e) => {
    if (e.target.closest(".card-fav-star")) { toggleFav(id); e.stopPropagation(); return; }
    window.location.href = `detail.html?id=${id}`;
  });
  card.querySelector(".card-fav-star").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFav(id);
  });
  return card;
}

// ── Load more ──
function loadMore() {
  if (!loadMoreEnabled) return;
  const rem = filteredResults.length - renderedCount;
  if (rem <= 0) {
    loadMoreBtn.textContent = "No hay más Pokémon";
    loadMoreBtn.disabled = true;
    loadMoreContainer.classList.add("hidden");
    return;
  }
  const batch = Math.min(BATCH, rem);
  const next = renderedCount + batch;
  loadMoreBtn.textContent = `Cargando... (${renderedCount}/${filteredResults.length})`;
  loadMoreBtn.disabled = true;
  const items = filteredResults.slice(renderedCount, next);
  items.forEach((p, i) => {
    grid.appendChild(createCard(p, p._detail, renderedCount + i));
  });
  renderedCount = next;
  loadMoreBtn.textContent = `Cargar más Pokémon (${renderedCount}/${filteredResults.length}) ↓`;
  loadMoreBtn.disabled = false;
  updateLoadMore();
}

function updateLoadMore() {
  if (renderedCount >= filteredResults.length) loadMoreContainer.classList.add("hidden");
  else {
    loadMoreContainer.classList.remove("hidden");
    loadMoreBtn.textContent = `Cargar más Pokémon (${renderedCount}/${filteredResults.length}) ↓`;
  }
}

function setupAutoLoadMore() {
  const sentinel = document.createElement("div");
  sentinel.id = "autoLoadSentinel";
  sentinel.style.height = "1px";
  document.querySelector(".container").appendChild(sentinel);
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && loadMoreEnabled && renderedCount < filteredResults.length) {
      loadMore();
    }
  }, { rootMargin: "400px" });
  observer.observe(sentinel);
}

// ── Favoritos ──
function getFavs() {
  try { return JSON.parse(localStorage.getItem("pokedex-favs") || "[]"); }
  catch { return []; }
}
function isFav(id) { return getFavs().includes(id); }
function toggleFav(id) {
  let f = getFavs();
  if (f.includes(id)) f = f.filter(x => x !== id);
  else f.push(id);
  localStorage.setItem("pokedex-favs", JSON.stringify(f));
  $$(".pokemon-card").forEach(c => {
    if (parseInt(c.dataset.id) === id) {
      c.querySelector(".card-fav-star").classList.toggle("favorite", f.includes(id));
    }
  });
}

// ── Utilidades ──
function cap(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function renderSkeletons(n) {
  skeletonGrid.innerHTML = "";
  if (n === 0) { skeletonGrid.classList.add("hidden"); return; }
  skeletonGrid.classList.remove("hidden");
  skeletonGrid.innerHTML = Array.from({ length: Math.min(n, 20) }, (_, i) =>
    `<div class="skeleton-card" style="animation-delay:${i * 0.03}s">
      <div class="skeleton-number"></div>
      <div class="skeleton-img"></div>
      <div class="skeleton-name"></div>
      <div class="skeleton-types">
        <span class="skeleton-type"></span>
        <span class="skeleton-type"></span>
      </div>
    </div>`
  ).join("");
}

async function fetchWithRetry(url, maxRetries = 3, timeoutMs = 12000) {
  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res;
    } catch (err) {
      if (err.name === "AbortError") {
        err = new Error(`Tiempo de espera agotado (${timeoutMs / 1000}s)`);
      }
      if (i === maxRetries - 1) throw err;
      const delay = Math.pow(2, i) * 1000;
      console.warn(`Retry ${i + 1}/${maxRetries} for ${url} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function fetchAllPokemon() {
  loading.classList.remove("hidden");
  try {
    const res = await fetchWithRetry(`${API}/pokemon?limit=${TOTAL}`, 3);
    const data = await res.json();
    allPokemon = data.results;
    for (let i = 0; i < allPokemon.length; i += BATCH) {
      const batch = allPokemon.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map(p => fetchWithRetry(p.url, 2).then(r => r.json()))
      );
      results.forEach((result, idx) => {
        if (result.status === "fulfilled") batch[idx]._detail = result.value;
      });
      const loaded = Math.min(i + BATCH, TOTAL);
      countBadge.textContent = `Cargando ${loaded}/${TOTAL}`;
      renderSkeletons(loaded);
    }
    countBadge.textContent = `${filteredResults.length || TOTAL} Pokémon`;
    loading.classList.add("hidden");
  } catch (err) {
    loading.innerHTML = `<div class="error-box">⚠️ Error: ${err.message}. <button onclick="location.reload()">Reintentar</button></div>`;
    throw err;
  }
}

document.addEventListener("DOMContentLoaded", init);
