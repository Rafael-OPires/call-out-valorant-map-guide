/*
 * CALL OUT — VALORANT MAP GUIDE
 * Os dados visuais e os callouts-base vêm da API pública valorant-api.com.
 * Os nomes exibidos priorizam termos competitivos comuns (ex.: CT Spawn, T Spawn,
 * Hookah, Heaven e Vents), sem inventar coordenadas para apelidos.
 * A lista abaixo limita a galeria aos mapas tradicionais de Spike que podem
 * fazer parte do modo competitivo; mapas de TDM e áreas de treino são excluídos.
 */

const COMPETITIVE_CAPABLE_MAPS = new Set([
  "abyss", "ascent", "bind", "breeze", "corrode", "fracture", "haven",
  "icebox", "lotus", "pearl", "split", "summit", "sunset"
]);

// Referência da rotação competitiva em 22/10/2026 (Patch 13.08 / V26 Act 6).
// Ajuste este conjunto quando uma nova rotação for publicada.
const CURRENT_COMPETITIVE_ROTATION = new Set([
  "abyss", "bind", "corrode", "haven", "lotus", "summit", "sunset"
]);

const FALLBACK_MAPS = [
  { slug: "abyss", name: "Abyss", description: "Sem limites. Sem segunda chance." },
  { slug: "ascent", name: "Ascent", description: "Controle o meio. Domine a rodada." },
  { slug: "bind", name: "Bind", description: "Dois sites. Teletransportes. Decisões rápidas." },
  { slug: "breeze", name: "Breeze", description: "Longas distâncias exigem precisão." },
  { slug: "corrode", name: "Corrode", description: "Adapte sua estratégia ao terreno." },
  { slug: "fracture", name: "Fracture", description: "Ataque por ângulos inesperados." },
  { slug: "haven", name: "Haven", description: "Três sites. Informação é tudo." },
  { slug: "icebox", name: "Icebox", description: "Altura, verticalidade e controle." },
  { slug: "lotus", name: "Lotus", description: "Rotas dinâmicas e entradas alternativas." },
  { slug: "pearl", name: "Pearl", description: "Leia as rotas e controle os espaços." },
  { slug: "split", name: "Split", description: "Ganhe altura. Proteja as entradas." },
  { slug: "summit", name: "Summit", description: "Conheça cada ângulo antes do confronto." },
  { slug: "sunset", name: "Sunset", description: "Coordenação transforma espaço em vantagem." }
];

function normalizeMapName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getMapSlug(map) {
  const directName = normalizeMapName(map?.displayName || map?.name || "");
  if (COMPETITIVE_CAPABLE_MAPS.has(directName)) return directName;

  const assetPath = normalizeMapName(map?.assetPath || "");
  for (const slug of COMPETITIVE_CAPABLE_MAPS) {
    if (assetPath.includes(slug)) return slug;
  }

  const mapUrl = normalizeMapName(map?.mapUrl || "");
  for (const slug of COMPETITIVE_CAPABLE_MAPS) {
    if (mapUrl.includes(slug)) return slug;
  }
  return "";
}

// Apelidos usados com frequência em comms competitivas. Nem todo time usa exatamente
// o mesmo vocabulário; quando não existe uma equivalência conhecida, preservamos
// o nome do callout do jogo. Os apelidos mantêm a coordenada original do callout.
const GLOBAL_COMPETITIVE_CALLOUT_ALIASES = {
  "attacker side spawn": "T Spawn",
  "attacker spawn": "T Spawn",
  "t spawn": "T Spawn",
  "defender side spawn": "CT Spawn",
  "defender spawn": "CT Spawn",
  "ct spawn": "CT Spawn"
};

const MAP_COMPETITIVE_CALLOUT_ALIASES = {
  ascent: {
    "mid catwalk": "Catwalk",
    "mid market": "Market",
    "mid pizza": "Pizza",
    "mid top": "Top Mid",
    "mid bottom": "Bottom Mid",
    "b boat house": "Boathouse"
  },
  bind: {
    "a bath": "A Showers",
    "b window": "Hookah",
    "a tower": "A Heaven",
    "a teleporter": "A TP",
    "b teleporter": "B TP"
  },
  haven: {
    "a tower": "A Heaven"
  },
  pearl: {
    "b tower": "B Heaven"
  },
  split: {
    "a tower": "A Heaven",
    "b tower": "B Heaven",
    "mid vent": "Vents",
    "a sewer": "Sewers"
  }
};

function rawCalloutName(callout = {}) {
  return String(callout.regionName || callout.name || "Região sem nome").trim();
}

function fullCalloutName(callout = {}) {
  const rawName = rawCalloutName(callout);
  const superRegion = String(callout.superRegionName || callout.site || "").trim();
  if (!superRegion || rawName === "Região sem nome") return rawName;

  const normalizedRaw = normalizeMapName(rawName);
  const normalizedSuper = normalizeMapName(superRegion);
  if (normalizedRaw.startsWith(normalizedSuper)) return rawName;
  return `${superRegion} ${rawName}`.trim();
}

function findCalloutAlias(slug, candidates) {
  const mapAliases = MAP_COMPETITIVE_CALLOUT_ALIASES[slug] || {};
  const aliasSets = [mapAliases, GLOBAL_COMPETITIVE_CALLOUT_ALIASES];
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeMapName(candidate);
    for (const aliases of aliasSets) {
      for (const [source, replacement] of Object.entries(aliases)) {
        if (normalizeMapName(source) === normalizedCandidate) return replacement;
      }
    }
  }
  return "";
}

function getCompetitiveCalloutLabel(slug, callout = {}) {
  const rawName = rawCalloutName(callout);
  const fullName = fullCalloutName(callout);
  // Casos em que a API pode representar Spawn como nome + super-região separados.
  const candidates = [rawName, fullName];
  const alias = findCalloutAlias(slug, candidates);
  if (alias) return alias;
  return fullName;
}

function getCompetitiveRegionLabel(callout = {}) {
  const region = String(callout.superRegionName || callout.site || "Outras regiões").trim();
  const normalized = normalizeMapName(region);
  if (normalized === "defenderside" || normalized === "defenderspawn") return "CT Side";
  if (normalized === "attackerside" || normalized === "attackerspawn") return "T Side";
  return region || "Outras regiões";
}

function mapDescription(slug) {
  return FALLBACK_MAPS.find((map) => map.slug === slug)?.description || "Explore as regiões e posições deste mapa.";
}

function createFallbackMapRecords() {
  return FALLBACK_MAPS.map((fallback) => ({
    ...fallback,
    uuid: fallback.slug,
    displayName: fallback.name,
    description: fallback.description,
    isInCurrentRotation: CURRENT_COMPETITIVE_ROTATION.has(fallback.slug),
    displayIcon: "",
    splash: "",
    listViewIconTall: "",
    stylizedBackgroundImage: "",
    callouts: [],
    xMultiplier: null,
    yMultiplier: null,
    xScalarToAdd: null,
    yScalarToAdd: null,
    isFallback: true
  }));
}

function hasValidTransform(map) {
  return [map?.xMultiplier, map?.yMultiplier, map?.xScalarToAdd, map?.yScalarToAdd]
    .every((value) => typeof value === "number" && Number.isFinite(value));
}

function hasUsableCalloutData(map) {
  if (!hasValidTransform(map) || !Array.isArray(map?.callouts) || map.callouts.length === 0) return false;
  const validCount = map.callouts.filter((callout) =>
    typeof callout?.location?.x === "number"
    && Number.isFinite(callout.location.x)
    && typeof callout?.location?.y === "number"
    && Number.isFinite(callout.location.y)
  ).length;
  // Tenta o endpoint por mapa quando até um único callout veio sem coordenadas.
  return validCount > 0 && validCount === map.callouts.length;
}

async function fetchDetailedMap(uuid) {
  if (!uuid) return null;
  try {
    // Algumas respostas da listagem podem vir sem callouts completos. Reconsultar
    // o endpoint individual evita deixar o mapa inteiro sem pontos desnecessariamente.
    const response = await fetch(`https://valorant-api.com/v1/maps/${encodeURIComponent(uuid)}?language=en-US`, {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.data && typeof payload.data === "object" ? payload.data : null;
  } catch (error) {
    console.warn(`CALL OUT: falha ao buscar detalhes adicionais do mapa ${uuid}.`, error);
    return null;
  }
}

async function completeMapData(map) {
  if (hasUsableCalloutData(map)) return map;

  const detailed = await fetchDetailedMap(map.uuid);
  if (!detailed) return map;

  const merged = {
    ...map,
    ...detailed,
    // Preserva metadados do guia mesmo quando a resposta detalhada não os contém.
    slug: map.slug,
    description: map.description,
    isInCurrentRotation: map.isInCurrentRotation,
    isFallback: false
  };
  return hasUsableCalloutData(merged) ? merged : map;
}

async function fetchValorantMaps() {
  const url = "https://valorant-api.com/v1/maps?language=en-US";
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`A API respondeu com status ${response.status}.`);

  const payload = await response.json();
  if (!Array.isArray(payload.data)) throw new Error("A resposta da API não contém uma lista de mapas.");

  const filtered = payload.data
    .map((map) => ({ ...map, slug: getMapSlug(map) }))
    .filter((map) => map.slug && COMPETITIVE_CAPABLE_MAPS.has(map.slug))
    .map((map) => ({
      ...map,
      displayName: map.displayName || FALLBACK_MAPS.find((entry) => entry.slug === map.slug)?.name || map.slug,
      description: mapDescription(map.slug),
      isInCurrentRotation: CURRENT_COMPETITIVE_ROTATION.has(map.slug),
      isFallback: false
    }));

  // Primeiro tenta usar a listagem, que exige só uma requisição. Apenas mapas
  // sem transformação ou sem coordenadas acionam a busca individual de backup.
  const completed = await Promise.all(filtered.map(completeMapData));
  const bySlug = new Map(completed.map((map) => [map.slug, map]));
  const fallbackRecords = createFallbackMapRecords();
  return FALLBACK_MAPS.map((fallback) => bySlug.get(fallback.slug)
    || fallbackRecords.find((map) => map.slug === fallback.slug));
}
