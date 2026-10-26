/* =========================================================
   Подбор размера и марки (пилот — трубы ВГП, 23.10.2026).

   Вместо стены кнопок-размеров в карточке — кнопка «Подобрать размер и марку».
   Окно строится из window.CATALOG (js/catalog-data.js):
   • размеры вида «15х2,8» делятся на два шага: первое число (Ду / диаметр), затем второе (стенка);
     остальные размеры — один список с поиском;
   • размеры «по отдельности» (item.dims, askspecstali.ru): каждый ряд — свой выбор
     (диаметр и стенка); у материалов (dimsOne: «Круг, Ø», «Лист, толщина»…) выбирается одно значение;
   • можно вписать свой размер, если нужного нет в списке;
   • марка — поиск по всем маркам позиции, по умолчанию «не важно».
   Строка уходит в заявку через window.tmCart (js/cart.js).
   Все размеры при этом остаются в карточке обычным текстом — их читает Яндекс.
   ========================================================= */
(function () {
  const byId = {};
  (window.CATALOG || []).forEach((cat) => cat.items.forEach((it) => { byId[it.id] = { ...it, cat }; }));

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (s) => parseFloat(String(s).replace(',', '.'));
  // «15х2,8» → «15» + «2,8»; «40х40х2» → «40х40» + «2» (последнее число — стенка)
  const SPLIT = /^\s*(\d+(?:[.,]\d+)?(?:\s*[хx×]\s*\d+(?:[.,]\d+)?)*)\s*[хx×]\s*(\d+(?:[.,]\d+)?)\s*$/i;
  const sortKey = (s) => s.split(/[хx×]/).map(num);
  const cmp = (a, b) => { const x = sortKey(a), y = sortKey(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d; } return 0; };
  const CLOSE = '<svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  let el = null;      // окно
  let state = null;   // { item, d, size, grade, custom }

  function build() {
    el = document.createElement('div');
    el.className = 'picker';
    el.hidden = true;
    el.innerHTML = `
      <div class="picker__backdrop" data-close></div>
      <div class="picker__panel" role="dialog" aria-modal="true" aria-labelledby="picker-title">
        <header class="picker__head">
          <div><h3 class="picker__title" id="picker-title"></h3><p class="picker__gost"></p></div>
          <button class="picker__close" type="button" data-close aria-label="Закрыть">${CLOSE}</button>
        </header>
        <div class="picker__body">
          <section class="picker__step" data-step="d">
            <h4 class="picker__label"></h4>
            <input class="picker__search" type="search" data-filter="d" placeholder="Начните вводить, например 57" hidden>
            <div class="picker__chips picker__chips--scroll" data-list="d"></div>
          </section>
          <div data-step="dims"></div>
          <section class="picker__step" data-step="size">
            <h4 class="picker__label"></h4>
            <input class="picker__search" type="search" data-filter="size" placeholder="Начните вводить размер" hidden>
            <div class="picker__chips" data-list="size"></div>
          </section>
          <label class="picker__custom">
            <span>Нет нужного размера? Впишите свой — уточним наличие</span>
            <input type="text" data-custom placeholder="Например, 25×3,5">
          </label>
          <section class="picker__step">
            <h4 class="picker__label">Марка стали</h4>
            <input class="picker__search" type="search" data-filter="grade" placeholder="Поиск марки, например 3сп">
            <div class="picker__chips picker__chips--scroll" data-list="grade"></div>
          </section>
          <div class="picker__qty">
            <label><span>Количество</span><input type="number" min="0" step="any" inputmode="decimal" data-qty placeholder="0"></label>
            <label><span>Ед.</span><select data-unit></select></label>
          </div>
        </div>
        <footer class="picker__foot">
          <p class="picker__summary" aria-live="polite"></p>
          <button class="btn btn--primary picker__add" type="button" data-add-row>Добавить в заявку</button>
        </footer>
        <div class="picker__done" hidden>
          <p><b>Добавлено в заявку</b><span class="picker__done-text"></span></p>
          <div class="picker__done-actions">
            <button class="btn btn--outline" type="button" data-again>Добавить ещё размер</button>
            <button class="btn btn--primary" type="button" data-open-cart>Открыть заявку</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);

    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) return close();
      const chip = e.target.closest('[data-v]');
      if (chip) {
        const list = chip.parentElement.dataset.list;
        if (list === 'd') { state.d = chip.dataset.v; state.size = ''; renderSizes(); }
        if (list === 'size') { state.size = chip.dataset.v; state.dims = {}; state.custom = ''; el.querySelector('[data-custom]').value = ''; }
        if (list === 'grade') state.grade = chip.dataset.v;
        if (list.startsWith('dim:')) {
          const label = list.slice(4);
          const again = state.dims[label] === chip.dataset.v;
          if (state.item.dimsOne) state.dims = {};
          if (again) delete state.dims[label]; else state.dims[label] = chip.dataset.v;
          state.size = '';
          state.custom = ''; el.querySelector('[data-custom]').value = '';
        }
        markActive();
        return;
      }
      if (e.target.closest('[data-add-row]')) return addRow();
      if (e.target.closest('[data-again]')) return reset(false);
      if (e.target.closest('[data-open-cart]')) { close(); window.tmCart && window.tmCart.open(); }
    });
    el.querySelector('[data-custom]').addEventListener('input', (e) => {
      state.custom = e.target.value.trim();
      if (state.custom) { state.size = ''; state.dims = {}; }
      markActive();
    });
    el.querySelectorAll('[data-filter]').forEach((inp) => inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase().replace('ё', 'е');
      el.querySelectorAll(`[data-list="${inp.dataset.filter}"] [data-v]`).forEach((b) => {
        const v = b.dataset.v.toLowerCase().replace('ё', 'е');
        if (inp.dataset.filter.startsWith('dim:')) { b.hidden = q && !v.startsWith(q.replace('.', ',')); return; }
        const hit = inp.dataset.filter === 'grade' ? v.includes(q) : v.replace(/[x×]/g, 'х').startsWith(q.replace(/[x×*]/g, 'х').replace('.', ','));
        b.hidden = q && !hit && b.dataset.v !== '';
      });
    }));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el && !el.hidden) close(); });
  }

  const chip = (v, text = v) => `<button type="button" class="picker__chip" data-v="${esc(v)}">${esc(text)}</button>`;

  function open(id) {
    const item = byId[id];
    if (!item) return;
    if (!el) build();
    const sizes = item.sizes || [];
    // два шага (первое число → второе) — только для длинных списков вида «57х3,5»; короткие — одним списком
    const pairs = sizes.length >= 15 && sizes.every((s) => SPLIT.test(s));
    const label = (item.sizeLabel || 'Размер, мм');
    const parts = label.replace(/,\s*мм$/, '').split('×').map((s) => s.trim());
    const [l1, l2] = [parts[0], parts[parts.length - 1]];
    const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
    // если есть большой список настоящих пар (23met: «57х3,5») — подбор по парам, ряды «по отдельности» — только в тексте карточки
    const bigPairs = sizes.length >= 100 && sizes.every((s) => SPLIT.test(s));
    const dims = !bigPairs && item.dims && Object.keys(item.dims).length ? item.dims : null;
    state = { item, pairs: pairs && !dims, dimsOn: !!dims, dims: {}, d: '', size: '', grade: '', custom: '', l1: cap(l1) || 'Размер', l2: cap(l2), label };

    el.querySelector('.picker__title').textContent = item.name;
    const total = sizes.length + (dims ? Object.values(dims).reduce((n, v) => n + v.length, 0) : 0);
    el.querySelector('.picker__gost').textContent = [item.gost, `${total} размеров`].filter(Boolean).join(' · ');
    const stepD = el.querySelector('[data-step="d"]');
    stepD.hidden = !state.pairs;
    el.querySelector('[data-step="size"]').hidden = !sizes.length;   // при рядах (dims) — это «готовые размеры»
    el.querySelector('.picker__custom span').textContent = sizes.length || dims
      ? 'Нет нужного размера? Впишите свой — уточним наличие'
      : 'Размер, количество или описание — впишите, что нужно';
    const stepDims = el.querySelector('[data-step="dims"]');
    stepDims.innerHTML = !dims ? '' : (item.dimsOne ? '<p class="picker__hint">Выберите форму проката и размер — одно значение</p>' : '') +
      Object.entries(dims).map(([label, vals], i) => `
        <section class="picker__step">
          <h4 class="picker__label">${item.dimsOne ? '' : `${i + 1}. `}${esc(label)}${label === 'Номер профиля' || /мм$/.test(label) ? '' : ', мм'}</h4>
          <input class="picker__search" type="search" data-filter="dim:${esc(label)}" placeholder="Начните вводить число"${vals.length < 30 ? ' hidden' : ''}>
          <div class="picker__chips picker__chips--scroll" data-list="dim:${esc(label)}">${vals.map((v) => chip(v)).join('')}</div>
        </section>`).join('');
    stepDims.querySelectorAll('[data-filter]').forEach((inp) => inp.addEventListener('input', () => {
      const q = inp.value.trim().replace('.', ',');
      inp.nextElementSibling.querySelectorAll('[data-v]').forEach((b) => { b.hidden = q && !b.dataset.v.startsWith(q); });
    }));
    if (state.pairs) {
      const ds = [...new Set(sizes.map((s) => s.match(SPLIT)[1]))].sort(cmp);
      stepD.querySelector('.picker__label').textContent = `1. ${state.l1}, мм`;
      stepD.querySelector('[data-list="d"]').innerHTML = ds.map((d) => chip(d, d.replace(/[хx]/g, '×'))).join('');
      const fd = stepD.querySelector('[data-filter="d"]');
      fd.hidden = ds.length < 30; fd.value = '';
    }
    renderSizes();

    const grades = item.grades && item.grades.length ? item.grades : (item.cat.grades || []);
    const gStep = el.querySelector('[data-list="grade"]').closest('.picker__step');
    gStep.hidden = !grades.length;
    state.hasGrades = grades.length > 0;
    gStep.querySelector('.picker__label').textContent = item.cat.gradeLabel ||
      (/^cat-(color|polymers|cable|wires|mesh|fasteners|rope|fittings)$/.test(item.cat.id) ? 'Марка' : 'Марка стали');
    el.querySelector('[data-list="grade"]').innerHTML = chip('', 'Не важно') + grades.map((g) => chip(g)).join('');
    el.querySelector('[data-filter="grade"]').value = '';
    el.querySelector('[data-filter="grade"]').hidden = grades.length < 12;

    const unitSel = el.querySelector('[data-unit]');
    const units = (window.tmCart && window.tmCart.units) || ['т', 'кг', 'м', 'шт'];
    const def = window.tmCart ? window.tmCart.unitOf(id) : 'т';
    unitSel.innerHTML = units.map((u) => `<option${u === def ? ' selected' : ''}>${u}</option>`).join('');

    reset(true);
    el.hidden = false;
    document.body.classList.add('no-scroll');
  }

  function renderSizes() {
    const { item, pairs, d } = state;
    const step = el.querySelector('[data-step="size"]');
    const list = step.querySelector('[data-list="size"]');
    const search = step.querySelector('[data-filter="size"]');
    if (state.dimsOn) {
      step.querySelector('.picker__label').textContent = `Готовые размеры: ${state.label.toLowerCase()}`;
      list.innerHTML = (item.sizes || []).map((s) => chip(s)).join('');
      search.hidden = (item.sizes || []).length < 24; search.value = '';
      markActive(); return;
    }
    let sizes = item.sizes || [];
    if (pairs) {
      step.querySelector('.picker__label').textContent = `2. ${state.l2 || 'Размер'}, мм`;
      if (!d) { list.innerHTML = `<p class="picker__hint">Сначала выберите ${state.l1.toLowerCase()}</p>`; search.hidden = true; return; }
      sizes = sizes.filter((s) => s.match(SPLIT)[1] === d).sort(cmp);
      list.innerHTML = sizes.map((s) => chip(s, s.match(SPLIT)[2])).join('');
      search.hidden = true;
    } else {
      step.querySelector('.picker__label').textContent = state.label;
      list.innerHTML = sizes.map((s) => chip(s)).join('');
      search.hidden = sizes.length < 24;
      search.value = '';
    }
    markActive();
  }

  function markActive() {
    el.querySelectorAll('[data-list="d"] [data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === state.d));
    el.querySelectorAll('[data-list="size"] [data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === state.size));
    el.querySelectorAll('[data-list="grade"] [data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === state.grade));
    el.querySelectorAll('[data-list^="dim:"]').forEach((list) => {
      const label = list.dataset.list.slice(4);
      list.querySelectorAll('[data-v]').forEach((b) => b.setAttribute('aria-pressed', state.dims[label] === b.dataset.v));
    });
    const size = state.custom || (state.size ? state.size.replace(/х/g, '×') : '') || (state.dimsOn ? dimsNote() : '');
    const parts = [size ? (state.pairs && !state.custom ? `${state.l1.split(' ')[0]} ${size}` : size) : 'размер не выбран',
                   state.grade || (state.hasGrades ? 'марка не важна' : '')].filter(Boolean);
    el.querySelector('.picker__summary').textContent = parts.join(' · ');
  }

  // «Диаметр 57 · Стенка 3,5»; у материалов — «Круг Ø 20»
  function dimsNote() {
    return Object.entries(state.dims).map(([label, v]) => `${label.replace(/,\s*/, ' ')} ${v}`).join(', ');
  }

  function reset(full) {
    if (full) { state.d = ''; state.size = ''; state.grade = ''; }
    else { state.size = ''; }
    state.dims = {};
    state.custom = '';
    el.querySelector('[data-custom]').value = '';
    el.querySelector('[data-qty]').value = '';
    el.querySelector('.picker__done').hidden = true;
    el.querySelector('.picker__foot').hidden = false;
    el.querySelector('.picker__body').hidden = false;
    renderSizes();
  }

  function addRow() {
    const size = state.custom || state.size;
    const note = state.custom || (state.dimsOn && !state.size ? dimsNote() : '') ||
      (size ? (state.pairs && state.size ? `${state.l1.split(' ')[0]} ${size.replace(/х/g, '×')}` : size) : '');
    const ok = window.tmCart && window.tmCart.addRow({
      id: state.item.id, grade: state.grade, note,
      qty: el.querySelector('[data-qty]').value, unit: el.querySelector('[data-unit]').value,
    });
    if (!ok) return;
    if (window.cartUpdateBadges) window.cartUpdateBadges();
    el.querySelector('.picker__done-text').textContent = [state.item.name, note, state.grade].filter(Boolean).join(' · ');
    el.querySelector('.picker__body').hidden = true;
    el.querySelector('.picker__foot').hidden = true;
    el.querySelector('.picker__done').hidden = false;
  }

  function close() {
    el.hidden = true;
    document.body.classList.remove('no-scroll');
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    e.preventDefault();
    open(b.dataset.pick);
  });
})();
