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
     chat_open        — открыт онлайн-консультант
   ========================================================= */
(function () {
  const COUNTER_ID = 98652946;
  // статистику собираем только на настоящем сайте tmstal.ru — не на своём компьютере
  // и не на временной ссылке для показа, чтобы не портить данные
  const IS_LOCAL = !/(^|\.)tmstal\.ru$/.test(location.hostname);

  if (!IS_LOCAL) {
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

  function goal(name, params) {
    if (IS_LOCAL) { console.info('[Метрика, тест] цель:', name, params || ''); return; }
    if (window.ym) window.ym(COUNTER_ID, 'reachGoal', name, params);
  }
  window.tmGoal = goal;

  // события из заявки и форм (js/cart.js)
  document.addEventListener('tm:goal', (e) => goal(e.detail.name, e.detail.params));

  // клики по телефону, почте и кнопке чата
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="tel:"], a[href^="mailto:"], .chat-window-toggle');
    if (!a) return;
    if (a.classList.contains('chat-window-toggle')) goal('chat_open');
    else goal(a.getAttribute('href').startsWith('tel:') ? 'phone_click' : 'email_click');
  }, true);
})();
