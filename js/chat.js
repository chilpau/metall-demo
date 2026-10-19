/* =========================================================
   AI-консультант (n8n) — плавающий чат в правом нижнем углу.

   Сам агент (что он знает и как отвечает) настраивается в n8n.
   Здесь — только подключение виджета и внешний вид.
   Виджет: @n8n/chat, версия закреплена, чтобы обновления не ломали сайт.

   Виджет тяжёлый (~1,7 МБ), поэтому грузится не сразу, а при первом
   действии посетителя или через 6 секунд — страница открывается быстрее,
   это важно для скорости и продвижения в Яндексе.

   Подключается обычным скриптом (не type="module"): модули браузер блокирует,
   если сайт открыт файлом с диска, а так чат работает везде.
   ========================================================= */
(function () {
  const WIDGET_JS = 'https://cdn.jsdelivr.net/npm/@n8n/chat@1.38.6/dist/chat.bundle.es.js';
  const WIDGET_CSS = 'https://cdn.jsdelivr.net/npm/@n8n/chat@1.38.6/dist/style.css';

  const WEBHOOK_URL = 'https://chikpau.app.n8n.cloud/webhook/0b9b9486-2277-4f8b-aa13-710b5ae5c497/chat';

  let started = false;
  async function startChat() {
    if (started) return;
    started = true;
    EVENTS.forEach((ev) => window.removeEventListener(ev, startChat));

    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = WIDGET_CSS;
    document.head.prepend(css); // раньше style.css сайта — наши цвета чата остаются главными

    const { createChat } = await import(WIDGET_JS);
    const target = document.createElement('div');
    target.id = 'n8n-chat';
    document.body.appendChild(target);

    createChat({
      webhookUrl: WEBHOOK_URL,
      target: '#n8n-chat',
      mode: 'window',
      loadPreviousSession: true,      // переписка сохраняется при переходе между страницами
      showWelcomeScreen: false,
      defaultLanguage: 'en',          // виджет поддерживает только «en» — тексты ниже переведены
      metadata: { page: location.pathname },
      initialMessages: [
        'Здравствуйте! 👋',
        'Я помощник «ТМ Сталь». Подскажу по каталогу, маркам стали, резке и доставке.',
      ],
      i18n: {
        en: {
          title: 'Консультант ТМ Сталь',
          subtitle: 'Спросите про металл, марки или доставку',
          footer: '',
          getStarted: 'Новый диалог',
          inputPlaceholder: 'Напишите вопрос…',
          closeButtonTooltip: 'Закрыть',
        },
      },
    });
  }

  const EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
  EVENTS.forEach((ev) => window.addEventListener(ev, startChat, { once: true, passive: true }));
  setTimeout(startChat, 6000);
})();
