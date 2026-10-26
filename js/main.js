/* =========================================================
   Сайт открыт файлом с диска (двойной клик по index.html):
   браузер не открывает index.html в папке сам — дописываем его
   к ссылкам на папки (catalog/armatura/ → catalog/armatura/index.html).
   На хостинге этот код ничего не делает.
   ========================================================= */
if (location.protocol === 'file:') {
  document.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (/^(https?:|mailto:|tel:|#)/.test(href)) return;
    const [path, hash = ''] = href.split('#');
    if (path === '' ) return;
    if (path.endsWith('/')) a.setAttribute('href', `${path}index.html${hash ? '#' + hash : ''}`);
  });
}


/* =========================================================
   Мобильное меню
   ========================================================= */
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');
const navbar = document.querySelector('.navbar');

function setMenu(open) {
  if (open) {
    // меню открывается ровно под шапкой, где бы она сейчас ни была
    const top = navbar.getBoundingClientRect().bottom;
    nav.style.top = `${top}px`;
    nav.style.height = `${window.innerHeight - top}px`;
  }
  nav.classList.toggle('is-open', open);
  burger.classList.toggle('is-open', open);
  burger.setAttribute('aria-expanded', open);
  document.body.classList.toggle('no-scroll', open);
}

burger.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));

// На мобильном выпадающие пункты раскрываются по тапу
nav.querySelectorAll('.nav__item--drop > .nav__link').forEach((link) => {
  link.addEventListener('click', (e) => {
    if (window.matchMedia('(max-width: 1024px)').matches) {
      e.preventDefault();
      link.parentElement.classList.toggle('is-open');
    }
  });
});

// Закрываем меню после перехода по якорю
nav.querySelectorAll('.dropdown a, .nav__item:not(.nav__item--drop) > .nav__link, .nav__mobile-contacts a')
  .forEach((a) => a.addEventListener('click', () => setMenu(false)));

window.addEventListener('resize', () => {
  if (window.innerWidth > 1024 && nav.classList.contains('is-open')) setMenu(false);
});


/* =========================================================
   Счётчик «Весь каталог: N разделов, M позиций» — из данных каталога
   ========================================================= */
(function catalogCount() {
  const el = document.querySelector('[data-catalog-count]');
  if (!el || !window.CATALOG) return;
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    return m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
  };
  const sections = window.CATALOG.length;
  const items = window.CATALOG.reduce((n, c) => n + c.items.length, 0);
  el.textContent = `Весь каталог: ${sections} ${plural(sections, 'раздел', 'раздела', 'разделов')}, ${items} ${plural(items, 'позиция', 'позиции', 'позиций')}`;
})();


/* =========================================================
   Поиск на телефоне: при нажатии на поле поднимаем его наверх экрана —
   иначе выезжающая клавиатура закрывает результаты (жалоба заказчика с Android, 21.10.2026)
   ========================================================= */
const isPhone = () => window.matchMedia('(max-width: 768px)').matches;
window.liftOnFocus = (field, anchor = field) => {
  field.addEventListener('focus', () => {
    if (!isPhone()) return;
    document.body.classList.add('is-searching');
    setTimeout(() => {
      const nav = document.querySelector('.navbar');
      const offset = (nav ? Math.max(nav.getBoundingClientRect().bottom, 0) : 0) + 12;
      window.scrollTo({ top: anchor.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
    }, 300); // ждём, пока выедет клавиатура
  });
  field.addEventListener('blur', () => setTimeout(() => document.body.classList.remove('is-searching'), 200));
};


/* =========================================================
   Поиск по каталогу (только на главной)
   Данные — js/catalog-data.js. Ищем по названиям, разделам и маркам.
   ========================================================= */
const norm = window.normalizeQuery;

const INDEX = (window.CATALOG || []).flatMap((cat) => cat.items.map((item) => ({
  t: item.name,
  c: cat.title,
  h: `catalog.html#${item.id}`,
  nt: norm(item.name),
  nk: norm(`${cat.title} ${item.gost || ''} ${item.note || ''} ${(item.grades || []).join(' ')} ${(cat.grades || []).join(' ')} ${(item.sizes || []).join(' ')}`),
})));
// Услуги (резка, гибка, металлоизделия) теперь в каталоге — в индекс попадают вместе с товарами.
// Дополнительные слова, по которым их ищут:
const SERVICE_WORDS = { 'svc-cut': 'резка в размер', 'svc-bend': 'листогиб трубогиб', 'svc-make': 'изготовление металлоконструкции' };
INDEX.forEach((r) => { const id = r.h.split('#')[1]; if (SERVICE_WORDS[id]) r.nk += ' ' + norm(SERVICE_WORDS[id]); });

function search(query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return INDEX
    .map((item) => {
      let score = 0;
      for (const w of words) {
        // грубо отрезаем окончание: «профильная» найдёт «профильные»
        const stem = w.length > 5 ? w.slice(0, -2) : w.length > 4 ? w.slice(0, -1) : w;
        if (item.nt.includes(w)) score += 3;
        else if (item.nt.includes(stem)) score += 2;
        else if (item.nk.includes(w) || item.nk.includes(stem)) score += 1;
        else return null;
      }
      if (item.nt.startsWith(words[0])) score += 1;
      return { item, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((r) => r.item);
}

const form = document.getElementById('search');
if (form) {
const input = document.getElementById('search-input');
const list = document.getElementById('search-results');
let results = [];
let active = -1;

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function highlight(title, query) {
  const w = norm(query).split(/\s+/).filter(Boolean)[0];
  const safe = escapeHtml(title);
  if (!w) return safe;
  const i = norm(title).indexOf(w);
  if (i < 0) return safe;
  return escapeHtml(title.slice(0, i)) + '<mark>' + escapeHtml(title.slice(i, i + w.length)) + '</mark>' + escapeHtml(title.slice(i + w.length));
}

function render() {
  const q = input.value.trim();
  if (!q) return closeResults();

  results = search(q);
  active = results.length ? 0 : -1;

  list.innerHTML = results.length
    ? results.map((r, i) => `
        <li role="presentation">
          <a href="${r.h}" role="option" data-i="${i}" aria-selected="${i === active}">
            <span><b>${highlight(r.t, q)}</b><small>${r.c}</small></span>
            <svg class="icon" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </a>
        </li>`).join('')
    : `<li class="search__empty">Ничего не нашли. Позвоните <a href="tel:88006001396"><b>8 800 600-13-96</b></a> — подберём.</li>`;

  list.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  fitResults();
}

// Список результатов не уходит под клавиатуру: высота — сколько места до низа видимой области
function fitResults() {
  if (!isPhone() || list.hidden) { list.style.maxHeight = ''; return; }
  const vv = window.visualViewport;
  const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
  const room = visibleBottom - form.getBoundingClientRect().bottom - 16;
  list.style.maxHeight = `${Math.min(360, Math.max(150, room))}px`;
}
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitResults);
window.addEventListener('scroll', fitResults, { passive: true });

function closeResults() {
  list.hidden = true;
  input.setAttribute('aria-expanded', 'false');
  active = -1;
}

function setActive(i) {
  const items = list.querySelectorAll('a[role="option"]');
  if (!items.length) return;
  active = (i + items.length) % items.length;
  items.forEach((el, n) => el.setAttribute('aria-selected', n === active));
  items[active].scrollIntoView({ block: 'nearest' });
}

function go(item) {
  closeResults();
  input.blur();
  location.href = item.h;
}

window.liftOnFocus(input, form);
input.addEventListener('input', render);
input.addEventListener('focus', () => input.value.trim() && render());
input.addEventListener('keydown', (e) => {
  if (list.hidden) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
  if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
  if (e.key === 'Escape') closeResults();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (list.hidden) render();
  if (results[active]) go(results[active]);
});

list.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-i]');
  if (!a) return;
  e.preventDefault();
  go(results[+a.dataset.i]);
});

document.addEventListener('click', (e) => {
  if (!form.contains(e.target)) closeResults();
});

document.querySelectorAll('.search__hints button').forEach((btn) => {
  btn.addEventListener('click', () => {
    input.value = btn.dataset.q;
    input.focus();
    render();
  });
});


}


/* =========================================================
   Искры в превью (лёгкий canvas, без библиотек)
   ========================================================= */
(function sparks() {
  const canvas = document.getElementById('sparks');
  if (!canvas || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  const hero = canvas.parentElement;
  let w, h, dpr, particles = [], running = true;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // искры вылетают из точки сварки на фото и разлетаются по фону
  function spawn() {
    const media = document.querySelector('.hero__photo').getBoundingClientRect();
    const box = hero.getBoundingClientRect();
    // точка сварки на фото — примерно 38% по ширине и 50% по высоте
    const ox = media.left - box.left + media.width * (0.3 + Math.random() * 0.15);
    const oy = media.top - box.top + media.height * (0.46 + Math.random() * 0.1);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
    const v = 1.2 + Math.random() * 3.2;
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: 0.006 + Math.random() * 0.012, size: 0.6 + Math.random() * 1.6 };
  }

  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    if (particles.length < 70 && Math.random() < 0.55) particles.push(spawn());

    particles = particles.filter((p) => {
      p.vy += 0.035;            // гравитация
      p.vx *= 0.993;
      p.x += p.vx; p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) return false;

      const tail = 4;
      const g = ctx.createLinearGradient(p.x, p.y, p.x - p.vx * tail, p.y - p.vy * tail);
      g.addColorStop(0, `rgba(255, 210, 150, ${p.life})`);
      g.addColorStop(1, 'rgba(255, 110, 30, 0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * tail, p.y - p.vy * tail);
      ctx.stroke();
      return true;
    });
    requestAnimationFrame(frame);
  }

  // не тратим ресурсы, когда превью не видно
  new IntersectionObserver(([entry]) => {
    const was = running;
    running = entry.isIntersecting;
    if (running && !was) requestAnimationFrame(frame);
  }).observe(hero);

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();


/* =========================================================
   Кнопка «наверх»
   ========================================================= */
const toTop = document.querySelector('.to-top');
if (toTop) {
  window.addEventListener('scroll', () => {
    toTop.classList.toggle('is-visible', window.scrollY > 600);
  }, { passive: true });
}

/* =========================================================
   Партнёры: фото на фоне карточки — только если файл есть
   ========================================================= */
// Фоны грузим, только когда блок партнёров подъезжает к экрану, — не тормозят открытие страницы
const partnerCards = document.querySelectorAll('.clients__grid [data-photo]');
const loadPhoto = (card) => {
  const img = new Image();
  img.onload = () => {
    card.style.setProperty('--photo', `url("${img.src}")`);
    card.classList.add('has-photo');
  };
  img.src = card.dataset.photo;
};
if (partnerCards.length) {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      partnerCards.forEach(loadPhoto);
      io.disconnect();
    }, { rootMargin: '600px 0px' });
    io.observe(document.querySelector('.clients__grid'));
  } else {
    partnerCards.forEach(loadPhoto);
  }
}
