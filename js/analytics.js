/* =========================================================
   Яндекс Метрика + цели (лиды)

   Счётчик 98652946 — тот же, что на старом сайте tmstal.ru,
   поэтому история посещений не прерывается.

   Цели отправляются как JavaScript-события. Чтобы они появились
   в отчётах, в Метрике нужно один раз создать цели типа
   «JavaScript-событие» с такими идентификаторами:
     order_sent       — отправлена заявка на расчёт
     wholesale_sent   — отправлена оптовая заявка
     callback_sent    — заказан звонок
     add_to_request   — позиция добавлена в заявку
     phone_click      — клик по номеру телефона
     email_click      — клик по адресу почты
   ========================================================= */
(function () {
  const COUNTER_ID = 98652946;
  // статистику собираем только на настоящем сайте tmstal.ru — не на своём компьютере
  // и не на временной ссылке для показа, чтобы не портить данные
  const IS_LOCAL = !/(^|\.)tmstal\.ru$/.test(location.hostname);

  /* ---------- плашка cookie (24.10.2026) ----------
     Метрика ставит cookie и собирает данные о посещении → включаем её только после «Принять».
     «Только необходимые» — Метрика не загружается; заявка в браузере (localStorage) работает всегда.
     Выбор хранится в localStorage 'tm-cookies' = 'all' | 'necessary'. Изменить — ссылка #cookies-settings. */
  const KEY = 'tm-cookies';
  const store = { get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },
                  set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* приватный режим */ } } };
  const scriptEl = document.currentScript;
  const privacyUrl = scriptEl ? new URL('../privacy.html#cookies', scriptEl.src).href : 'privacy.html#cookies';

  function banner() {
    if (document.querySelector('.cookies')) return;
    const el = document.createElement('div');
    el.className = 'cookies';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Использование cookie');
    el.innerHTML = `
      <p class="cookies__text">Мы используем cookie и Яндекс Метрику, чтобы понимать, какие разделы сайта полезны,
        и делать его удобнее. <a href="${privacyUrl}">Подробнее</a></p>
      <div class="cookies__actions">
        <button class="btn btn--primary" type="button" data-cookies="all">Принять</button>
        <button class="btn btn--outline" type="button" data-cookies="necessary">Только необходимые</button>
      </div>`;
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cookies]');
      if (!b) return;
      store.set(b.dataset.cookies);
      el.remove();
      if (b.dataset.cookies === 'all') startMetrika();
    });
    document.body.appendChild(el);
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('a[href$="#cookies-settings"]')) return;
    e.preventDefault();
    banner();
  });

  let started = false;
  function startMetrika() {
    if (IS_LOCAL || started) return;
    started = true;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

    window.ym(COUNTER_ID, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true,
    });
  }

  if (store.get() === 'all') startMetrika();
  else if (!store.get()) {
    if (document.body) banner(); else document.addEventListener('DOMContentLoaded', banner);
  }

  function goal(name, params) {
    if (IS_LOCAL) { console.info('[Метрика, тест] цель:', name, params || ''); return; }
    if (window.ym) window.ym(COUNTER_ID, 'reachGoal', name, params);
  }
  window.tmGoal = goal;

  // события из заявки и форм (js/cart.js)
  document.addEventListener('tm:goal', (e) => goal(e.detail.name, e.detail.params));

  // клики по телефону и почте
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
    if (!a) return;
    goal(a.getAttribute('href').startsWith('tel:') ? 'phone_click' : 'email_click');
  }, true);
})();
