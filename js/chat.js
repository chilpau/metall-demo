/* =========================================================
   AI-консультант (n8n) — плавающий чат в правом нижнем углу.

   Сам агент (что он знает и как отвечает) настраивается в n8n.
   Здесь — только подключение виджета и внешний вид.
   Виджет: @n8n/chat, версия закреплена, чтобы обновления не ломали сайт.
   ========================================================= */
import { createChat } from 'https://cdn.jsdelivr.net/npm/@n8n/chat@1.38.6/dist/chat.bundle.es.js';

const WEBHOOK_URL = 'https://chikpau.app.n8n.cloud/webhook/0b9b9486-2277-4f8b-aa13-710b5ae5c497/chat';

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
