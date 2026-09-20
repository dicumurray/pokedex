// ============================================================
// POKÉDEX — Lista de Pokémon (index.html)
// Consume PokeAPI v2 para mostrar todos los Pokémon en una grid
// ============================================================

const POKEAPI_BASE = 'https://pokeapi.co/api/v2';
const TOTAL_POKEMON = 300; // cantidad a cargar (se puede aumentar)
const grid = document.getElementById('pokemonGrid');
const searchInput = document.getElementById('searchInput');
const countBadge = document.getElementById('countBadge');
const loading = document.getElementById('loading');

// ── Carga inicial ──
let allPokemon = []; // acá acumulamos todos los objetos

async function fetchAllPokemon() {
  loading.classList.remove('hidden');

  // 1) Obtener la lista de todos (solo nombre + URL)
  const listRes = await fetch(`${POKEAPI_BASE}/pokemon?limit=${TOTAL_POKEMON}`);
  const listData = await listRes.json();
  allPokemon = listData.results;

  // 2) Cargar los detalles de cada uno (bulk)
  //    para no saturar la API, hacemos peticiones en lotes de 10
  const batchSize = 10;
  for (let i = 0; i < allPokemon.length; i += batchSize) {
    const batch = allPokemon.slice(i, i + batchSize);
    const details = await Promise.all(
      batch.map(p => fetch(p.url).then(r => r.json()))
    );
    details.forEach((d, idx) => {
      const original = batch[idx];
      original._detail = d; // adjuntamos los detalles al objeto
    });
    // actualizar badge cada lote
    countBadge.textContent = `Cargando ${Math.min(i + batchSize, TOTAL_POKEMON)} / ${TOTAL_POKEMON}`;
  }

  countBadge.textContent = `${TOTAL_POKEMON} Pokémon`;
  renderGrid(allPokemon);
  loading.classList.add('hidden');
}

// ── Renderizar grid ──
function renderGrid(pokemonList) {
  grid.innerHTML = '';

  pokemonList.forEach((p, index) => {
    const detail = p._detail;
    if (!detail) return;

    const card = document.createElement('div');
    card.className = 'pokemon-card';
    card.style.animationDelay = `${(index % 20) * 0.03}s`;

    // Número desde el ID
    const id = detail.id;
    const idStr = `#${String(id).padStart(3, '0')}`;

    // Imagen (sprites.versions.red-blue.ales')
    const imgUrl = detail.sprites.other['official-artwork'].front_default
      || detail.sprites.front_default;

    // Tipos
    const types = detail.types.map(t => ({
      name: t.type.name,
      color: typeColor(t.type.name)
    }));

    card.innerHTML = `
      <span class="card-number">${idStr}</span>
      <div class="card-img-wrapper">
        <img class="card-img" src="${imgUrl}" alt="${p.name}" loading="lazy" onerror="this.src='https://via.placeholder.com/96?text=💥'">
      </div>
      <div class="card-name">${capitalize(p.name)}</div>
      <div class="card-types">
        ${types.map(t => `<span class="type-badge" style="background:${t.color};color:#fff;">${capitalize(t.name)}</span>`).join('')}
      </div>
    `;

    // Click → detail.html con el ID
    card.addEventListener('click', () => {
      window.location.href = `detail.html?id=${id}`;
    });

    grid.appendChild(card);
  });
}

// ── Búsqueda en vivo ──
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase().trim();
  if (!query) {
    renderGrid(allPokemon);
    return;
  }

  const filtered = allPokemon.filter(p => {
    const name = p.name.toLowerCase();
    const id = String(p._detail?.id ?? '').padStart(3, '0');
    return name.includes(query) || id.includes(query);
  });

  countBadge.textContent = `${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`;
  renderGrid(filtered);
});

// ── Filtros por tipo (checkbox decorativo en la página) ──
// Se pueden añadir filtros en el HTML; este es un ejemplo básico.
// No implementado en este archivo — se puede añadir según necesidad.

// ── Utilidades ──
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

// ── Inicio ──
fetchAllPokemon().catch(err => {
  loading.innerHTML = `<p style="color:#e94560;">Error al cargar: ${err.message}</p>`;
  console.error(err);
});
