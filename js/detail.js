js
"use strict";

// ============================================================
// POKÉDEX — Detalle de un Pokémon (detail.html)
// ============================================================
// Muestra: imagen grande, tipos, descripción, especie, stats con
// barras + total + comparación con promedio, habilidades, efectividad
// de tipos, versiones, movimientos aprendidos, cadena de evolución,
// ratio de sexo, capture rate, growth rate, egg groups, toggle tema.

const API = "https://pokeapi.co/api/v2";
const $ = (s) => document.querySelector(s);

const TYPE_COLORS = {
  normal:"#A8A878",fire:"#F08030",water:"#6890F0",electric:"#F8D030",
  grass:"#78C850",ice:"#98D8D8",fighting:"#C03028",poison:"#A850A8",
  ground:"#E0C068",flying:"#A890F0",psychic:"#F85888",bug:"#A8B820",
  rock:"#B8A038",ghost:"#705898",dragon:"#7038F8",dark:"#705848",
  steel:"#B8B8D0",fairy:"#EE99AC"
};

const TYPE_DAMAGE = {
  normal:{ghost:0},
  fire:{fire:0.5,water:0.5,grass:2,ice:2,bug:2,steel:0.5,poison:0.5,fairy:0.5},
  water:{fire:2,water:0.5,grass:0.5,ground:2,rock:2,dragon:0.5},
  electric:{water:2,electric:0.5,grass:0.5,ground:0,dragon:0.5},
  grass:{fire:0.5,water:2,electric:0.5,grass:0.5,poison:0.5,flying:0.5,bug:0.5,rock:2,dragon:0.5,steel:0.5},
  ice:{fire:0.5,water:0.5,grass:2,ice:0.5,ground:2,flying:2,rock:2,steel:0.5,dragon:2},
  fighting:{normal:2,ice:2,rock:2,dark:2,steel:2,poison:0.5,flying:0.5,psychic:0.5,bug:0.5,ghost:0,fairy:0.5},
  poison:{poison:0.5,ground:0.5,psychic:0,bug:0.5,rock:0.5,fire:0.5,grass:0.5,gravel:0.5,dark:0.5},
  ground:{fire:2,electric:0,poison:2,rock:2,steel:2,grass:0.5,bug:0.5,flying:0.5,ghost:0.5,fairy:0.5,dragon:0.5},
  flying:{electric:2,grass:2,fighting:2,bug:2,rock:0.5,steel:0.5,poison:0.5,fairy:0.5},
  psychic:{fighting:0.5,psychic:0.5,dark:2,steel:0.5,fairy:0.5},
  bug:{fire:0.5,grass:2,fighting:0.5,poison:0.5,ground:2,flying:0.5,rock:0.5,steel:0.5,dragon:0.5,ghost:0.5,dark:2,fairy:0.5},
  rock:{fire:0.5,ice:2,fighting:0.5,poison:0.5,ground:2,steel:0.5,flying:2,water:2,grass:0.5,electric:0.5,fairy:0.5},
  ghost:{normal:0,psychic:0,ghost:2,ground:0.5,dark:2,poison:0.5,steel:0.5,fire:0.5},
  dragon:{fire:0.5,water:0.5,electric:0.5,grass:0.5,ice:0.5,psychic:0.5,dragon:0.5,fairy:0.5,dark:0.5,steel:0.5},
  dark:{fighting:0.5,psychic:2,ghost:2,fire:2,water:0.5,grass:0.5,poison:0.5,bug:0.5,fairy:0,electric:0.5,ground:0.5,rock:0.5,dragon:0.5,steel:0.5},
  steel:{fire:2,water:0.5,electric:2,grass:0.5,ice:0.5,fighting:0.5,poison:0.5,ground:0.5,flying:0.5,psychic:0.5,bug:0.5,rock:0.5,ghost:0.5,steel:0.5,dragon:0.5,fairy:0.5},
  fairy:{fire:0.5,fight:0.5,poison:0.5,ground:0.5,flying:0.5,psychic:0.5,bug:0.5,rock:0.5,ghost:0.5,dragon:0.5,dark:0,steel:0.5,poison:0.5}
};

const STAT_COLORS = {
  hp:"#FF6B6B",attack:"#F08030",defense:"#6890F0",
  special_attack:"#F8D030",special_defense:"#78C850",speed:"#A890F0"
};

const STAT_AVG = {hp:64,attack:56,defense:58,special_attack:62,special_defense:61,speed:63};

let currentTheme = localStorage.getItem("pokedex-theme") || "dark";
document.documentElement.setAttribute("data-theme", currentTheme);

const themeToggle = $("#themeToggle");
if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", currentTheme);
    localStorage.setItem("pokedex-theme", currentTheme);
  });
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    $("#detailError").innerHTML = "Sin ID de Pokémon. Usá: detail.html?id=25";
    $("#detailError").classList.remove("hidden");
    $("#detailLoading").classList.add("hidden");
    return;
  }
  try {
    const [pokemon, species] = await Promise.all([
      fetchWithRetry(${API}/pokemon/${id}),
      fetchWithRetry(${API}/pokemon-species/${id})
    ]);
    const p = await pokemon.json();
    const sp = await species.json();
    renderDetail(p, sp);
    $("#detailLoading").classList.add("hidden");
    $("#detailContent").classList.remove("hidden");
  } catch (err) {
    $("#detailError").innerHTML = No se pudo cargar el Pokémon #${id}: ${err.message}. <button onclick="history.back()">Volver</button>;
    $("#detailError").classList.remove("hidden");
    $("#detailLoading").classList.add("hidden");
  }
}

async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(HTTP ${res.status});
      return res;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}

function cap(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ");
}

function getTypeColors() { return TYPE_COLORS; }

function getDescription(sp) {
  const entries = sp.flavor_text_entries
    .filter(e => e.language?.name === "en" && !e.version?.name?.startsWith("university"))
    .sort((a, b) => (b.version?.name ? 1 : 0) - (a.version?.name ? 1 : 0));
  return entries.length ? entries[0].flavor_text : "Sin descripción disponible.";
}

function getMoveType(moveUrl) {
  if (!moveUrl) return "?";
  const name = moveUrl.split("/").filter(Boolean).pop();
  return TYPE_COLORS[name] ? name : "?";
}

function guessTypeFromUrl(moveUrl) {
  if (!moveUrl) return "?";
  const name = moveUrl.split("/").filter(Boolean).pop();
  return TYPE_COLORS[name] ? name : "?";
}

function isShinyAvailable(p) {
  return p.sprites.other?.official_artwork?.front_shiny
    || p.sprites.front_shiny
    || p.sprites.other?.showdown?.front_shiny;
}

function renderDetail(p, sp) {
  const id = p.id;
  const idStr = #${String(id).padStart(3,"0")};
  const name = p.name;
  const capName = cap(name);

  // Imágenes
  const img = p.sprites.other?.official_artwork?.front_default
    || p.sprites.other?.showdown?.front_default
    || p.sprites.front_default;
  const backImg = p.sprites.back_default;
  const shiny = isShinyAvailable(p)
    ? (p.sprites.other?.official_artwork?.front_shiny
      || p.sprites.front_shiny
      || p.sprites.other?.showdown?.front_shiny)
    : null;

  // Tipos
  const types = p.types.map(t => t.type.name);
  const typeColors = getTypeColors();

  // Stats
  const stats = p.stats;
  const totalStats = stats.reduce((s, st) => s + st.base_stat, 0);

  // Especies
  const speciesName = sp.name;
  const speciesColor = sp.color?.name || "normal";
  const genus = sp.generation?.name || "";
  const category = sp.generation?.name || "unknown";

  // Descripción
  const desc = getDescription(sp);

  // Flavor texts
  const flavorEntries = sp.flavor_text_entries
    .filter(e => e.language?.name === "en" && !e.version?.name?.startsWith("university"))
    .slice(0, 3);
  const flavorHtml = flavorEntries.length ? flavorEntries.map(e => {
    const ver = e.version?.name ? cap(e.version.name.replace(/-/g," ")) : "desconocido";
    return <div class="flavor-entry"><span class="flavor-ver">${ver}</span><p class="flavor-text">${e.flavor_text}</p></div>;
  }).join("") : "";

  // Habilidades
  const abilities = p.abilities.map(a => ({
    name: a.ability.name,
    isHidden: a.is_hidden
  }));

  // Tamaño / peso
  const heightM = (p.height / 10).toFixed(2);
  const weightKg = (p.weight / 100).toFixed(2);

  // Versiones
  const versions = (p.versions || [])
    .map(v => cap((v.version?.name || "unknown").replace(/-/g, " ")))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 12);

  // Efectividad de tipos
  const eff = {};
  types.forEach(t => {
    const map = TYPE_DAMAGE[t];
    if (map) {
      Object.entries(map).forEach(([target, mult]) => {
        if (!types.includes(target)) {
          eff[target] = eff[target] || 1;
          eff[target] *= mult;
        }
      });
    }
  });
  const effFiltered = Object.entries(eff)
    .filter(([, v]) => v !== 1)
    .sort((a, b) => b[1] - a[1]);

  // Stats HTML
  const statsHtml = stats.map(s => {
    const pct = Math.min(100, (s.base_stat / 255) * 100);
    const color = STAT_COLORS[s.stat.name] || "#555";
    return `
      <div class="stat-row">
        <div class="stat-left">
          <span class="stat-label">${cap(s.stat.name)}</span>
          <span class="stat-value">${s.base_stat}</span>
        </div>
        <div class="stat-bar-bg">
          <div class="stat-bar" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>`;
  }).join("");

  // Comparación con promedio
  const comparisonHtml = stats.map(s => {
    const base = s.base_stat;
    const avg = STAT_AVG[s.stat.name] || 60;
    const diff = base - avg;
    const sign = diff > 0 ? "+" : "";
    const cls = diff > 0 ? "stat-comp-good" : diff < 0 ? "stat-comp-bad" : "stat-comp-neutral";
    return `
      <div class="stat-comp-row">
        <span class="stat-comp-label">${cap(s.stat.name)}</span>
        <span class="stat-comp-bar-bg">
          <span class="stat-comp-bar ${cls}" style="width:${Math.min(100, Math.abs(diff) * 3)}%"></span>
        </span>
        <span class="stat-comp-diff ${cls}">${sign}${diff}</span>
      </div>`;
  }).join("");

  // Evolución (simplificada - se carga de forma asíncrona después)
  const evolutionHtml = <div class="evolution-loading">Cargando cadena de evolución...</div>;

  // Ratio de sexo
  const genderRate = sp.gender_rate !== null
    ? (sp.gender_rate > 0
        ? Male: ${((sp.gender_rate + 1) * 25)}%, Female: ${((8 - sp.gender_rate) * 25)}%
        : "Female: 100%"
      )
    : "Sexo indeterminado";

  // Capture rate
  const captureRate = sp.capture_rate !== undefined ? sp.capture_rate : "—";

  // Growth rate
  const growthRate = sp.growth_rate?.name ? cap(sp.growth_rate.name.replace(/-/g, " ")) : "—";

  // Egg groups
  const eggGroups = (sp.egg_groups || [])
    .map(g => cap(g.name.replace(/-/g, " ")))
    .join(", ") || "—";

  // Movimientos
  const rawMoves = p.moves
    .filter(m => m.version_group_details?.length > 0)
    .map(m => {
      const details = m.version_group_details[0];
      return {
        name: m.move.name,
        url: m.move.url,
        version: details.version_group?.name || "",
        level: details.level_learned_at || 0,
        method: details.move_learn_method?.name || "",
        isHidden: m.move.is_hidden || false
      };
    })
    .sort((a, b) => a.level - b.level);

  // Render DOM
  $("#detailNumber").textContent = idStr;
  $("#detailImg").src = img || "";
  $("#detailImg").alt = capName;
  $("#detailName").textContent = capName;

  const typesHtml = types.map(t =>
    <span class="type-badge-lg" style="background:${typeColors[t]};color:#fff;border:2px solid ${typeColors[t]}">${cap(t)}</span>
  ).join("");
  $("#detailTypes").innerHTML = typesHtml;

  $("#detailSpeciesBadge").innerHTML =
    <span class="species-badge" style="background:${typeColors[speciesColor] || "#555"}">${cap(speciesName)} · ${cap(category)}</span>;

  $("#quickHeight").textContent = ${heightM} m;
  $("#quickWeight").textContent = ${weightKg} kg;
  $("#quickCategory").textContent = cap(category);
  $("#quickStatTotal").textContent = totalStats;
  $("#quickCaptureRate").textContent = captureRate;
  $("#quickGrowth").textContent = growthRate;

  $("#detailStats").innerHTML = statsHtml;
  $("#detailStatTotal").textContent = totalStats;
  $("#detailStatCompare").innerHTML = comparisonHtml;

  $("#detailDesc").textContent = desc;
  $("#flavorVersions").innerHTML = flavorHtml;

  $("#detailSpecies").innerHTML = `
    <div class="species-row"><span class="species-label">Especie</span><span class="species-value">${cap(speciesName)}</span></div>
    <div class="species-row"><span class="species-label">Color</span><span class="species-value" style="color:${typeColors[speciesColor] || "#555"}">${cap(speciesColor)}</span></div>
    <div class="species-row"><span class="species-label">Generación</span><span class="species-value">${GEN_MAP[genus] || genus || "—"}</span></div>
  `;
  $("#detailSpeciesExtra").innerHTML = `
    <div class="species-extra-row"><span class="species-extra-label">Base Stats Total</span><span class="species-extra-value">${totalStats}</span></div>
  `;

  $("#detailAbilities").innerHTML = abilities.map(a =>
    `<span class="ability-chip ${a.isHidden ? "hidden-ability" : ""}" title="${a.isHidden ? "Habilidad oculta" : ""}">
      ${cap(a.name)}${a.isHidden ? " ✨" : ""}
    </span>`
  ).join("");

  $("#detailEggGroups").textContent = eggGroups;
  $("#detailGenderRatio").textContent = genderRate;
  $("#detailCaptureRate").textContent = captureRate;
  $("#detailGrowthRate").textContent = growthRate;

  $("#detailVersions").innerHTML = versions.length
    ? versions.map(v => <span class="version-chip">${v}</span>).join("")
    : "<span style='color:var(--text-muted)'>Sin información de versiones</span>";

  // Efectividad
  if (effFiltered.length) {
    $("#detailTypeEffectiveness").innerHTML = effFiltered.map(([t, v]) => {
      const color = v > 1 ? "#e94560" : "#6890F0";
      const label = v > 1
        ? Super efectivo (${Math.round(v * 100)}%)
        : No muy efectivo (${Math.round(v * 100)}%);
      const icon = v > 1 ? "💪" : "🛡️";
      return `
        <div class="type-eff-row">
          <span class="type-eff-type" style="color:${typeColors[t]}">${cap(t)}</span>
          <span class="type-eff-icon">${icon}</span>
          <span class="type-eff-value" style="color:${color}">${label}</span>
        </div>`;
    }).join("");
  } else {
    $("#detailTypeEffectiveness").innerHTML = "<div class='type-eff-empty'>Sin tipos contra los que destacar.</div>";
  }

  $("#detailEvolutionChain").innerHTML = evolutionHtml;

  // Movimientos
  renderMoves(rawMoves);

  // Back image
  $("#detailBackImg").src = backImg || "";
  $("#detailBackImg").alt = ${capName} (espalda);

  // Shiny toggle (si está disponible)
  if (shiny) {
    const imgEl = $("#detailImg");
    const shinyWrapper = $("#detailShiny");
    if (shinyWrapper) {
      shinyWrapper.querySelector("img").src = shiny;
      shinyWrapper.style.display = "none";
      shinyWrapper.querySelector("img").alt = ${capName} (shiny);
      const btn = document.createElement("button");
      btn.className = "shiny-toggle-btn";
      btn.textContent = "✨ Ver Shiny";
      btn.addEventListener("click", () => {
        const isShiny = imgEl.style.display === "none";
        imgEl.style.display = isShiny ? "block" : "none";
        shinyWrapper.style.display = isShiny ? "block" : "none";
        btn.textContent = isShiny ? "👀 Ver Normal" : "✨ Ver Shiny";
      });
      $("#detailImageWrapper").prepend(btn);
    }
  }

  // Cargar cadena de evolución (después del render principal)
  loadEvolutionChain(sp.evolution_chain?.url, id);
}

function loadEvolutionChain(chainUrl, currentId) {
  if (!chainUrl) {
    $("#detailEvolutionChain").innerHTML = "<div class='evolution-empty'>Sin información de evolución disponible.</div>";
    return;
  }
  fetchWithRetry(chainUrl)
    .then(r => r.json())
    .then(chainData => {
      const chain = chainData.chain;
      const html = buildChainHtml(chain, currentId);
      $("#detailEvolutionChain").innerHTML = html;
    })
    .catch(() => {
      $("#detailEvolutionChain").innerHTML = "<div class='evolution-empty'>No se pudo cargar la cadena de evolución.</div>";
    });
}

function buildChainHtml(chain, currentId) {
  const renderNode = (node, isCurrent) => {
    const id = node.species.url.split("/").filter(Boolean).pop();
    const name = cap(node.species.name);
    const isCurrentNode = parseInt(id) === currentId;
    const evolvesTo = node.evolves_to || [];

    let evolvesToHtml = "";
    if (evolvesTo.length > 0) {
      const arrows = evolvesTo.map(e => {
        const eId = e.species.url.split("/").filter(Boolean).pop();
        const eName = cap(e.species.name);
        const methodNode = e.condition_details?.trigger?.name ? cap(e.condition_details.trigger.name.replace(/_/g," ")) : "";
        const method = methodNode || (e.condition_details?.item?.name ? cap(e.condition_details.item.name.replace(/-/g," ")) : (e.condition_details?.gender?.name ? cap(e.condition_details.gender.name) : ""));
        const level = e.condition_details?.min_level || "";
        const minFriends = e.condition_details?.need_friend_station ? "Necesita Estación de Amigos" : "";
        return `
          <div class="evolution-branch">
            <div class="evolution-arrow">→</div>
            <div class="evolution-pokemon">
              <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${eId}.png" alt="${eName}" class="evolution-img" onerror="this.style.display='none'">
              <span class="evolution-name">${eName}</span>
              <span class="evolution-method">${method || level || ""}${minFriends ? " · " + minFriends : ""}</span>
            </div>
            ${renderNode(e, false)}
          </div>`;
      }).join("");
      return `
        <div class="evolution-node${isCurrentNode ? " current" : ""}">
          <div class="evolution-pokemon">
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png" alt="${name}" class="evolution-img" onerror="this.style.display='none'">
            <span class="evolution-name">${name}</span>
            ${isCurrentNode ? "<span class='evolution-current'>Actual</span>" : ""}
          </div>
          <div class="evolution-branch-container">${evolvesToHtml}</div>
        </div>`;
    } else {
      return `
        <div class="evolution-node${isCurrentNode ? " current" : ""}">
          <div class="evolution-pokemon">
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png" alt="${name}" class="evolution-img" onerror="this.style.display='none'">
            <span class="evolution-name">${name}</span>
            ${isCurrentNode ? "<span class='evolution-current'>Actual</span>" : ""}
          </div>
        </div>`;
    }
  };

  return <div class="evolution-chain-container">${renderNode(chain, true)}</div>;
}

function renderMoves(moves) {
  const tbody = $("#detailMoves tbody");
  const capBtn = $("#movesToggleBtn");
  const countLabel = $("#movesCount");

  if (!moves.length) {
    tbody.innerHTML = <tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px">Sin movimientos registrados</td></tr>;
    if (capBtn) capBtn.style.display = "none";
    if (countLabel) countLabel.textContent = "0 movimientos";
    return;
  }

  const MAX_VISIBLE = 15;
  let visibleCount = Math.min(MAX_VISIBLE, moves.length);
  let expanded = false;

  function renderRows(count) {
    const rows = moves.slice(0, count).map((m, i) => {
      const moveName = cap(m.name);
      const method = cap(m.method.replace(/_/g, " "));
      const level = m.level > 0 ? m.level : "—";
      const typeName = m.url ? guessTypeFromUrl(m.url) : "?";
      const typeColor = TYPE_COLORS[typeName] || "#555";
      return `
        <tr>
          <td>#${String(i + 1).padStart(3, "0")}</td>
          <td class="move-name">${moveName}</td>
          <td><span class="move-type-badge" style="background:${typeColor};color:#fff">${typeName}</span></td>
          <td>${method}${m.isHidden ? " ✨" : ""}</td>
          <td>${m.pp || "—"}</td>
          <td>${m.power !== undefined && m.power !== null ? m.power : "—"}</td>
          <td>${m.accuracy !== undefined && m.accuracy !== null ? m.accuracy : "—"}</td>
          <td>${level}</td>
        </tr>`;
    }).join("");
    tbody.innerHTML = rows;
    if (capBtn) {
      capBtn.textContent = visibleCount < moves.length ? Mostrar todos (${moves.length}) : "Ocultar";
      capBtn.style.display = moves.length > MAX_VISIBLE ? "inline-block" : "none";
    }
    if (countLabel) countLabel.textContent = ${visibleCount} de ${moves.length} movimientos;
  }

  renderRows(visibleCount);

  if (capBtn) {
    capBtn.addEventListener("click", () => {
      expanded = !expanded;
      renderRows(expanded ? moves.length : MAX_VISIBLE);
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
