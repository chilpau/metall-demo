/* =========================================================
   Блок «Отзывы»: рендер скриншотов из js/reviews-data.js
   и просмотр в полном размере.
   ========================================================= */
(function () {
  const section = document.getElementById('reviews');
  const reviews = window.REVIEWS || [];
  const links = window.REVIEW_LINKS || [];
  const IS_LOCAL = ['localhost', '127.0.0.1', ''].includes(location.hostname);
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const EXTERNAL = '<svg class="icon" viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>';

  // Нет отзывов: на рабочем сайте прячем блок и пункт меню (на всех страницах),
  // на локальном — показываем заготовки, чтобы видеть дизайн.
  if (!reviews.length && !IS_LOCAL) {
    if (section) section.hidden = true;
    document.querySelectorAll('a[href$="#reviews"]').forEach((a) => {
      (a.closest('li') || a).hidden = true;
    });
    return;
  }
  if (!section) return;

  const grid = section.querySelector('.reviews__grid');
  const actions = section.querySelector('.reviews__links');

  if (!reviews.length) {
    section.classList.add('is-preview');
    grid.innerHTML = Array.from({ length: 3 }, () => `
      <li class="review review--placeholder">
        <div class="review__shot"><span>Здесь будет скриншот отзыва</span></div>
        <div class="review__meta"><span class="review__source">Яндекс Карты / 2ГИС</span></div>
      </li>`).join('');
    return;
  }

  grid.innerHTML = reviews.map((r, i) => `
    <li class="review">
      <button class="review__shot" type="button" data-zoom="${i}" aria-label="Открыть отзыв${r.author ? ` — ${esc(r.author)}` : ''} целиком">
        <img src="${esc(r.image)}" alt="Отзыв${r.author ? ` — ${esc(r.author)}` : ''}${r.source ? `, ${esc(r.source)}` : ''}" loading="lazy">
      </button>
      <div class="review__meta">
        <span>
          ${r.source ? `<span class="review__source">${esc(r.source)}</span>` : ''}
          ${r.author || r.date ? `<small>${esc([r.author, r.date].filter(Boolean).join(' · '))}</small>` : ''}
        </span>
        ${r.url ? `<a class="review__link" href="${esc(r.url)}" target="_blank" rel="noopener">Оригинал ${EXTERNAL}</a>` : ''}
      </div>
    </li>`).join('');

  actions.innerHTML = links.map((l) =>
    `<a class="btn btn--outline" href="${esc(l.url)}" target="_blank" rel="noopener">Все отзывы: ${esc(l.source)} ${EXTERNAL}</a>`).join('');

  /* ---------- просмотр скриншота целиком ---------- */
  const dialog = document.createElement('dialog');
  dialog.className = 'lightbox';
  dialog.innerHTML = `
    <button class="icon-btn lightbox__close" type="button" aria-label="Закрыть">
      <svg class="icon" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
    <img alt="">`;
  document.body.appendChild(dialog);
  const big = dialog.querySelector('img');

  grid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-zoom]');
    if (!btn) return;
    const img = btn.querySelector('img');
    big.src = img.src;
    big.alt = img.alt;
    dialog.showModal();
  });
  dialog.addEventListener('click', (e) => {
    // клик по фону или крестику закрывает
    if (e.target === dialog || e.target.closest('.lightbox__close')) dialog.close();
  });
})();
