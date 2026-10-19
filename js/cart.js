/* =========================================================
   Заявка на расчёт (корзина), «Заказать звонок», «Задать вопрос»

   Ссылки, которые открывают окна (работают на любой странице):
     href="#calc"     → заявка на расчёт
     href="#callback" → заказать звонок
     href="#ask"      → задать вопрос (телефон или почта)
   Кнопка добавления позиции: <button data-add="id-позиции">

   Отправка — POST JSON на send.php (письмо на zakaz@tmstal.ru).
   ========================================================= */
(function () {
  const STORAGE_KEY = 'tm-cart';
  // Корень сайта — от адреса этого скрипта (/js/cart.js). Так ссылки и отправка заявки
  // работают с любой страницы: с главной, из каталога и со страниц /catalog/<раздел>/.
  const ROOT = new URL('../', document.currentScript.src).href;
  const SEND_URL = ROOT + 'send.php';
  const PHONE = '8 800 600-13-96';
  const PHONE_HREF = 'tel:88006001396';
  const EMAIL = 'zakaz@tmstal.ru';
  const UNITS = ['т', 'кг', 'м', 'м²', 'шт'];
  const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  // временная ссылка для показа (Netlify и т. п.): PHP там нет, письма не уходят — говорим об этом прямо
  const IS_PREVIEW = !IS_LOCAL && !/(^|\.)tmstal\.ru$/.test(location.hostname);

  const ICON = {
    close: '<svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    cart: '<svg class="icon" viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg>',
    trash: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    phone: '<svg class="icon" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    mail: '<svg class="icon" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    check: '<svg class="icon" viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>',
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- данные корзины ---------- */
  // Единица по умолчанию: металл — тонны, кабель и трос — метры и т.д. Клиент может поменять.
  const DEFAULT_UNIT = {
    'cat-cable': 'м', 'cat-wires': 'м', 'cat-rope': 'м', 'cat-mesh': 'м²',
    'cat-polymers': 'кг', 'cat-fasteners': 'кг', 'cat-fittings': 'шт',
  };
  const byId = {};
  (window.CATALOG || []).forEach((cat) => cat.items.forEach((item) => {
    // марки позиции, а если их нет — общие марки раздела (лист, нержавейка)
    byId[item.id] = {
      name: item.name, cat: cat.title, grades: item.grades || cat.grades || [],
      gradeLabel: cat.gradeLabel || 'Марка', sizes: item.sizes || [], sizeLabel: item.sizeLabel || 'Размер',
      unit: DEFAULT_UNIT[cat.id] || 'т',
    };
  }));

  // строка заявки: { uid, id, grade, qty, unit, note } — одна позиция может быть в нескольких марках
  const uid = () => Math.random().toString(36).slice(2, 10);
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { cart = []; }
  cart = cart.filter((row) => byId[row.id]).map((row) => ({ grade: '', note: '', ...row, uid: row.uid || uid() }));

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (e) { /* приватный режим — живём без сохранения */ }
    updateBadges();
  }
  const inCart = (id) => cart.some((row) => row.id === id);
  const findRow = (id, grade) => cart.find((row) => row.id === id && row.grade === grade);

  // цель для Яндекс Метрики (js/analytics.js)
  const goal = (name, params) => document.dispatchEvent(new CustomEvent('tm:goal', { detail: { name, params } }));

  function add(id, grade = '') {
    if (!byId[id] || findRow(id, grade)) return;
    goal('add_to_request', { item: byId[id].name, grade });
    cart.push({ uid: uid(), id, grade, qty: '', unit: (window.PRICES[id] && window.PRICES[id].unit) || byId[id].unit, note: '' });
    save();
  }
  // клик по марке в каталоге: добавить строку с этой маркой или убрать её
  function toggleGrade(id, grade) {
    const withGrade = findRow(id, grade);
    if (withGrade) {
      // марку убираем; если в строке остался размер — строка остаётся
      if (withGrade.note) { withGrade.grade = ''; save(); renderItems(); }
      else removeRow(withGrade.uid);
      return;
    }
    // есть строка этой позиции без марки (например, выбран только размер) — ставим марку в неё
    const empty = [...cart].reverse().find((row) => row.id === id && !row.grade);
    if (empty) { empty.grade = grade; save(); renderItems(); bump(); }
    else { add(id, grade); bump(); }
  }
  // клик по размеру в каталоге: подставить размер в строку этой позиции без размера,
  // иначе — новая строка; повторный клик убирает размер
  function toggleSize(id, size) {
    const withSize = cart.find((row) => row.id === id && row.note === size);
    if (withSize) {
      if (withSize.grade) { withSize.note = ''; save(); renderItems(); }
      else removeRow(withSize.uid);
      return;
    }
    const empty = [...cart].reverse().find((row) => row.id === id && !row.note);
    if (empty) empty.note = size;
    else {
      if (!byId[id]) return;
      cart.push({ uid: uid(), id, grade: '', qty: '', unit: (window.PRICES[id] && window.PRICES[id].unit) || byId[id].unit, note: size });
      goal('add_to_request', { item: byId[id].name, size });
    }
    save(); renderItems(); bump();
  }
  function removeRow(rowUid) {
    cart = cart.filter((row) => row.uid !== rowUid);
    save();
    renderItems();
  }

  /* ---------- разметка окон ---------- */
  const consent = (id) => `
    <label class="consent">
      <input type="checkbox" name="consent" required id="${id}">
      <span>Согласен на обработку персональных данных в соответствии с <a href="${ROOT}privacy.html" target="_blank">политикой</a></span>
    </label>`;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="overlay" id="overlay" hidden></div>

    <aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" hidden>
      <header class="drawer__head">
        <h2 id="drawer-title">Заявка на расчёт</h2>
        <button class="icon-btn" type="button" data-close aria-label="Закрыть">${ICON.close}</button>
      </header>
      <div class="drawer__body">
        <p class="drawer__lead">Укажите количество и размер — менеджер рассчитает стоимость и свяжется с вами. Марку можно выбрать в каталоге или прямо здесь.</p>
        <ul class="cart-list" id="cart-list"></ul>
        <div class="cart-empty" id="cart-empty">
          <b>Позиций пока нет</b>
          <p>Добавьте товары из каталога кнопкой «В заявку» или просто опишите, что нужно, в комментарии ниже.</p>
          <a class="btn btn--outline" href="${ROOT}catalog.html">Перейти в каталог</a>
        </div>

        <form class="form" id="order-form" novalidate>
          <h3 class="form__title">Контакты для расчёта</h3>
          <div class="form__row">
            <label class="field"><span>Имя</span><input name="name" autocomplete="name"></label>
            <label class="field"><span>Телефон *</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" required></label>
          </div>
          <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email"></label>
          <label class="field"><span>Комментарий</span><textarea name="comment" rows="3" placeholder="Размеры, марка стали, нужна ли резка или доставка"></textarea></label>
          <label class="consent consent--wholesale">
            <input type="checkbox" name="wholesale" id="wholesale-flag">
            <span><b>Оптовая закупка</b> — расчёт по оптовым ценам</span>
          </label>
          <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          ${consent('consent-order')}
          <p class="form__error" role="alert" hidden></p>
          <button class="btn btn--primary btn--block" type="submit">Отправить на расчёт</button>
        </form>
      </div>
      <div class="done" hidden>
        <span class="done__icon">${ICON.check}</span>
        <b>Заявка отправлена</b>
        <p>Менеджер рассчитает стоимость и свяжется с вами.</p>
        <button class="btn btn--outline" type="button" data-close>Закрыть</button>
      </div>
    </aside>

    <div class="modal" id="callback-modal" role="dialog" aria-modal="true" aria-labelledby="callback-title" hidden>
      <button class="icon-btn modal__close" type="button" data-close aria-label="Закрыть">${ICON.close}</button>
      <form class="form" id="callback-form" novalidate>
        <h2 class="modal__title" id="callback-title">Заказать звонок</h2>
        <p class="modal__lead">Оставьте номер — менеджер перезвонит.</p>
        <label class="field"><span>Имя</span><input name="name" autocomplete="name"></label>
        <label class="field"><span>Телефон *</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" required></label>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        ${consent('consent-callback')}
        <p class="form__error" role="alert" hidden></p>
        <button class="btn btn--primary btn--block" type="submit">Жду звонка</button>
      </form>
      <div class="done" hidden>
        <span class="done__icon">${ICON.check}</span>
        <b>Спасибо!</b>
        <p>Мы получили ваш номер и перезвоним.</p>
        <button class="btn btn--outline" type="button" data-close>Закрыть</button>
      </div>
    </div>

    <div class="modal" id="ask-modal" role="dialog" aria-modal="true" aria-labelledby="ask-title" hidden>
      <button class="icon-btn modal__close" type="button" data-close aria-label="Закрыть">${ICON.close}</button>
      <h2 class="modal__title" id="ask-title">Задать вопрос</h2>
      <p class="modal__lead">Выберите удобный способ связи.</p>
      <div class="ask">
        <a class="ask__option" href="${PHONE_HREF}">
          <span class="ask__icon">${ICON.phone}</span>
          <span><b>Позвонить</b><small>${PHONE} · бесплатно по России</small></span>
        </a>
        <a class="ask__option" href="mailto:${EMAIL}?subject=${encodeURIComponent('Вопрос с сайта')}">
          <span class="ask__icon">${ICON.mail}</span>
          <span><b>Написать на почту</b><small>${EMAIL}</small></span>
        </a>
      </div>
    </div>
  `);

  const overlay = document.getElementById('overlay');
  const MODALS = {
    calc: document.getElementById('drawer'),
    'wholesale-order': document.getElementById('drawer'),
    callback: document.getElementById('callback-modal'),
    ask: document.getElementById('ask-modal'),
  };
  const drawer = document.getElementById('drawer');
  const list = document.getElementById('cart-list');
  const empty = document.getElementById('cart-empty');
  let openEl = null;
  let lastFocus = null;

  /* ---------- кнопка заявки в шапке ---------- */
  const navInner = document.querySelector('.navbar__inner');
  if (navInner) {
    const btn = document.createElement('a');
    btn.href = '#calc';
    btn.className = 'cart-btn';
    btn.setAttribute('aria-label', 'Заявка на расчёт');
    btn.innerHTML = `${ICON.cart}<span class="cart-btn__count" hidden>0</span>`;
    navInner.insertBefore(btn, document.getElementById('burger'));
  }

  // на компьютере счётчик заявки — на кнопке «Рассчитать стоимость» (она открывает ту же заявку)
  document.querySelectorAll('.nav__item--accent > .nav__link').forEach((link) => {
    link.insertAdjacentHTML('beforeend', '<span class="cart-btn__count" hidden>0</span>');
  });

  function updateBadges() {
    document.querySelectorAll('.cart-btn__count').forEach((el) => {
      el.textContent = cart.length;
      el.hidden = cart.length === 0;
    });
    document.querySelectorAll('[data-add]').forEach((btn) => {
      const added = inCart(btn.dataset.add);
      btn.classList.toggle('is-added', added);
      btn.innerHTML = added ? `${ICON.check} В заявке` : 'В заявку';
    });
    document.querySelectorAll('[data-grade]').forEach((btn) => {
      btn.setAttribute('aria-pressed', cart.some((row) => row.id === btn.dataset.item && row.grade === btn.dataset.grade));
    });
    document.querySelectorAll('[data-size]').forEach((btn) => {
      btn.setAttribute('aria-pressed', cart.some((row) => row.id === btn.dataset.item && row.note === btn.dataset.size));
    });
  }

  /* ---------- позиции в заявке ---------- */
  function renderItems() {
    list.innerHTML = cart.map((row) => {
      const item = byId[row.id];
      const price = window.formatPrice(window.PRICES[row.id]);
      return `
        <li class="cart-item" data-uid="${row.uid}">
          <div class="cart-item__top">
            <div>
              <b>${esc(item.name)}${row.grade ? ` <span class="cart-item__grade">${esc(row.grade)}</span>` : ''}</b>
              <small>${esc(item.cat)}${price ? ` · ${price}` : ''}</small>
            </div>
            <button class="icon-btn" type="button" data-remove="${row.uid}" aria-label="Убрать ${esc(item.name)}">${ICON.trash}</button>
          </div>
          <div class="cart-item__fields">
            <input class="cart-item__qty" type="number" min="0" step="any" inputmode="decimal" placeholder="Кол-во"
                   value="${esc(row.qty)}" data-field="qty" aria-label="Количество">
            <select data-field="unit" aria-label="Единица">
              ${UNITS.map((u) => `<option${u === row.unit ? ' selected' : ''}>${u}</option>`).join('')}
            </select>
            ${item.grades.length ? `
            <select data-field="grade" aria-label="Марка стали">
              <option value="">${esc(item.gradeLabel)}: не важно</option>
              ${item.grades.map((g) => `<option${g === row.grade ? ' selected' : ''}>${esc(g)}</option>`).join('')}
            </select>` : '<span></span>'}
            <input class="cart-item__note" value="${esc(row.note)}" data-field="note"
                   placeholder="${item.sizes.length ? `${esc(item.sizeLabel)}: выберите или впишите` : 'Размер, например 40×20×2 мм, 6 м'}"
                   ${item.sizes.length ? `list="sizes-${row.uid}"` : ''} aria-label="${esc(item.sizeLabel)}" autocomplete="off">
            ${item.sizes.length ? `<datalist id="sizes-${row.uid}">${item.sizes.map((z) => `<option value="${esc(z)}">`).join('')}</datalist>` : ''}
          </div>
        </li>`;
    }).join('');
    empty.hidden = cart.length > 0;
  }

  list.addEventListener('input', (e) => {
    const field = e.target.dataset.field;
    if (!field) return;
    const row = cart.find((r) => r.uid === e.target.closest('[data-uid]').dataset.uid);
    row[field] = e.target.value;
    save();
    if (field === 'grade') renderItems(); // обновить подпись марки в заголовке строки
  });
  list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn) removeRow(btn.dataset.remove);
  });

  /* ---------- открыть / закрыть ---------- */
  function open(el) {
    if (openEl) close();
    lastFocus = document.activeElement;
    openEl = el;
    el.hidden = false;
    overlay.hidden = false;
    // показываем форму, если окно открывают повторно после отправки
    const done = el.querySelector('.done');
    if (done && !done.hidden) {
      done.hidden = true;
      el.querySelectorAll('.drawer__body, form').forEach((n) => { n.hidden = false; });
    }
    if (el === drawer) renderItems();
    requestAnimationFrame(() => {
      el.classList.add('is-open');
      overlay.classList.add('is-open');
      const first = el.querySelector(el === drawer && !cart.length ? 'textarea' : 'input:not(.hp), a.ask__option');
      if (first) first.focus({ preventScroll: true });
    });
    document.body.classList.add('no-scroll');
  }

  function close() {
    if (!openEl) return;
    const el = openEl;
    openEl = null;
    el.classList.remove('is-open');
    overlay.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => { el.hidden = true; overlay.hidden = true; }, 250);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) { close(); return; }

    const sizeBtn = e.target.closest('[data-size]');
    if (sizeBtn) { toggleSize(sizeBtn.dataset.item, sizeBtn.dataset.size); return; }

    const gradeBtn = e.target.closest('[data-grade]');
    if (gradeBtn) { toggleGrade(gradeBtn.dataset.item, gradeBtn.dataset.grade); return; }

    const addBtn = e.target.closest('[data-add]');
    if (addBtn) {
      if (inCart(addBtn.dataset.add)) open(drawer);
      else { add(addBtn.dataset.add); bump(); }
      return;
    }

    const link = e.target.closest('a[href]');
    if (!link) return;
    const hash = link.getAttribute('href').split('#')[1];
    const target = MODALS[hash];
    if (target) {
      e.preventDefault();
      if (hash === 'wholesale-order') document.getElementById('wholesale-flag').checked = true;
      // закрываем мобильное меню, если окно открыли из него
      document.querySelector('.nav.is-open') && document.getElementById('burger').click();
      open(target);
    }
  });

  // лёгкая анимация счётчика при добавлении
  function bump() {
    document.querySelectorAll('.cart-btn').forEach((b) => {
      b.classList.remove('is-bump');
      void b.offsetWidth;
      b.classList.add('is-bump');
    });
  }

  /* ---------- маска телефона ---------- */
  function formatPhone(value) {
    let d = value.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (d && !d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    let out = d ? '+7' : '';
    if (p[0]) out += ` (${p[0]}`;
    if (p[0].length === 3) out += ')';
    if (p[1]) out += ` ${p[1]}`;
    if (p[2]) out += `-${p[2]}`;
    if (p[3]) out += `-${p[3]}`;
    return out;
  }
  document.querySelectorAll('input[type="tel"]').forEach((input) => {
    input.addEventListener('input', () => { input.value = formatPhone(input.value); });
  });

  /* ---------- отправка ---------- */
  const openedAt = Date.now();

  async function submit(form, type) {
    const error = form.querySelector('.form__error');
    const data = Object.fromEntries(new FormData(form));
    const digits = (data.phone || '').replace(/\D/g, '');

    const fail = (msg, field) => {
      error.textContent = msg;
      error.hidden = false;
      if (field) form.elements[field].focus();
    };
    error.hidden = true;
    if (digits.length !== 11) return fail('Укажите номер телефона полностью.', 'phone');
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return fail('Проверьте адрес почты.', 'email');
    if (!form.elements.consent.checked) return fail('Нужно согласие на обработку персональных данных.', 'consent');
    if (type === 'order' && !cart.length && !(data.comment || '').trim()) {
      return fail('Добавьте позиции из каталога или опишите, что нужно, в комментарии.', 'comment');
    }

    const payload = {
      type,
      name: data.name || '',
      phone: data.phone,
      email: data.email || '',
      comment: data.comment || '',
      wholesale: type === 'order' && !!form.elements.wholesale && form.elements.wholesale.checked,
      website: data.website || '',      // ловушка для ботов
      elapsed: Date.now() - openedAt,   // боты отправляют мгновенно
      page: location.href,
      items: type === 'order' ? cart.map((row) => ({ name: byId[row.id].name, cat: byId[row.id].cat, grade: row.grade, qty: row.qty, unit: row.unit, note: row.note })) : [],
    };

    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const res = await fetch(SEND_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error || res.status);
      success(form, type);
    } catch (err) {
      if (IS_LOCAL) {
        // На локальном сервере нет PHP — показываем, что ушло бы в письме
        console.info('[тестовый режим] письмо не отправлено, данные заявки:', payload);
        success(form, type);
      } else if (IS_PREVIEW) {
        fail(`Это предварительная версия сайта — отсюда заявки пока не отправляются. Позвоните ${PHONE} или напишите на ${EMAIL}.`);
      } else {
        fail(`Не удалось отправить. Позвоните ${PHONE} или напишите на ${EMAIL}.`);
      }
    } finally {
      button.disabled = false;
    }
  }

  function success(form, type) {
    goal(type === 'callback' ? 'callback_sent'
      : (form.elements.wholesale && form.elements.wholesale.checked ? 'wholesale_sent' : 'order_sent'));
    const box = form.closest('.drawer, .modal');
    (type === 'order' ? box.querySelector('.drawer__body') : form).hidden = true;
    box.querySelector('.done').hidden = false;
    form.reset();
    if (type === 'order') { cart = []; save(); renderItems(); }
  }

  document.getElementById('order-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'order'); });
  document.getElementById('callback-form').addEventListener('submit', (e) => { e.preventDefault(); submit(e.target, 'callback'); });

  window.addEventListener('storage', (e) => {
    // заявка изменилась в другой вкладке
    if (e.key !== STORAGE_KEY) return;
    try { cart = JSON.parse(e.newValue) || []; } catch (err) { cart = []; }
    updateBadges();
    if (openEl === drawer) renderItems();
  });

  window.cartUpdateBadges = updateBadges;
  updateBadges();

  // ссылка вида site.ru/#calc сразу открывает нужное окно
  const fromHash = MODALS[location.hash.slice(1)];
  if (location.hash === '#wholesale-order') document.getElementById('wholesale-flag').checked = true;
  if (fromHash) open(fromHash);
})();
