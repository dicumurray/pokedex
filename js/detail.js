// ============================================================
// POKÉDEX — Detalle de un Pokémon (detail.html)
// Consume PokeAPI v2 para mostrar las características de un Pokémon
// ============================================================

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const loading = document.getElementById('detailLoading');
const content = document.getElementById('detailContent');

// Leer el ID desde la URL (?id=25)
const params = new URLSearchParams(window.location.search);
const pokemonId = params.get('id');

if (!pokemonId) {
  loading.innerHTML = '<p style="color:#e94560;">Sin ID de Pokémon. Usa: detail.html?id=25</p>';
  loading.classList.remove('hidden');
  throw new Error('Sin ID');
}

// ── Cargar y renderizar ──
(async () => {
  try {
    loading.classList.remove('hidden');
    content.classList.add('hidden');

    const res = await fetch(`${POKEAPI_BASE}/pokemon/${pokemonId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const p = await res.json();

    renderDetail(p);
    loading.classList.add('hidden');
    content.classList.remove('hidden');

  } catch (err) {
    loading.innerHTML = `<p style="color:#e94560;">Error: ${err.message}</p>`;
    console.error(err);
  }
})();

// ── Renderizado ──
function renderDetail(p) {
  const id = p.id;
  const idStr = `#${String(id).padStart(3, '0')}`;
  const name = p.name;

  // Imagen (artista oficial preferido)
  const imgUrl = p.sprites.other['official-artwork'].front_default
    || p.sprites.other.showdown.front_default
    || p.sprites.front_default;

  // Imagen de espalda
  const backImgUrl = p.sprites.back_default;

  // Tipos
  const typesHtml = p.types.map(t => {
    const color = typeColor(t.type.name);
    return `<span class="type-badge-lg" style="background:${color};color:#fff;border:2px solid ${color};">${capitalize(t.type.name)}</span>`;
  }).join('');

  // Estadísticas
  const statsHtml = p.stats.map(s => {
    const color = statColor(s.stat.name);
    const maxVal = 255;
    const pct = Math.min(100, (s.base_stat / maxVal) * 100);
    return `
      <div class="stat-row">
        <span class="stat-label">${capitalize(s.stat.name)}</span>
        <div class="stat-bar-bg">
          <div class="stat-bar" style="width:${pct}%;background:${color};"></div>
        </div>
        <span class="stat-value">${s.base_stat}</span>
      </div>
    `;
  }).join('');

  // Total de stats
  const totalStats = p.stats.reduce((sum, s) => sum + s.base_stat, 0);

  // Descripción (de la especie, en inglés para mayor cobertura)
  const speciesUrl = p.species.url;
  // Cargamos la descripción en paralelo (no bloqueante para el render principal)
  fetchSpeciesDesc(speciesUrl).then(desc => {
    document.getElementById('detailDesc').textContent = desc || 'Sin descripción disponible.';
  });

  // Especie
  document.getElementById('detailSpecies').textContent =
    capitalize(p.species.name) + ' — ' + (p.species.color?.name || 'unknown');

  // Tamaño y peso
  const heightM = (p.height / 10).toFixed(2);
  const weightKg = (p.weight / 100).toFixed(2);
  document.getElementById('detailSize').innerHTML = `
    <div class="size-item">
      <div class="size-label">Altura</div>
      <div class="size-value">${heightM} m</div>
    </div>
    <div class="size-item">
      <div class="size-label">Peso</div>
      <div class="size-value">${weightKg} kg</div>
    </div>
  `;

  // Habilidades
  const abilitiesHtml = p.abilities.map(a => {
    const isHidden = a.is_hidden;
    return `<span class="ability-chip" style="${isHidden ? 'border-color:#f5a623;color:#f5a623;' : ''}">
      ${capitalize(a.ability.name)}${isHidden ? ' ✨' : ''}
    </span>`;
  }).join('');
  document.getElementById('detailAbilities').innerHTML = abilitiesHtml;

  // Versiones (generaciones donde aparece)
  const gameIndeces = p.species.game_indices || [];
  const versionNames = gameIndeces.map(g => {
    // Las versiones están en p.game_indices o se puede obtener de la especie
    return g.version?.name || `gen-${g.generation?.name || g.version?.name || 'unknown'}`;
  });
  // Si no hay game_indices, usar los juegos de la especie
  if (versionNames.length === 0 && p.species) {
    // La especie tiene los game_indices; los obtenemos de ahí
    // Pero ya cargamos speciesUrl arriba, así que usamos lo que tenemos
  }
  // Como fallback, usar los grupos de versiones del Pokémon
  const versions = p.versions || [];
  const versionListHtml = versions.map(v => {
    const verName = v.version?.name || 'unknown';
    return `<span class="version-chip">${capitalize(verName.replace('-', ' '))}</span>`;
  }).join('');
  document.getElementById('detailVersions').innerHTML = versionListHtml || '<span style="color:var(--text-muted);">Sin información de versiones</span>';

  // Rellenar los campos del DOM
  document.getElementById('detailNumber').textContent = idStr;
  document.getElementById('detailImg').src = imgUrl;
  document.getElementById('detailImg').alt = capitalize(name);
  document.getElementById('detailName').textContent = capitalize(name);
  document.getElementById('detailTypes').innerHTML = typesHtml;
  document.getElementById('detailStats').innerHTML = statsHtml;
  document.getElementById('detailStatTotal').innerHTML =
    `Total de estadísticas: <strong>${totalStats}</strong>`;
  document.getElementById('detailBackImg').src = backImgUrl || '';
}

// ── Cargar descripción de la especie ──
async function fetchSpeciesDesc(speciesUrl) {
  try {
    const res = await fetch(speciesUrl);
    const species = await res.json();
    // Descripción en inglés (la más completa)
    const descEntry = species.flavor_text_entries
      .filter(e => e.language?.name === 'en' && !e.version?.name?.startsWith('university'))
      .sort((a, b) => (b.version?.name ? 1 : 0) - (a.version?.name ? 1 : 0))[0];
    return descEntry?.flavor_text || 'Sin descripción.';
  } catch {
    return 'Sin descripción disponible.';
  }
}

// ── Utilidades ──
function capitalize(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ');
}

function typeColor(typeName) {
  const colors = {
    normal:      '#A8A878',
    fire:        '#F08030',
    water:       '#6890F0',
    electric:    '#F8D030',
    grass:       '#78C850',
    ice:         '#98D8D8',
    fighting:    '#C03028',
    poison:      '#A850A8',
    ground:      '#E0C068',
    flying:      '#A890F0',
    psychic:     '#F85888',
    bug:         '#A8B820',
    rock:        '#B8A038',
    ghost:       '#705898',
    dragon:      '#7038F8',
    dark:        '#705848',
    steel:       '#B8B8D0',
    fairy:       '#EE99AC',
  };
  return colors[typeName] || '#AAAAAA';
}

function statColor(statName) {
  const colors = {
    hp:           '#FF6B6B',
    attack:       '#F08030',
    defense:      '#6890F0',
    special_attack: '#F8D030',
    special_defense: '#78C850',
    speed:        '#A890F0',
  };
  return colors[statName] || '#AAAAAA';
}
