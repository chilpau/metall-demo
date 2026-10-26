/* =========================================================
   Цены из Google Таблицы

   Как подключить (один раз):
   1. Загрузите prices-template.csv в Google Таблицы
      (Файл → Импорт) — там уже есть все позиции каталога.
   2. Файл → Поделиться → Опубликовать в интернете →
      выберите лист и формат «CSV» → Опубликовать.
   3. Скопируйте ссылку и вставьте в PRICES_URL ниже.

   Дальше менеджер просто меняет цены в таблице — сайт
   подхватывает их сам (Google обновляет опубликованный CSV
   с задержкой около 5 минут).

   Колонки: id; название; раздел; цена; единица; наличие
   Пустая цена → на сайте «Цена по запросу».
   ========================================================= */
const PRICES_URL = ''; // ← ссылка на опубликованный CSV

window.PRICES = {};

window.pricesReady = (async () => {
  if (!PRICES_URL) return window.PRICES;
  try {
    const res = await fetch(PRICES_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const rows = parseCSV(await res.text());
    const head = rows.shift().map((h) => h.replace(/^\ufeff/, '').trim().toLowerCase());
    const col = (name) => head.indexOf(name);
    const [iId, iPrice, iUnit, iStock] = [col('id'), col('цена'), col('единица'), col('наличие')];

    rows.forEach((r) => {
      const id = (r[iId] || '').trim();
      const price = Number(String(r[iPrice] || '').replace(/[^\d.,]/g, '').replace(',', '.'));
      if (!id) return;
      window.PRICES[id] = {
        price: price > 0 ? price : null,
        unit: (r[iUnit] || '').trim() || 'т',
        stock: (r[iStock] || '').trim(),
      };
    });
  } catch (err) {
    // таблица недоступна — просто показываем «Цена по запросу»
    console.warn('Цены не загрузились:', err);
  }
  return window.PRICES;
})();

window.formatPrice = (p) => {
  if (!p || !p.price) return null;
  return `от ${p.price.toLocaleString('ru-RU')} ₽/${p.unit}`;
};

// Простой CSV-парсер: запятая или точка с запятой, кавычки, переносы в ячейках
function parseCSV(text) {
  const sep = text.split('\n')[0].includes(';') ? ';' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}
