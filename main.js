const dom = {};
let maps = [];
let currentFilter = "all";
let selectedMap = null;
let selectedRegion = "all";
let selectedCalloutKey = "";
let calloutQuery = "";
let mapQuery = "";
const PIN_OVERRIDES_STORAGE_KEY = "call-out-valorant-pin-overrides-v1";
const PIN_LANGUAGE_STORAGE_KEY = "call-out-pin-language-v1";
const PIN_LANGUAGES = [
  { value: "en-US", label: "English" },
  { value: "de-DE", label: "Deutsch" },
  { value: "es-ES", label: "Español (España)" },
  { value: "es-MX", label: "Español (Latinoamérica)" },
  { value: "fr-FR", label: "Français" },
  { value: "id-ID", label: "Bahasa Indonesia" },
  { value: "it-IT", label: "Italiano" },
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "ar-AE", label: "العربية" },
  { value: "pl-PL", label: "Polski" },
  { value: "ru-RU", label: "Русский" },
  { value: "tr-TR", label: "Türkçe" },
  { value: "zh-TW", label: "中文（繁體）" },
  { value: "vi-VN", label: "Tiếng Việt" },
  { value: "th-TH", label: "ภาษาไทย" },
  { value: "ja-JP", label: "日本語" },
  { value: "ko-KR", label: "한국어" }
];
// Todos os idiomas do VALORANT ficam disponíveis. A API fornece os nomes
// localizados quando existem; os dicionários locais complementam termos em inglês.
let availablePinLanguages = [...PIN_LANGUAGES];
const localizedCalloutCache = new Map();
let localizationRequestId = 0;
let pinLanguage = readPinLanguage();
const PIN_OVERRIDES = window.CALL_OUT_PIN_OVERRIDES && typeof window.CALL_OUT_PIN_OVERRIDES === "object"
  ? window.CALL_OUT_PIN_OVERRIDES
  : {};
let localPinOverrides = readLocalPinOverrides();

const ROTATION_LABELS = {
  all: "Todos",
  active: "Em rotação",
  inactive: "Fora da rotação"
};

function cacheDom() {
  [
    "menu-toggle", "main-nav", "maps-grid", "map-search", "empty-state",
    "visible-map-count", "all-filter-count", "api-status", "clear-filters",
    "hero-map-count", "filter-button", "guia", "guide-title", "guide-subtitle",
    "close-guide", "minimap-stage", "minimap-image", "callout-markers",
    "map-coordinate", "callout-total", "callout-search", "region-filters",
    "selected-callout", "selected-callout-name", "selected-callout-region", "callout-list", "pin-language",
  ].forEach((id) => {
    if (id === "filter-button") return;
    dom[id] = document.getElementById(id);
  });
  dom.filters = [...document.querySelectorAll(".filter-button")];
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function statusLabel(map) {
  return map.isInCurrentRotation ? "EM ROTAÇÃO" : "FORA DA ROTAÇÃO";
}

function mapImage(map) {
  return map.splash || map.listViewIconTall || map.stylizedBackgroundImage || map.listViewIcon || "";
}

function mapCardMarkup(map, index) {
  const image = mapImage(map);
  const safeName = escapeHtml(map.displayName);
  const activeClass = map.isInCurrentRotation ? "rotation-active" : "rotation-inactive";
  const hasApiImage = image ? "has-map-image" : "no-map-image";
  return `
    <button class="map-card ${hasApiImage}" type="button" data-map-slug="${escapeHtml(map.slug)}" aria-label="Explorar mapa ${safeName}" style="--card-index:${index}">
      <span class="map-card-art">
        ${image ? `<img src="${escapeHtml(image)}" alt="Arte do mapa ${safeName}" loading="lazy" onerror="this.remove();this.parentElement.classList.add('art-fallback')">` : ""}
        <span class="map-art-grid" aria-hidden="true"></span>
        <span class="map-card-number">MAP_${String(index + 1).padStart(2, "0")}</span>
        <span class="map-card-open" aria-hidden="true">↗</span>
        <span class="map-card-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="map-card-rotation ${activeClass}"><i></i>${statusLabel(map)}</span>
      </span>
      <span class="map-card-info">
        <span class="map-card-title">${safeName}<b aria-hidden="true">↗</b></span>
        <span class="map-card-desc">${escapeHtml(map.description)}</span>
        <span class="map-card-meta"><span>MAPA TÁTICO</span><span>${getPositionableCalloutCount(map)} PINS</span></span>
      </span>
    </button>`;
}

function filteredMaps() {
  const query = normalizeMapName(mapQuery.trim());
  return maps.filter((map) => {
    const matchesQuery = normalizeMapName(map.displayName).includes(query);
    const matchesRotation = currentFilter === "all"
      || (currentFilter === "active" && map.isInCurrentRotation)
      || (currentFilter === "inactive" && !map.isInCurrentRotation);
    return matchesQuery && matchesRotation;
  });
}

function renderMaps() {
  const visible = filteredMaps();
  dom["maps-grid"].innerHTML = visible.length
    ? visible.map(mapCardMarkup).join("")
    : "";
  dom["visible-map-count"].textContent = String(visible.length).padStart(2, "0");
  dom["all-filter-count"].textContent = String(maps.length);
  dom["hero-map-count"].textContent = String(maps.length).padStart(2, "0");
  dom["empty-state"].classList.toggle("hidden", visible.length > 0);
  dom["maps-grid"].classList.toggle("hidden", visible.length === 0);
  dom.filters.forEach((button) => {
    const active = button.dataset.filter === currentFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

// Tradução apenas visual dos rótulos. Os nomes canônicos da API continuam
// sendo usados para identificar callouts e encontrar correções manuais.
const PIN_EXACT_TRANSLATIONS_PT = {
  "ct spawn": "Base dos Defensores",
  "t spawn": "Base dos Atacantes",
  "ct side": "Lado dos Defensores",
  "t side": "Lado dos Atacantes",
  "top mid": "Meio Superior",
  "bottom mid": "Meio Inferior",
  "a heaven": "Céu A",
  "b heaven": "Céu B",
  "a site": "Site A",
  "b site": "Site B",
  "a main": "Principal A",
  "b main": "Principal B",
  "a showers": "Chuveiros A",
  "a lobby": "Saguão A",
  "b lobby": "Saguão B",
  "a long": "Longo A",
  "b long": "Longo B",
  "a short": "Curto A",
  "b short": "Curto B",
  "a link": "Ligação A",
  "b link": "Ligação B"
};

// Termos genéricos frequentes. Nomes próprios e callouts sem tradução segura
// (por exemplo, Hookah, Pizza ou nomes específicos de áreas) permanecem intactos.
const PIN_TERM_TRANSLATIONS_PT = [
  ["attacker side", "lado dos atacantes"],
  ["defender side", "lado dos defensores"],
  ["underpass", "passagem inferior"],
  ["staircase", "escadaria"],
  ["hallway", "corredor"],
  ["showers", "chuveiros"],
  ["boathouse", "casa do barco"],
  ["catwalk", "passarela"],
  ["containers", "contêineres"],
  ["container", "contêiner"],
  ["courtyard", "pátio"],
  ["connector", "conector"],
  ["warehouse", "armazém"],
  ["workshop", "oficina"],
  ["basement", "subsolo"],
  ["stairwell", "caixa de escadas"],
  ["teleporter", "teletransportador"],
  ["pyramids", "pirâmides"],
  ["pyramid", "pirâmide"],
  ["rafters", "vigas"],
  ["screens", "telas"],
  ["barrels", "barris"],
  ["barrel", "barril"],
  ["elbow", "cotovelo"],
  ["pipes", "tubos"],
  ["yellow", "amarelo"],
  ["orange", "laranja"],
  ["switch", "interruptor"],
  ["cubby", "recuo"],
  ["alley", "viela"],
  ["attic", "sótão"],
  ["plaza", "praça"],
  ["ruins", "ruínas"],
  ["rubble", "escombros"],
  ["chamber", "câmara"],
  ["water", "água"],
  ["boat", "barco"],
  ["dock", "doca"],
  ["cave", "caverna"],
  ["ropes", "cordas"],
  ["rope", "corda"],
  ["tower", "torre"],
  ["nest", "ninho"],
  ["lab", "laboratório"],
  ["defender", "defensor"],
  ["attacker", "atacante"],
  ["market", "mercado"],
  ["heaven", "céu"],
  ["garden", "jardim"],
  ["window", "janela"],
  ["tree", "árvore"],
  ["stairs", "escadas"],
  ["stair", "escada"],
  ["tunnel", "túnel"],
  ["garage", "garagem"],
  ["kitchen", "cozinha"],
  ["bridge", "ponte"],
  ["platform", "plataforma"],
  ["boiler", "caldeira"],
  ["sewers", "esgotos"],
  ["vents", "dutos"],
  ["ramp", "rampa"],
  ["top", "superior"],
  ["middle", "meio"],
  ["lower", "inferior"],
  ["upper", "superior"],
  ["bottom", "inferior"],
  ["front", "frente"],
  ["back", "fundos"],
  ["short", "curto"],
  ["long", "longo"],
  ["spawn", "base"],
  ["main", "principal"],
  ["mid", "meio"],
  ["link", "ligação"],
  ["hall", "salão"],
  ["door", "porta"],
  ["box", "caixa"],
  ["site", "site"]
];

function readPinLanguage() {
  try {
    const saved = localStorage.getItem(PIN_LANGUAGE_STORAGE_KEY);
    // Migra a preferência antiga "en" para o locale atual da API.
    if (saved === "en") return "en-US";
    return PIN_LANGUAGES.some((language) => language.value === saved) ? saved : "en-US";
  } catch (error) {
    return "en-US";
  }
}

// Complemento local para os callouts que a API ainda devolve em inglês.
// A nomenclatura do jogo varia por região e comunidade; nomes próprios e termos
// táticos específicos que não tenham equivalência segura permanecem como vieram.
const PIN_TERM_TRANSLATION_KEYS = [
  "underpass", "staircase", "hallway", "showers", "catwalk", "courtyard",
  "connector", "warehouse", "workshop", "basement", "teleporter", "pyramid",
  "rafters", "screens", "barrels", "pipes", "alley", "attic", "plaza", "ruins",
  "water", "boat", "dock", "cave", "tower", "lab", "defender", "attacker",
  "market", "heaven", "garden", "window", "tree", "stairs", "tunnel", "garage",
  "kitchen", "bridge", "platform", "sewers", "vents", "ramp", "top", "middle",
  "lower", "upper", "bottom", "front", "back", "short", "long", "spawn", "main",
  "mid", "link", "hall", "door", "box", "site"
];

// Cada lista segue exatamente a ordem de PIN_TERM_TRANSLATION_KEYS.
// São traduções complementares: quando a API já entrega o nome localizado,
// o texto da API tem prioridade e estes termos não são alterados.
const PIN_TERM_TRANSLATIONS_BY_LOCALE = {
  "de-DE": `Unterführung|Treppe|Flur|Duschen|Laufsteg|Innenhof|Verbindung|Lagerhaus|Werkstatt|Keller|Teleporter|Pyramide|Dachbalken|Bildschirme|Fässer|Rohre|Gasse|Dachboden|Platz|Ruinen|Wasser|Boot|Anleger|Höhle|Turm|Labor|Verteidiger|Angreifer|Markt|Himmel|Garten|Fenster|Baum|Treppen|Tunnel|Garage|Küche|Brücke|Plattform|Kanalisation|Lüftung|Rampe|Oben|Mitte|Unterer Bereich|Oberer Bereich|Unten|Vorne|Hinten|Kurz|Lang|Spawnpunkt|Haupteingang|Mitte|Verbindung|Halle|Tür|Kiste|Bereich`.split("|"),
  "es-ES": `Pasadizo|Escalera|Pasillo|Duchas|Pasarela|Patio|Conector|Almacén|Taller|Sótano|Teletransportador|Pirámide|Vigas|Pantallas|Barriles|Tuberías|Callejón|Ático|Plaza|Ruinas|Agua|Barco|Muelle|Cueva|Torre|Laboratorio|Defensor|Atacante|Mercado|Cielo|Jardín|Ventana|Árbol|Escaleras|Túnel|Garaje|Cocina|Puente|Plataforma|Alcantarillas|Conductos|Rampa|Superior|Medio|Inferior|Superior|Inferior|Delante|Detrás|Corto|Largo|Aparición|Principal|Medio|Conexión|Pasillo|Puerta|Caja|Zona`.split("|"),
  "es-MX": `Pasadizo|Escalera|Pasillo|Duchas|Pasarela|Patio|Conector|Almacén|Taller|Sótano|Teletransportador|Pirámide|Vigas|Pantallas|Barriles|Tuberías|Callejón|Ático|Plaza|Ruinas|Agua|Barco|Muelle|Cueva|Torre|Laboratorio|Defensor|Atacante|Mercado|Cielo|Jardín|Ventana|Árbol|Escaleras|Túnel|Garaje|Cocina|Puente|Plataforma|Alcantarillas|Conductos|Rampa|Superior|Medio|Inferior|Superior|Inferior|Delante|Detrás|Corto|Largo|Aparición|Principal|Medio|Conexión|Pasillo|Puerta|Caja|Zona`.split("|"),
  "fr-FR": `Passage souterrain|Escalier|Couloir|Douches|Passerelle|Cour|Connecteur|Entrepôt|Atelier|Sous-sol|Téléporteur|Pyramide|Poutres|Écrans|Barils|Tuyaux|Ruelle|Grenier|Place|Ruines|Eau|Bateau|Quai|Grotte|Tour|Laboratoire|Défenseur|Attaquant|Marché|Ciel|Jardin|Fenêtre|Arbre|Escaliers|Tunnel|Garage|Cuisine|Pont|Plateforme|Égouts|Conduits|Rampe|Haut|Milieu|Inférieur|Supérieur|Bas|Avant|Arrière|Court|Long|Apparition|Principal|Milieu|Liaison|Hall|Porte|Caisse|Site`.split("|"),
  "id-ID": `Jalur bawah|Tangga|Lorong|Kamar mandi|Jalur|Halaman|Penghubung|Gudang|Bengkel|Ruang bawah tanah|Teleporter|Piramida|Balok|Layar|Tong|Pipa|Gang|Loteng|Plaza|Reruntuhan|Air|Perahu|Dermaga|Gua|Menara|Lab|Pembela|Penyerang|Pasar|Surga|Taman|Jendela|Pohon|Tangga|Terowongan|Garasi|Dapur|Jembatan|Platform|Selokan|Ventilasi|Jalur landai|Atas|Tengah|Bawah|Atas|Bawah|Depan|Belakang|Pendek|Panjang|Titik muncul|Utama|Tengah|Penghubung|Aula|Pintu|Kotak|Area`.split("|"),
  "it-IT": `Sottopassaggio|Scala|Corridoio|Docce|Passerella|Cortile|Collegamento|Magazzino|Officina|Seminterrato|Teletrasporto|Piramide|Travi|Schermi|Barili|Tubi|Vicolo|Soffitta|Piazza|Rovine|Acqua|Barca|Molo|Grotta|Torre|Laboratorio|Difensore|Attaccante|Mercato|Paradiso|Giardino|Finestra|Albero|Scale|Tunnel|Garage|Cucina|Ponte|Piattaforma|Fogne|Condotti|Rampa|Alto|Centro|Inferiore|Superiore|Basso|Davanti|Dietro|Corto|Lungo|Punto di comparsa|Principale|Centro|Collegamento|Sala|Porta|Cassa|Sito`.split("|"),
  "ar-AE": `ممر سفلي|درج|ممر|حمامات|ممر|ساحة|رابط|مستودع|ورشة|قبو|ناقل آني|هرم|عوارض|شاشات|براميل|أنابيب|زقاق|علية|ساحة|أطلال|ماء|قارب|رصيف|كهف|برج|مختبر|مدافع|مهاجم|سوق|الجنة|حديقة|نافذة|شجرة|سلالم|نفق|مرآب|مطبخ|جسر|منصة|مجاري|فتحات تهوية|منحدر|أعلى|وسط|سفلي|علوي|أسفل|أمام|خلف|قصير|طويل|نقطة ظهور|رئيسي|وسط|رابط|قاعة|باب|صندوق|موقع`.split("|"),
  "pl-PL": `Przejście podziemne|Schody|Korytarz|Prysznice|Kładka|Dziedziniec|Łącznik|Magazyn|Warsztat|Piwnica|Teleporter|Piramida|Belki|Ekrany|Beczki|Rury|Zaułek|Strych|Plac|Ruiny|Woda|Łódź|Dok|Jaskinia|Wieża|Laboratorium|Obrońca|Atakujący|Targ|Niebo|Ogród|Okno|Drzewo|Schody|Tunel|Garaż|Kuchnia|Most|Platforma|Kanały|Wentylacja|Rampa|Góra|Środek|Dolny|Górny|Dół|Przód|Tył|Krótki|Długi|Punkt odrodzenia|Główny|Środek|Łącznik|Hala|Drzwi|Skrzynia|Strefa`.split("|"),
  "ru-RU": `Подземный проход|Лестница|Коридор|Душевые|Переход|Двор|Соединение|Склад|Мастерская|Подвал|Телепорт|Пирамида|Балки|Экраны|Бочки|Трубы|Переулок|Чердак|Площадь|Руины|Вода|Лодка|Причал|Пещера|Башня|Лаборатория|Защитник|Атакующий|Рынок|Рай|Сад|Окно|Дерево|Лестница|Туннель|Гараж|Кухня|Мост|Платформа|Канализация|Вентиляция|Рампа|Верх|Середина|Нижний|Верхний|Низ|Перед|Зад|Короткий|Длинный|Точка появления|Главный|Мид|Связка|Зал|Дверь|Ящик|Точка`.split("|"),
  "tr-TR": `Alt geçit|Merdiven|Koridor|Duşlar|Yürüyüş yolu|Avlu|Bağlantı|Depo|Atölye|Bodrum|Işınlayıcı|Piramit|Kirişler|Ekranlar|Variller|Borular|Ara sokak|Çatı katı|Meydan|Kalıntılar|Su|Tekne|Rıhtım|Mağara|Kule|Laboratuvar|Savunmacı|Saldıran|Market|Cennet|Bahçe|Pencere|Ağaç|Merdivenler|Tünel|Garaj|Mutfak|Köprü|Platform|Kanalizasyon|Havalandırma|Rampa|Üst|Orta|Alt|Üst|Alt|Ön|Arka|Kısa|Uzun|Doğuş noktası|Ana|Orta|Bağlantı|Salon|Kapı|Kutu|Bölge`.split("|"),
  "zh-TW": `地下通道|樓梯|走廊|淋浴間|走道|庭院|連接道|倉庫|工坊|地下室|傳送點|金字塔|橫樑|螢幕|木桶|管線|小巷|閣樓|廣場|廢墟|水|船|碼頭|洞穴|高塔|實驗室|防守方|攻擊方|市集|天堂|花園|窗戶|樹|樓梯|隧道|車庫|廚房|橋|平台|下水道|通風口|斜坡|上方|中間|下層|上層|下方|前方|後方|短|長|出生點|主路|中路|連接道|大廳|門|箱子|區域`.split("|"),
  "vi-VN": `Đường ngầm|Cầu thang|Hành lang|Phòng tắm|Lối đi|Sân|Lối nối|Nhà kho|Xưởng|Tầng hầm|Dịch chuyển|Kim tự tháp|Xà|Màn hình|Thùng|Đường ống|Ngõ|Gác mái|Quảng trường|Tàn tích|Nước|Thuyền|Bến tàu|Hang động|Tháp|Phòng thí nghiệm|Phe thủ|Phe công|Chợ|Thiên đường|Vườn|Cửa sổ|Cây|Cầu thang|Đường hầm|Nhà để xe|Nhà bếp|Cầu|Nền tảng|Cống rãnh|Ống thông gió|Dốc|Trên|Giữa|Dưới|Trên|Dưới|Trước|Sau|Ngắn|Dài|Điểm xuất hiện|Chính|Giữa|Kết nối|Sảnh|Cửa|Thùng|Khu vực`.split("|"),
  "th-TH": `ทางลอด|บันได|โถงทางเดิน|ห้องอาบน้ำ|ทางเดิน|ลาน|ทางเชื่อม|โกดัง|โรงซ่อม|ห้องใต้ดิน|เครื่องเคลื่อนย้าย|พีระมิด|คาน|หน้าจอ|ถัง|ท่อ|ตรอก|ห้องใต้หลังคา|ลานกว้าง|ซากปรักหักพัง|น้ำ|เรือ|ท่าเรือ|ถ้ำ|หอคอย|ห้องแล็บ|ฝ่ายป้องกัน|ฝ่ายโจมตี|ตลาด|สวรรค์|สวน|หน้าต่าง|ต้นไม้|บันได|อุโมงค์|โรงรถ|ห้องครัว|สะพาน|แท่น|ท่อระบายน้ำ|ช่องระบายอากาศ|ทางลาด|บน|กลาง|ล่าง|บน|ล่าง|หน้า|หลัง|สั้น|ยาว|จุดเกิด|หลัก|กลาง|ทางเชื่อม|โถง|ประตู|กล่อง|พื้นที่`.split("|"),
  "ja-JP": `地下通路|階段|廊下|シャワー|通路|中庭|接続通路|倉庫|作業場|地下室|テレポーター|ピラミッド|梁|スクリーン|樽|パイプ|路地|屋根裏|広場|遺跡|水|ボート|桟橋|洞窟|塔|研究所|防衛側|攻撃側|マーケット|ヘブン|庭|窓|木|階段|トンネル|ガレージ|キッチン|橋|足場|下水道|通気口|スロープ|上|中央|下層|上層|下|前|後ろ|ショート|ロング|スポーン|メイン|ミッド|リンク|ホール|ドア|箱|サイト`.split("|"),
  "ko-KR": `지하 통로|계단|복도|샤워실|통로|안뜰|연결 통로|창고|작업장|지하실|텔레포터|피라미드|들보|스크린|통|파이프|골목|다락방|광장|폐허|물|보트|부두|동굴|탑|연구소|수비팀|공격팀|시장|헤븐|정원|창문|나무|계단|터널|차고|주방|다리|플랫폼|하수구|환풍구|경사로|위쪽|중앙|아래쪽|위쪽|아래쪽|앞쪽|뒤쪽|짧은|긴|스폰|메인|미드|연결로|홀|문|상자|구역`.split("|")
};

// Complementos dos termos adicionais existentes no dicionário completo de português.
const PIN_EXTRA_TERM_TRANSLATIONS_BY_LOCALE = {
  "de-DE": { "lobby": "Lobby", "boathouse": "Bootshaus", "containers": "Container", "container": "Container", "stairwell": "Treppenhaus", "pyramids": "Pyramiden", "barrel": "Fass", "elbow": "Ecke", "yellow": "Gelb", "orange": "Orange", "switch": "Schalter", "cubby": "Nische", "rubble": "Trümmer", "chamber": "Kammer", "ropes": "Seile", "rope": "Seil", "nest": "Nest", "stair": "Stufe", "boiler": "Kessel" },
  "es-ES": { "lobby": "Vestíbulo", "boathouse": "Casa de botes", "containers": "Contenedores", "container": "Contenedor", "stairwell": "Caja de escaleras", "pyramids": "Pirámides", "barrel": "Barril", "elbow": "Esquina", "yellow": "Amarillo", "orange": "Naranja", "switch": "Interruptor", "cubby": "Hueco", "rubble": "Escombros", "chamber": "Cámara", "ropes": "Cuerdas", "rope": "Cuerda", "nest": "Nido", "stair": "Escalón", "boiler": "Caldera" },
  "es-MX": { "lobby": "Vestíbulo", "boathouse": "Casa de botes", "containers": "Contenedores", "container": "Contenedor", "stairwell": "Caja de escaleras", "pyramids": "Pirámides", "barrel": "Barril", "elbow": "Esquina", "yellow": "Amarillo", "orange": "Naranja", "switch": "Interruptor", "cubby": "Hueco", "rubble": "Escombros", "chamber": "Cámara", "ropes": "Cuerdas", "rope": "Cuerda", "nest": "Nido", "stair": "Escalón", "boiler": "Caldera" },
  "fr-FR": { "lobby": "Hall", "boathouse": "Hangar à bateaux", "containers": "Conteneurs", "container": "Conteneur", "stairwell": "Cage d'escalier", "pyramids": "Pyramides", "barrel": "Baril", "elbow": "Coude", "yellow": "Jaune", "orange": "Orange", "switch": "Interrupteur", "cubby": "Renfoncement", "rubble": "Débris", "chamber": "Chambre", "ropes": "Cordes", "rope": "Corde", "nest": "Nid", "stair": "Marche", "boiler": "Chaudière" },
  "id-ID": { "lobby": "Lobi", "boathouse": "Rumah perahu", "containers": "Kontainer-kontainer", "container": "Kontainer", "stairwell": "Tangga", "pyramids": "Piramida-piramida", "barrel": "Tong", "elbow": "Belokan", "yellow": "Kuning", "orange": "Oranye", "switch": "Sakelar", "cubby": "Celah", "rubble": "Puing", "chamber": "Ruang", "ropes": "Tali-tali", "rope": "Tali", "nest": "Sarang", "stair": "Anak tangga", "boiler": "Ketel" },
  "it-IT": { "lobby": "Atrio", "boathouse": "Rimessa barche", "containers": "Contenitori", "container": "Container", "stairwell": "Vano scale", "pyramids": "Piramidi", "barrel": "Barile", "elbow": "Angolo", "yellow": "Giallo", "orange": "Arancione", "switch": "Interruttore", "cubby": "Nicchia", "rubble": "Macerie", "chamber": "Camera", "ropes": "Corde", "rope": "Corda", "nest": "Nido", "stair": "Gradino", "boiler": "Caldaia" },
  "ar-AE": { "lobby": "الردهة", "boathouse": "كوخ القوارب", "containers": "حاويات", "container": "حاوية", "stairwell": "بيت الدرج", "pyramids": "أهرامات", "barrel": "برميل", "elbow": "زاوية", "yellow": "أصفر", "orange": "برتقالي", "switch": "مفتاح", "cubby": "تجويف", "rubble": "حطام", "chamber": "غرفة", "ropes": "حبال", "rope": "حبل", "nest": "عش", "stair": "درجة", "boiler": "مرجل" },
  "pl-PL": { "lobby": "Lobby", "boathouse": "Przystań", "containers": "Kontenery", "container": "Kontener", "stairwell": "Klatka schodowa", "pyramids": "Piramidy", "barrel": "Beczka", "elbow": "Zakret", "yellow": "Żółty", "orange": "Pomarańczowy", "switch": "Przełącznik", "cubby": "Wnęka", "rubble": "Gruz", "chamber": "Komnata", "ropes": "Liny", "rope": "Lina", "nest": "Gniazdo", "stair": "Stopień", "boiler": "Kocioł" },
  "ru-RU": { "lobby": "Лобби", "boathouse": "Лодочный домик", "containers": "Контейнеры", "container": "Контейнер", "stairwell": "Лестничная клетка", "pyramids": "Пирамиды", "barrel": "Бочка", "elbow": "Угол", "yellow": "Жёлтый", "orange": "Оранжевый", "switch": "Переключатель", "cubby": "Ниша", "rubble": "Обломки", "chamber": "Камера", "ropes": "Верёвки", "rope": "Верёвка", "nest": "Гнездо", "stair": "Ступень", "boiler": "Котёл" },
  "tr-TR": { "lobby": "Lobi", "boathouse": "Kayıkhane", "containers": "Konteynerler", "container": "Konteyner", "stairwell": "Merdiven boşluğu", "pyramids": "Piramitler", "barrel": "Varil", "elbow": "Dirsek", "yellow": "Sarı", "orange": "Turuncu", "switch": "Anahtar", "cubby": "Girinti", "rubble": "Enkaz", "chamber": "Oda", "ropes": "Halatlar", "rope": "Halat", "nest": "Yuva", "stair": "Basamak", "boiler": "Kazan" },
  "zh-TW": { "lobby": "大廳", "boathouse": "船屋", "containers": "貨櫃", "container": "貨櫃", "stairwell": "樓梯間", "pyramids": "金字塔群", "barrel": "木桶", "elbow": "轉角", "yellow": "黃色", "orange": "橘色", "switch": "開關", "cubby": "凹室", "rubble": "瓦礫", "chamber": "房間", "ropes": "繩索", "rope": "繩子", "nest": "巢穴", "stair": "階梯", "boiler": "鍋爐" },
  "vi-VN": { "lobby": "Sảnh", "boathouse": "Nhà thuyền", "containers": "Các thùng chứa", "container": "Thùng chứa", "stairwell": "Buồng cầu thang", "pyramids": "Các kim tự tháp", "barrel": "Thùng", "elbow": "Khúc cua", "yellow": "Màu vàng", "orange": "Màu cam", "switch": "Công tắc", "cubby": "Hốc", "rubble": "Đống đổ nát", "chamber": "Căn phòng", "ropes": "Dây thừng", "rope": "Dây thừng", "nest": "Tổ", "stair": "Bậc thang", "boiler": "Nồi hơi" },
  "th-TH": { "lobby": "ล็อบบี้", "boathouse": "โรงเรือ", "containers": "ตู้คอนเทนเนอร์", "container": "ตู้คอนเทนเนอร์", "stairwell": "โถงบันได", "pyramids": "พีระมิด", "barrel": "ถัง", "elbow": "มุม", "yellow": "สีเหลือง", "orange": "สีส้ม", "switch": "สวิตช์", "cubby": "ซอก", "rubble": "เศษซาก", "chamber": "ห้อง", "ropes": "เชือก", "rope": "เชือก", "nest": "รัง", "stair": "ขั้นบันได", "boiler": "หม้อต้ม" },
  "ja-JP": { "lobby": "ロビー", "boathouse": "ボートハウス", "containers": "コンテナ", "container": "コンテナ", "stairwell": "階段室", "pyramids": "ピラミッド群", "barrel": "樽", "elbow": "曲がり角", "yellow": "黄色", "orange": "オレンジ", "switch": "スイッチ", "cubby": "くぼみ", "rubble": "がれき", "chamber": "部屋", "ropes": "ロープ", "rope": "ロープ", "nest": "巣", "stair": "段差", "boiler": "ボイラー" },
  "ko-KR": { "lobby": "로비", "boathouse": "보트하우스", "containers": "컨테이너들", "container": "컨테이너", "stairwell": "계단실", "pyramids": "피라미드들", "barrel": "통", "elbow": "모퉁이", "yellow": "노란색", "orange": "주황색", "switch": "스위치", "cubby": "움푹한 곳", "rubble": "잔해", "chamber": "방", "ropes": "밧줄들", "rope": "밧줄", "nest": "둥지", "stair": "계단", "boiler": "보일러" }
};

const PIN_EXACT_TRANSLATIONS_BY_LOCALE = {
  "de-DE": { "attacker side": "Angreiferseite", "defender side": "Verteidigerseite", "ct spawn": "Basis der Verteidiger", "t spawn": "Basis der Angreifer", "ct side": "Verteidigerseite", "t side": "Angreiferseite", "top mid": "Obere Mitte", "bottom mid": "Untere Mitte" },
  "es-ES": { "attacker side": "Lado atacante", "defender side": "Lado defensor", "ct spawn": "Base defensora", "t spawn": "Base atacante", "ct side": "Lado defensor", "t side": "Lado atacante", "top mid": "Medio superior", "bottom mid": "Medio inferior" },
  "es-MX": { "attacker side": "Lado atacante", "defender side": "Lado defensor", "ct spawn": "Base defensora", "t spawn": "Base atacante", "ct side": "Lado defensor", "t side": "Lado atacante", "top mid": "Medio superior", "bottom mid": "Medio inferior" },
  "fr-FR": { "attacker side": "Côté attaquant", "defender side": "Côté défenseur", "ct spawn": "Base des défenseurs", "t spawn": "Base des attaquants", "ct side": "Côté défenseur", "t side": "Côté attaquant", "top mid": "Milieu haut", "bottom mid": "Milieu bas" },
  "id-ID": { "attacker side": "Sisi Attacker", "defender side": "Sisi Defender", "ct spawn": "Markas Defender", "t spawn": "Markas Attacker", "ct side": "Sisi Defender", "t side": "Sisi Attacker", "top mid": "Mid Atas", "bottom mid": "Mid Bawah" },
  "it-IT": { "attacker side": "Lato attaccanti", "defender side": "Lato difensori", "ct spawn": "Spawn difensori", "t spawn": "Spawn attaccanti", "ct side": "Lato difensori", "t side": "Lato attaccanti", "top mid": "Centro alto", "bottom mid": "Centro basso" },
  "ar-AE": { "attacker side": "جانب المهاجمين", "defender side": "جانب المدافعين", "ct spawn": "ظهور المدافعين", "t spawn": "ظهور المهاجمين", "ct side": "جانب المدافعين", "t side": "جانب المهاجمين", "top mid": "منتصف علوي", "bottom mid": "منتصف سفلي" },
  "pl-PL": { "attacker side": "Strona atakujących", "defender side": "Strona obrońców", "ct spawn": "Spawn obrońców", "t spawn": "Spawn atakujących", "ct side": "Strona obrońców", "t side": "Strona atakujących", "top mid": "Górny środek", "bottom mid": "Dolny środek" },
  "ru-RU": { "attacker side": "Сторона атаки", "defender side": "Сторона защиты", "ct spawn": "Спавн защитников", "t spawn": "Спавн атакующих", "ct side": "Сторона защиты", "t side": "Сторона атаки", "top mid": "Верх мида", "bottom mid": "Низ мида" },
  "tr-TR": { "attacker side": "Saldırı tarafı", "defender side": "Savunma tarafı", "ct spawn": "Savunmacı doğuşu", "t spawn": "Saldıran doğuşu", "ct side": "Savunma tarafı", "t side": "Saldırı tarafı", "top mid": "Üst orta", "bottom mid": "Alt orta" },
  "zh-TW": { "attacker side": "攻擊方側", "defender side": "防守方側", "ct spawn": "防守方出生點", "t spawn": "攻擊方出生點", "ct side": "防守方側", "t side": "攻擊方側", "top mid": "中路上方", "bottom mid": "中路下方" },
  "vi-VN": { "attacker side": "Phía tấn công", "defender side": "Phía phòng thủ", "ct spawn": "Điểm xuất hiện phe thủ", "t spawn": "Điểm xuất hiện phe công", "ct side": "Phía phòng thủ", "t side": "Phía tấn công", "top mid": "Giữa trên", "bottom mid": "Giữa dưới" },
  "th-TH": { "attacker side": "ฝั่งโจมตี", "defender side": "ฝั่งป้องกัน", "ct spawn": "จุดเกิดฝ่ายป้องกัน", "t spawn": "จุดเกิดฝ่ายโจมตี", "ct side": "ฝั่งป้องกัน", "t side": "ฝั่งโจมตี", "top mid": "กลางบน", "bottom mid": "กลางล่าง" },
  "ja-JP": { "attacker side": "攻撃側", "defender side": "防衛側", "ct spawn": "ディフェンダースポーン", "t spawn": "アタッカースポーン", "ct side": "防衛側", "t side": "攻撃側", "top mid": "ミッド上部", "bottom mid": "ミッド下部" },
  "ko-KR": { "attacker side": "공격팀 쪽", "defender side": "수비팀 쪽", "ct spawn": "수비팀 스폰", "t spawn": "공격팀 스폰", "ct side": "수비팀 쪽", "t side": "공격팀 쪽", "top mid": "미드 상단", "bottom mid": "미드 하단" }
};

function buildPinTermTranslations() {
  const dictionaries = {};
  Object.entries(PIN_TERM_TRANSLATIONS_BY_LOCALE).forEach(([locale, words]) => {
    if (words.length !== PIN_TERM_TRANSLATION_KEYS.length) {
      console.warn(`CALL OUT: dicionário de ${locale} tem ${words.length} termos; esperado ${PIN_TERM_TRANSLATION_KEYS.length}.`);
      return;
    }
    dictionaries[locale] = Object.fromEntries(PIN_TERM_TRANSLATION_KEYS.map((key, index) => [key, words[index]]));
  });
  return dictionaries;
}

const PIN_TERM_TRANSLATIONS = buildPinTermTranslations();

function localizePinLabel(label = "") {
  const original = String(label);
  if (pinLanguage === "en-US" || !original.trim()) return original;

  if (pinLanguage === "pt-BR") {
    const exactTranslation = PIN_EXACT_TRANSLATIONS_PT[original.trim().toLowerCase()];
    if (exactTranslation) return exactTranslation;

    return [...PIN_TERM_TRANSLATIONS_PT]
      .sort((a, b) => b[0].length - a[0].length)
      .reduce((result, [source, translated]) => {
        const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, "gi");
        return result.replace(pattern, (_match, prefix) => `${prefix}${translated}`);
      }, original)
      .replace(/(^|[\s\/-])([a-zà-ÿ])/gi, (_match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("pt-BR")}`)
      .replace(/\b(Dos|Das|De|Da|Do|E)\b/g, (word) => word.toLocaleLowerCase("pt-BR"));
  }

  const exactTranslation = PIN_EXACT_TRANSLATIONS_BY_LOCALE[pinLanguage]?.[normalizeTranslationText(original)];
  if (exactTranslation) return exactTranslation;

  const terms = {
    ...(PIN_TERM_TRANSLATIONS[pinLanguage] || {}),
    ...(PIN_EXTRA_TERM_TRANSLATIONS_BY_LOCALE[pinLanguage] || {})
  };
  let translated = [...Object.entries(terms)]
    .sort((a, b) => b[0].length - a[0].length)
    .reduce((result, [source, target]) => {
      const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`(^|[^A-Za-z0-9])${escaped}(?=$|[^A-Za-z0-9])`, "gi");
      return result.replace(pattern, (_match, prefix) => `${prefix}${target}`);
    }, original);

  // Em muitos idiomas, a letra do site vem depois do nome (ex.: Céu A, Mercado B).
  if (!['ja-JP', 'ko-KR', 'zh-TW', 'th-TH'].includes(pinLanguage)) {
    translated = translated.replace(/^([AB])\s+(.+)$/i, (_match, site, area) => `${area} ${site.toUpperCase()}`);
  }

  // Capitaliza o início de labels latinos sem interferir em alfabetos não latinos.
  translated = translated.replace(/^([a-zà-ÿ])/i, (letter) => letter.toLocaleUpperCase(pinLanguage));
  return translated;
}

function getCalloutName(mapSlug, callout) {
  return getCompetitiveCalloutLabel(mapSlug, callout);
}

function getCalloutRegion(callout) {
  return getCompetitiveRegionLabel(callout);
}

function calloutKey(callout, index, mapSlug) {
  const location = callout?.location || {};
  return `${normalizeMapName(getCalloutRegion(callout))}-${normalizeMapName(getCalloutName(mapSlug, callout))}-${location.x ?? "x"}-${location.y ?? "y"}-${index}`;
}

function normalizeCoordinates(map, callout) {
  const location = callout?.location;
  const required = [map?.xMultiplier, map?.yMultiplier, map?.xScalarToAdd, map?.yScalarToAdd];
  if (!location
    || typeof location.x !== "number" || !Number.isFinite(location.x)
    || typeof location.y !== "number" || !Number.isFinite(location.y)
    || required.some((number) => typeof number !== "number" || !Number.isFinite(number))) return null;

  // Fórmula da minimapa do VALORANT: o eixo Y do mundo vira X na imagem e
  // o eixo X do mundo vira Y na imagem. Não girar nem espelhar a imagem.
  const x = (location.y * map.xMultiplier + map.xScalarToAdd) * 100;
  const y = (location.x * map.yMultiplier + map.yScalarToAdd) * 100;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  // Callouts legítimos podem encostar ou passar um pouco da borda. Em vez de
  // descartá-los e deixar um item sem pin, aceitamos uma margem mais ampla e
  // prendemos o marcador à borda visível. Outliers extremos continuam inválidos.
  if (x < -20 || x > 120 || y < -20 || y > 120) return null;
  return { x: Math.min(99, Math.max(1, x)), y: Math.min(99, Math.max(1, y)) };
}

function readLocalPinOverrides() {
  try {
    const value = localStorage.getItem(PIN_OVERRIDES_STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn("CALL OUT: não foi possível ler as correções locais dos pins.", error);
    return {};
  }
}


function getManualPinOverride(mapSlug, overrideId) {
  const localMap = localPinOverrides?.[mapSlug];
  const staticMap = PIN_OVERRIDES?.[mapSlug];
  const localValue = localMap && Object.prototype.hasOwnProperty.call(localMap, overrideId)
    ? localMap[overrideId]
    : null;
  const value = isValidManualPosition(localValue)
    ? localValue
    : staticMap?.[overrideId];
  return isValidManualPosition(value) ? value : null;
}

function isValidManualPosition(position) {
  return Boolean(position
    && typeof position.x === "number" && Number.isFinite(position.x) && position.x >= 0 && position.x <= 100
    && typeof position.y === "number" && Number.isFinite(position.y) && position.y >= 0 && position.y <= 100);
}

function normalizeManualPosition(position) {
  if (!isValidManualPosition(position)) return null;
  return {
    x: Math.min(99, Math.max(1, position.x)),
    y: Math.min(99, Math.max(1, position.y))
  };
}

function sameCalloutLocation(first, second) {
  const a = first?.location || {};
  const b = second?.location || {};
  return typeof a.x === "number" && typeof a.y === "number"
    && typeof b.x === "number" && typeof b.y === "number"
    && Math.abs(a.x - b.x) < 0.000001
    && Math.abs(a.y - b.y) < 0.000001;
}

function alignLocalizedCallouts(baseCallouts, localizedCallouts) {
  if (!Array.isArray(baseCallouts) || !Array.isArray(localizedCallouts)
    || baseCallouts.length === 0 || baseCallouts.length !== localizedCallouts.length) return null;

  const usedIndexes = new Set();
  const aligned = baseCallouts.map((baseCallout, baseIndex) => {
    const localizedIndex = localizedCallouts.findIndex((candidate, index) =>
      !usedIndexes.has(index) && sameCalloutLocation(baseCallout, candidate));
    if (localizedIndex < 0) return null;
    usedIndexes.add(localizedIndex);
    return localizedCallouts[localizedIndex];
  });

  return aligned.every(Boolean) ? aligned : null;
}

function normalizeTranslationText(value = "") {
  return String(value).normalize("NFKC").trim().toLocaleLowerCase();
}

function renderPinLanguageOptions() {
  const select = dom["pin-language"];
  if (!select) return;
  const previousLanguage = pinLanguage;

  select.innerHTML = availablePinLanguages.map((language) =>
    `<option value="${escapeHtml(language.value)}">${escapeHtml(language.label)}</option>`
  ).join("");

  if (!availablePinLanguages.some((language) => language.value === pinLanguage)) {
    pinLanguage = "en-US";
    try {
      localStorage.setItem(PIN_LANGUAGE_STORAGE_KEY, pinLanguage);
    } catch (error) {
      console.warn("CALL OUT: não foi possível atualizar a preferência de idioma.", error);
    }
  }
  select.value = pinLanguage;

  if (selectedMap && previousLanguage !== pinLanguage) {
    selectedMap.localizedLocale = "";
    selectedMap.localizedCallouts = null;
    loadSelectedMapLocalization(selectedMap);
  }
}

function validatePinLanguageOptions() {
  const select = dom["pin-language"];
  if (!select) return;

  availablePinLanguages = [...PIN_LANGUAGES];
  renderPinLanguageOptions();
  select.disabled = false;
}

async function fetchLocalizedCallouts(map, locale) {
  if (!map?.uuid || !Array.isArray(map.callouts) || !map.callouts.length) return null;
  const cacheKey = `${map.uuid}:${locale}`;
  if (!localizedCalloutCache.has(cacheKey)) {
    const request = (async () => {
      try {
        const url = `https://valorant-api.com/v1/maps/${encodeURIComponent(map.uuid)}?language=${encodeURIComponent(locale)}`;
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`A API respondeu com status ${response.status}.`);
        const payload = await response.json();
        const localized = payload?.data?.callouts;
        const aligned = alignLocalizedCallouts(map.callouts, localized);
        if (!aligned) throw new Error("A API não retornou callouts localizados compatíveis com o minimapa.");
        return aligned;
      } catch (error) {
        console.warn(`CALL OUT: não foi possível carregar os nomes no idioma ${locale}.`, error);
        return null;
      }
    })();
    localizedCalloutCache.set(cacheKey, request);
  }
  return localizedCalloutCache.get(cacheKey);
}

async function loadSelectedMapLocalization(map) {
  const requestId = ++localizationRequestId;
  if (!map || pinLanguage === "en-US") {
    if (map) {
      map.localizedLocale = "en-US";
      map.localizedCallouts = null;
    }
    if (selectedMap === map) renderCallouts();
    return;
  }

  const localized = await fetchLocalizedCallouts(map, pinLanguage);
  if (requestId !== localizationRequestId || selectedMap !== map) return;

  if (localized) {
    map.localizedLocale = pinLanguage;
    map.localizedCallouts = localized;
  } else {
    map.localizedLocale = "";
    map.localizedCallouts = null;
  }
  renderCallouts();
}

function getLocalizedCallout(map, index) {
  if (!map || map.localizedLocale !== pinLanguage || !Array.isArray(map.localizedCallouts)) return null;
  return map.localizedCallouts[index] || null;
}

function calloutEntries(map) {
  const usedOverrideIds = new Map();
  return (Array.isArray(map?.callouts) ? map.callouts : []).map((callout, index) => {
    // A versão em inglês continua sendo a fonte canônica para IDs e pins manuais.
    const sourceName = fullCalloutName(callout);
    const canonicalName = getCalloutName(map.slug, callout);
    const canonicalRegion = getCalloutRegion(callout);
    const localizedCallout = getLocalizedCallout(map, index);
    const localizedRawName = localizedCallout ? rawCalloutName(localizedCallout) : "";
    const sourceRawName = rawCalloutName(callout);
    const localizedNameIsEnglishUnchanged = localizedRawName
      && normalizeTranslationText(localizedRawName) === normalizeTranslationText(sourceRawName);
    const localizedName = localizedCallout
      ? (localizedNameIsEnglishUnchanged ? canonicalName : fullCalloutName(localizedCallout))
      : "";
    const localizedRegion = localizedCallout
      ? String(localizedCallout.superRegionName || localizedCallout.site || "").trim()
      : "";
    const sourceRegion = String(callout.superRegionName || callout.site || "").trim();
    const localizedRegionIsEnglishUnchanged = localizedRegion
      && normalizeTranslationText(localizedRegion) === normalizeTranslationText(sourceRegion);
    const name = localizedName || canonicalName;
    const region = localizedRegion && !localizedRegionIsEnglishUnchanged ? localizedRegion : canonicalRegion;
    const baseId = `${normalizeMapName(canonicalRegion) || "outrasregioes"}__${normalizeMapName(sourceName) || `callout${index + 1}`}`;
    const occurrence = (usedOverrideIds.get(baseId) || 0) + 1;
    usedOverrideIds.set(baseId, occurrence);
    const overrideId = occurrence > 1 ? `${baseId}__${occurrence}` : baseId;
    const manualPosition = getManualPinOverride(map.slug, overrideId);
    const coordinates = normalizeManualPosition(manualPosition) || normalizeCoordinates(map, callout);

    return {
      ...callout,
      _key: calloutKey(callout, index, map.slug),
      _index: index,
      _sourceName: sourceName,
      _name: name,
      _region: region,
      _displayName: localizePinLabel(name),
      _displayRegion: localizePinLabel(region),
      _overrideId: overrideId,
      _hasManualPosition: Boolean(manualPosition),
      _coordinates: coordinates
    };
  });
}

function getPositionableCalloutCount(map) {
  return calloutEntries(map).filter((entry) => entry._coordinates).length;
}

function visibleCallouts() {
  if (!selectedMap) return [];
  const query = normalizeMapName(calloutQuery.trim());
  return calloutEntries(selectedMap).filter((callout) => {
    const matchesQuery = !query || normalizeMapName(`${callout._name} ${callout._sourceName} ${callout._region} ${callout._displayName} ${callout._displayRegion}`).includes(query);
    const matchesRegion = selectedRegion === "all" || normalizeMapName(callout._region) === selectedRegion;
    return matchesQuery && matchesRegion;
  });
}

function createMarker(callout) {
  if (!callout._coordinates) return "";
  const selected = callout._key === selectedCalloutKey;
  const manualClass = callout._hasManualPosition ? "manual-position" : "";
  const title = `${callout._displayName} — ${callout._displayRegion}${callout._hasManualPosition ? " (posição manual)" : ""}`;
  return `<button type="button" class="callout-pin ${selected ? "selected" : ""} ${manualClass}" data-callout-key="${escapeHtml(callout._key)}" style="left:${callout._coordinates.x}%;top:${callout._coordinates.y}%" title="${escapeHtml(title)}" aria-label="Selecionar ${escapeHtml(title)}"><span>${escapeHtml(callout._displayName)}</span></button>`;
}

function renderRegionFilters(entries) {
  const regions = [...new Set(entries.map((entry) => entry._region).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  const buttons = [{ label: "Todas", value: "all" }, ...regions.map((region) => ({ label: localizePinLabel(region), value: normalizeMapName(region) }))];
  dom["region-filters"].innerHTML = buttons.map((region) => `
    <button class="region-filter ${selectedRegion === region.value ? "active" : ""}" type="button" data-region="${escapeHtml(region.value)}" aria-pressed="${selectedRegion === region.value}">${escapeHtml(region.label)}</button>
  `).join("");
}

function renderSelectedCallout(entry) {
  const selectedPanel = dom["selected-callout"];
  if (!entry) {
    selectedPanel.classList.add("hidden");
    return;
  }
  selectedPanel.classList.remove("hidden");
  dom["selected-callout-name"].textContent = entry._displayName;
  dom["selected-callout-region"].textContent = entry._displayRegion;
}

function renderCallouts() {
  if (!selectedMap) return;
  const allEntries = calloutEntries(selectedMap);
  const positionedEntries = allEntries.filter((entry) => entry._coordinates);
  const missingCoordinates = allEntries.length - positionedEntries.length;
  const visible = visibleCallouts();
  dom["callout-total"].textContent = `${positionedEntries.length}/${allEntries.length} PINS`;
  renderRegionFilters(allEntries);

  const warning = missingCoordinates > 0
    ? `<p class="callout-empty">${missingCoordinates} callout(s) vieram sem coordenadas utilizáveis e não podem receber um pin. Os outros continuam disponíveis.</p>`
    : "";
  const listMarkup = visible.length
    ? visible.map((entry, index) => `
        <button class="callout-row ${entry._key === selectedCalloutKey ? "active" : ""}" type="button" data-callout-key="${escapeHtml(entry._key)}">
          <span class="callout-row-number">${String(index + 1).padStart(2, "0")}</span>
          <span class="callout-row-copy"><strong>${escapeHtml(entry._displayName)}</strong><small>${escapeHtml(entry._displayRegion)}${entry._coordinates ? "" : " · SEM COORDENADA"}${entry._hasManualPosition ? " · POSIÇÃO MANUAL" : ""}</small></span>
          <span class="callout-row-arrow" aria-hidden="true">↗</span>
        </button>`).join("")
    : `<p class="callout-empty">${allEntries.length ? "Nenhum callout corresponde à busca." : "Não há dados de callouts para este mapa. Verifique a conexão/API e tente novamente."}</p>`;
  dom["callout-list"].innerHTML = warning + listMarkup;

  const selected = allEntries.find((entry) => entry._key === selectedCalloutKey);
  renderSelectedCallout(selected);
  renderMarkers(visible);
}

function renderMarkers(entries) {
  const markers = entries.map(createMarker).join("");
  dom["callout-markers"].innerHTML = markers;
  dom["callout-markers"].classList.toggle("no-markers", !markers);
}

function selectCallout(key) {
  selectedCalloutKey = key;
  const allEntries = calloutEntries(selectedMap);
  const selected = allEntries.find((entry) => entry._key === key);
  if (selected) {
    // A seleção do callout deve continuar visível mesmo quando um filtro está ativo.
    calloutQuery = "";
    dom["callout-search"].value = "";
    const regionValue = normalizeMapName(selected._region);
    if (selectedRegion !== "all" && selectedRegion !== regionValue) selectedRegion = "all";
  }
  renderCallouts();
}

function fitMinimapToStage() {
  const img = dom["minimap-image"];
  const wrap = document.getElementById("minimap-wrap");
  const stage = dom["minimap-stage"];
  if (!img?.naturalWidth || !img?.naturalHeight || !wrap || !stage) return;

  const ratio = img.naturalWidth / img.naturalHeight;
  if (!Number.isFinite(ratio) || ratio <= 0) return;

  const stageStyle = window.getComputedStyle(stage);
  const paddingX = (parseFloat(stageStyle.paddingLeft) || 0) + (parseFloat(stageStyle.paddingRight) || 0);
  const paddingY = (parseFloat(stageStyle.paddingTop) || 0) + (parseFloat(stageStyle.paddingBottom) || 0);
  const availableWidth = Math.max(120, stage.clientWidth - paddingX);
  const availableHeight = Math.max(160, stage.clientHeight - paddingY);
  const maxHeight = Math.min(availableHeight, Math.max(220, window.innerHeight * 0.72));
  const width = Math.min(availableWidth, 610, maxHeight * ratio);
  const height = width / ratio;

  // A imagem e a camada de pins compartilham a mesma caixa sem letterboxing.
  // Limitamos largura e altura para minimapas verticais não serem cortadas pelo stage.
  wrap.style.width = `${width}px`;
  wrap.style.height = `${height}px`;
  wrap.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
}

function openMap(map) {
  selectedMap = map;
  selectedRegion = "all";
  selectedCalloutKey = "";
  calloutQuery = "";
  dom["callout-search"].value = "";
  dom["guide-title"].innerHTML = `${escapeHtml(map.displayName).toUpperCase()} <span>DATABASE.</span>`;
  const rotationCopy = map.isInCurrentRotation ? "Este mapa está marcado como parte da rotação competitiva de referência." : "Este mapa está fora da rotação competitiva de referência, mas foi mantido no guia.";
  dom["guide-subtitle"].textContent = `${rotationCopy} Selecione uma região ou procure um callout.`;
  dom["map-coordinate"].textContent = map.coordinates || `MAP // ${map.slug.toUpperCase()}`;
  dom["callout-markers"].innerHTML = "";
  dom["callout-list"].innerHTML = `<p class="callout-empty"><span class="loader"></span> Carregando dados das regiões…</p>`;
  dom["region-filters"].innerHTML = "";
  dom["selected-callout"].classList.add("hidden");
  dom["callout-total"].textContent = "… CALLS";

  const img = dom["minimap-image"];
  const minimapWrap = document.getElementById("minimap-wrap");
  const minimapUrl = map.displayIcon || map.listViewIcon || "";
  const placeholder = dom["minimap-stage"].querySelector(".minimap-placeholder");
  // A moldura de pins começa quadrada até a imagem nova carregar. Depois ela
  // assume a proporção nativa da minimapa para que os pins não sejam deslocados
  // pelos espaços que object-fit: contain criaria nas laterais ou no topo.
  if (minimapWrap) {
    minimapWrap.style.width = "";
    minimapWrap.style.height = "";
    minimapWrap.style.aspectRatio = "1 / 1";
  }
  if (minimapUrl) {
    img.alt = `Minimapa de ${map.displayName}`;
    img.classList.add("hidden");
    img.onerror = () => {
      img.removeAttribute("src");
      img.classList.add("hidden");
      if (minimapWrap) {
        minimapWrap.style.width = "";
        minimapWrap.style.height = "";
        minimapWrap.style.aspectRatio = "1 / 1";
      }
      placeholder?.classList.remove("hidden");
      if (placeholder) placeholder.innerHTML = `<strong>${escapeHtml(map.displayName.toUpperCase())}</strong><span>MINIMAPA INDISPONÍVEL</span>`;
    };
    img.onload = () => {
      fitMinimapToStage();
      img.classList.remove("hidden");
      placeholder?.classList.add("hidden");
    };
    img.src = minimapUrl;
    if (img.complete && img.naturalWidth > 0) {
      fitMinimapToStage();
      img.classList.remove("hidden");
      placeholder?.classList.add("hidden");
    }
  } else {
    img.removeAttribute("src");
    img.classList.add("hidden");
    placeholder?.classList.remove("hidden");
    if (placeholder) placeholder.innerHTML = `<strong>${escapeHtml(map.displayName.toUpperCase())}</strong><span>Conecte-se à internet para carregar a minimapa.</span>`;
  }

  dom["guia"].classList.remove("hidden");
  renderCallouts();
  loadSelectedMapLocalization(map);
  dom["guia"].scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeMapGuide() {
  dom["guia"].classList.add("hidden");
  selectedMap = null;
  document.getElementById("mapas").scrollIntoView({ behavior: "smooth", block: "start" });
}

function setApiStatus(message, mode = "") {
  dom["api-status"].textContent = message;
  dom["api-status"].className = `api-status ${mode}`.trim();
}

async function initMaps() {
  try {
    maps = await fetchValorantMaps();
    const sourceFallback = maps.filter((map) => map.isFallback).length;
    const mapsWithPins = maps.filter((map) => getPositionableCalloutCount(map) > 0).length;
    const mapsWithoutPins = maps.filter((map) => getPositionableCalloutCount(map) === 0).map((map) => map.displayName);
    const partialMaps = maps.filter((map) => {
      const entries = calloutEntries(map);
      return entries.length > 0 && entries.some((entry) => !entry._coordinates);
    }).map((map) => map.displayName);

    renderMaps();
    console.table(maps.map((map) => ({
      map: map.displayName,
      source: map.isFallback ? "fallback" : "API",
      callouts: Array.isArray(map.callouts) ? map.callouts.length : 0,
      pins: getPositionableCalloutCount(map),
      transform: hasValidTransform(map)
    })));

    if (sourceFallback === maps.length) {
      setApiStatus("Sem conexão com a API: a galeria está disponível, mas minimapas e pontos dependem da internet.", "warning");
    } else if (mapsWithoutPins.length || partialMaps.length) {
      const missingText = mapsWithoutPins.length ? `Sem pins: ${mapsWithoutPins.join(", ")}. ` : "";
      const partialText = partialMaps.length ? `Callouts sem coordenada: ${partialMaps.join(", ")}.` : "";
      setApiStatus(`${mapsWithPins}/${maps.length} mapas com pins carregados. ${missingText}${partialText}`, "warning");
      console.warn("CALL OUT: verifique os dados de coordenadas para estes mapas.", { mapsWithoutPins, partialMaps });
    } else {
      setApiStatus(`Dados carregados de valorant-api.com • pins disponíveis em ${mapsWithPins}/${maps.length} mapas.`, "success");
    }
    validatePinLanguageOptions();
  } catch (error) {
    maps = createFallbackMapRecords();
    renderMaps();
    setApiStatus("Modo offline: nomes dos mapas disponíveis. Conecte-se à internet para carregar minimapas, artes e callouts.", "warning");
    console.warn("CALL OUT: não foi possível carregar os dados da API.", error);
    validatePinLanguageOptions();
  }
}

function setupEvents() {
  window.addEventListener("resize", () => {
    if (selectedMap) fitMinimapToStage();
  });
  dom["map-search"].addEventListener("input", (event) => {
    mapQuery = event.target.value;
    renderMaps();
  });

  dom.filters.forEach((button) => button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    renderMaps();
  }));

  dom["maps-grid"].addEventListener("click", (event) => {
    const card = event.target.closest("[data-map-slug]");
    if (!card) return;
    const map = maps.find((entry) => entry.slug === card.dataset.mapSlug);
    if (map) openMap(map);
  });

  dom["clear-filters"].addEventListener("click", () => {
    mapQuery = "";
    currentFilter = "all";
    dom["map-search"].value = "";
    renderMaps();
  });

  dom["close-guide"].addEventListener("click", closeMapGuide);

  dom["callout-search"].addEventListener("input", (event) => {
    calloutQuery = event.target.value;
    renderCallouts();
  });

  renderPinLanguageOptions();
  dom["pin-language"].disabled = false;
  dom["pin-language"].addEventListener("change", (event) => {
    const requestedLanguage = event.target.value;
    pinLanguage = availablePinLanguages.some((language) => language.value === requestedLanguage)
      ? requestedLanguage
      : "en-US";
    selectedRegion = "all";
    try {
      localStorage.setItem(PIN_LANGUAGE_STORAGE_KEY, pinLanguage);
    } catch (error) {
      console.warn("CALL OUT: não foi possível salvar a preferência de idioma.", error);
    }
    if (selectedMap) {
      renderCallouts();
      loadSelectedMapLocalization(selectedMap);
    }
  });

  dom["region-filters"].addEventListener("click", (event) => {
    const button = event.target.closest("[data-region]");
    if (!button) return;
    selectedRegion = button.dataset.region;
    renderCallouts();
  });

  const handleCalloutSelection = (event) => {
    const element = event.target.closest("[data-callout-key]");
    if (element && selectedMap) selectCallout(element.dataset.calloutKey);
  };
  dom["callout-list"].addEventListener("click", handleCalloutSelection);
  dom["callout-markers"].addEventListener("click", handleCalloutSelection);

  dom["callout-list"].addEventListener("pointerover", (event) => {
    const element = event.target.closest("[data-callout-key]");
    if (element) dom["callout-markers"].querySelector(`[data-callout-key="${CSS.escape(element.dataset.calloutKey)}"]`)?.classList.add("hovered");
  });
  dom["callout-list"].addEventListener("pointerout", (event) => {
    const element = event.target.closest("[data-callout-key]");
    if (element) dom["callout-markers"].querySelector(`[data-callout-key="${CSS.escape(element.dataset.calloutKey)}"]`)?.classList.remove("hovered");
  });

  dom["menu-toggle"].addEventListener("click", () => {
    const expanded = dom["menu-toggle"].getAttribute("aria-expanded") === "true";
    dom["menu-toggle"].setAttribute("aria-expanded", String(!expanded));
    dom["menu-toggle"].setAttribute("aria-label", expanded ? "Abrir menu" : "Fechar menu");
    dom["main-nav"].classList.toggle("open", !expanded);
  });

  dom["main-nav"].addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      dom["main-nav"].classList.remove("open");
      dom["menu-toggle"].setAttribute("aria-expanded", "false");
      dom["menu-toggle"].setAttribute("aria-label", "Abrir menu");
    }
  });

  document.addEventListener("keydown", (event) => {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    if ((isMac ? event.metaKey : event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      dom["map-search"].focus();
      document.getElementById("mapas").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (event.key === "Escape" && selectedMap) closeMapGuide();
  });

  const navLinks = [...document.querySelectorAll(".nav-link")];
  const sections = ["inicio", "mapas", "sobre"].map((id) => document.getElementById(id));
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`));
      });
    }, { rootMargin: "-35% 0px -55% 0px" });
    sections.forEach((section) => observer.observe(section));
  }
}

document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  setupEvents();
  initMaps();
});
