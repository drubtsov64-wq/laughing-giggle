'use strict';

/* ============================================================
   DOM-ССЫЛКИ
   ============================================================ */
const header       = document.getElementById('header');
const navBurger    = document.getElementById('navBurger');
const navList      = document.getElementById('navList');
const navLinks     = document.querySelectorAll('.nav__link');
const sections     = document.querySelectorAll('section[id]');
const scrollTopBtn = document.getElementById('scrollTop');


/* ============================================================
   1. ПЛАВНЫЙ СКРОЛЛ ПО ЯКОРЯМ
   ─────────────────────────────────────────────────────────
   Перехватываем ВСЕ клики по <a href="#..."> на странице.
   scrollIntoView({ behavior:'smooth' }) уважает CSS-правило
   scroll-padding-top, поэтому хедер учитывается автоматически.
   ============================================================ */
document.addEventListener('click', e => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;

  const hash = link.getAttribute('href');
  if (hash === '#') return;                       // якорь-заглушка

  const target = document.querySelector(hash);
  if (!target) return;

  e.preventDefault();

  // Сначала снимаем overflow:hidden от мобильного меню,
  // затем через requestAnimationFrame — плавный скролл
  closeMobileMenu();
  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Обновляем URL-хэш без прыжка страницы
  history.pushState(null, '', hash);
});


/* ============================================================
   2. ХЭДЕР — тень при скролле + видимость кнопки «наверх»
   ============================================================ */
function onScroll() {
  const y = window.scrollY;
  header.classList.toggle('scrolled',   y > 20);
  scrollTopBtn.classList.toggle('visible', y > 500);
}

window.addEventListener('scroll', onScroll, { passive: true });
onScroll();  // применяем сразу при загрузке


/* ============================================================
   3. МОБИЛЬНОЕ МЕНЮ
   ============================================================ */
navBurger.addEventListener('click', () => {
  const open = navList.classList.toggle('open');
  navBurger.classList.toggle('open', open);
  navBurger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
});

// Закрыть по Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMobileMenu();
});

// Закрыть по тапу вне панели на мобиле
document.addEventListener('click', e => {
  if (
    navList.classList.contains('open') &&
    !navList.contains(e.target) &&
    !navBurger.contains(e.target)
  ) closeMobileMenu();
});

function closeMobileMenu() {
  navList.classList.remove('open');
  navBurger.classList.remove('open');
  navBurger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}


/* ============================================================
   4. ПОДСВЕТКА АКТИВНОГО ПУНКТА МЕНЮ
   ─────────────────────────────────────────────────────────
   Алгоритм:
   • Кешируем абсолютные позиции секций (getBoundingClientRect
     + scrollY — стабильнее offsetTop при наличии transform'ов).
   • На каждом scroll-событии определяем «активную» секцию:
     та, чей верхний край ≤ 45% высоты экрана от низа (т. е.
     секция уже заняла середину вьюпорта).
   • Перекешируем позиции на resize (ширина могла измениться).
   ============================================================ */
let sectionPositions = [];

function cacheSectionPositions() {
  sectionPositions = [...sections].map(s => ({
    id:  s.id,
    top: s.getBoundingClientRect().top + window.scrollY,
  }));
}

cacheSectionPositions();
window.addEventListener('resize', cacheSectionPositions, { passive: true });

function getActiveSectionId() {
  // Порог: top секции должен быть выше 45% высоты экрана от верха
  const threshold = window.scrollY + window.innerHeight * 0.45;
  let activeId = sectionPositions[0]?.id ?? null;

  for (const { id, top } of sectionPositions) {
    if (top <= threshold) activeId = id;
    else break;
  }
  return activeId;
}

function updateActiveNav() {
  const activeId = getActiveSectionId();
  navLinks.forEach(link => {
    link.classList.toggle(
      'active',
      link.getAttribute('href') === `#${activeId}`,
    );
  });
}

window.addEventListener('scroll', updateActiveNav, { passive: true });
updateActiveNav();


/* ============================================================
   5. REVEAL-АНИМАЦИИ ПРИ СКРОЛЛЕ (IntersectionObserver)
   ─────────────────────────────────────────────────────────
   • Каждый целевой элемент получает класс .reveal (скрыт CSS).
   • Когда элемент входит во вьюпорт — добавляем .visible.
   • Соседи в одном контейнере появляются каскадом:
     delay = index × 90ms, но не больше 450ms.
   • После срабатывания observer отписывается (анимация один раз).
   ============================================================ */
const REVEAL_TARGETS = [
  '.service-card',
  '.portfolio-card',
  '.process-step',
  '.testimonial-card',
  '.faq-item',
  '.why-card',
  '.who-item',
  '.project-card',
  '.about__photo',
  '.about__text',
  '.contact__form',
  '.contact__messenger',
  '.contact__info',
  '.hero__stats',
];

const revealEls = document.querySelectorAll(REVEAL_TARGETS.join(', '));

// Помечаем элементы до того, как они попадут во вьюпорт
revealEls.forEach(el => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver(
  entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el = entry.target;

      // Считаем индекс среди соседей с тем же классом .reveal
      // (это могут быть карточки в одной сетке)
      const revealSiblings = [...(el.parentElement?.children ?? [])]
        .filter(c => c.classList.contains('reveal'));
      const idx = revealSiblings.indexOf(el);

      // Ставим delay только у реальных «соседей по сетке»
      el.style.transitionDelay = idx > 0
        ? `${Math.min(idx * 90, 450)}ms`
        : '';

      el.classList.add('visible');
      revealObserver.unobserve(el);
    });
  },
  {
    threshold:  0.07,
    rootMargin: '0px 0px -32px 0px', // срабатывает чуть раньше самого низа
  },
);

revealEls.forEach(el => revealObserver.observe(el));


/* ============================================================
   5b. REVEAL-АНИМАЦИИ ДЛЯ СЕКЦИЙ И ЗАГОЛОВКОВ
   ─────────────────────────────────────────────────────────
   Отдельный лёгкий эффект для заголовков секций (index.html)
   и блоков на страницах кейсов (.proj-*).
   При prefers-reduced-motion — элементы остаются видимыми.
   Элементы, уже видимые при загрузке (выше сгиба), не скрываем.
   ============================================================ */
const SEC_REVEAL_TARGETS = [
  '.section__title',
  '.section__subtitle',
  '.proj-hero',
  '.proj-img',
  '.proj-content',
  '.proj-cta',
];

const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!prefersReducedMotion) {
  const secRevealEls = document.querySelectorAll(SEC_REVEAL_TARGETS.join(', '));

  const secObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        secObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -24px 0px' },
  );

  secRevealEls.forEach(el => {
    // Не скрываем элементы, уже видимые при загрузке страницы
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.classList.add('sec-reveal');
    secObserver.observe(el);
  });
}


/* ============================================================
   6. ФИЛЬТРАЦИЯ ПОРТФОЛИО
   ============================================================ */
const filterBtns     = document.querySelectorAll('.filter-btn');
const portfolioCards = document.querySelectorAll('.portfolio-card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const filter = btn.dataset.filter;

    filterBtns.forEach(b => {
      b.classList.remove('filter-btn--active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('filter-btn--active');
    btn.setAttribute('aria-selected', 'true');

    portfolioCards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('hidden', !match);
    });
  });
});


/* ============================================================
   7. FAQ — закрывать остальные при открытии одного
   ============================================================ */
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
  item.addEventListener('toggle', () => {
    if (!item.open) return;
    faqItems.forEach(other => {
      if (other !== item && other.open) other.removeAttribute('open');
    });
  });
});


/* ============================================================
   8. ФОРМА КОНТАКТА — валидация + имитация отправки
   ============================================================ */
const contactForm = document.getElementById('contactForm');
const formSuccess = document.getElementById('formSuccess');

if (contactForm) {

  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    if (!validateForm()) return;

    const submitBtn = contactForm.querySelector('[type="submit"]');
    submitBtn.disabled    = true;
    submitBtn.textContent = 'Отправляем…';

    const data = new FormData(contactForm);

    fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:    data.get('name'),
        contact: data.get('contact'),
        message: data.get('message'),
        hp:      data.get('hp') || '',
      }),
    })
      .then(res => res.json())
      .then(res => {
        if (!res.ok) throw new Error('Send error');
        contactForm.reset();
        formSuccess.hidden = false;
        setTimeout(() => { formSuccess.hidden = true; }, 6000);
      })
      .catch(() => {
        alert('Ошибка отправки. Напишите напрямую: wwwsamo@yandex.ru');
      })
      .finally(() => {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Отправить сообщение';
      });
  });

  // Живой сброс ошибки при вводе
  contactForm.addEventListener('input', e => {
    if (e.target.matches('input, textarea')) clearFieldError(e.target);
  });
}

function validateForm() {
  let ok = true;
  contactForm.querySelectorAll('[required]').forEach(field => {
    const msg = getFieldError(field);
    showFieldError(field, msg);
    if (msg) ok = false;
  });
  return ok;
}

function getFieldError(field) {
  if (!field.value.trim()) return 'Обязательное поле.';
  if (
    field.type === 'email' &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)
  ) return 'Введите корректный email.';
  return '';
}

function showFieldError(field, msg) {
  const errEl = field.parentElement.querySelector('.form-error');
  field.classList.toggle('invalid', !!msg);
  if (errEl) errEl.textContent = msg;
}

function clearFieldError(field) {
  showFieldError(field, '');
}


/* ============================================================
   9. КНОПКА «НАВЕРХ»
   ============================================================ */
scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});


/* ============================================================
   10. ГОД В FOOTER
   ============================================================ */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();


/* ============================================================
   11. ВНЕШНИЕ ССЫЛКИ — target="_blank" + rel="noopener noreferrer"
   ============================================================ */
document.querySelectorAll('a[href]').forEach(link => {
  const isExternal = link.hostname && link.hostname !== window.location.hostname;
  if (isExternal) {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  }
});


/* ============================================================
   12. СЕКЦИОННЫЙ REVEAL (section.reveal / footer.reveal → .is-visible)
   ─────────────────────────────────────────────────────────
   Отдельный observer для секций — они не теряют opacity,
   только сдвигаются translateY. Карточки внутри анимируются
   своим observer'ом (см. шаг 5).
   ============================================================ */
(function initSectionReveal() {
  const sectionRevealEls = document.querySelectorAll('section.reveal, footer.reveal');

  if (!sectionRevealEls.length) return;

  // Если IntersectionObserver недоступен — показываем всё сразу
  if (!('IntersectionObserver' in window)) {
    sectionRevealEls.forEach(el => el.classList.add('is-visible'));
    return;
  }

  // Элементы, уже видимые при загрузке (выше сгиба) — показываем без анимации
  sectionRevealEls.forEach(el => {
    if (el.getBoundingClientRect().top < window.innerHeight) {
      el.classList.add('is-visible');
    }
  });

  const sectionObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        sectionObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
  );

  sectionRevealEls.forEach(el => {
    if (!el.classList.contains('is-visible')) {
      sectionObserver.observe(el);
    }
  });
}());


/* ============================================================
   13. CURSOR GLOW
   ============================================================ */
(function initCursorGlow() {
  const glowEl = document.querySelector('.cursor-glow');
  if (!glowEl) return;

  // Touch-устройства — выключаем
  if (!window.matchMedia('(hover: hover)').matches) {
    glowEl.style.display = 'none';
    return;
  }

  let rafId = null;
  let targetX = window.innerWidth  / 2;
  let targetY = window.innerHeight / 2;

  document.addEventListener('mousemove', e => {
    targetX = e.clientX;
    targetY = e.clientY;

    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      glowEl.style.setProperty('--glow-x', `${targetX}px`);
      glowEl.style.setProperty('--glow-y', `${targetY}px`);
      rafId = null;
    });
  }, { passive: true });
}());


/* ============================================================
   14. TILT CARDS (Apple-like 3D hover)
   ============================================================ */
(function initTiltCards() {
  // Уважаем prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Только hover-устройства
  if (!window.matchMedia('(hover: hover)').matches) return;

  const MAX_TILT  = 6;   // градусы
  const SCALE     = 1.01;

  document.querySelectorAll('.tilt-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect   = card.getBoundingClientRect();
      const cx     = rect.left + rect.width  / 2;
      const cy     = rect.top  + rect.height / 2;
      const dx     = (e.clientX - cx) / (rect.width  / 2);  // -1 .. 1
      const dy     = (e.clientY - cy) / (rect.height / 2);  // -1 .. 1

      const rotX   = -dy * MAX_TILT;
      const rotY   =  dx * MAX_TILT;

      // CSS vars для highlight (в %)
      const mx = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
      const my = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);

      card.style.transform =
        `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-2px) scale(${SCALE})`;
      card.style.setProperty('--mx', `${mx}%`);
      card.style.setProperty('--my', `${my}%`);
    }, { passive: true });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.removeProperty('--mx');
      card.style.removeProperty('--my');
    });
  });
}());


/* ============================================================
   15. QUIZ ENGINE
   ─────────────────────────────────────────────────────────
   Универсальный контроллер — работает для любого .quiz-box.
   Вызывается для inline-квиза (#quizInline) и popup (#quizPopupBox).
   ============================================================ */
(function initQuizEngine() {
  'use strict';

  const TOTAL_OPT_STEPS = 3;

  function Quiz(wrapperEl) {
    if (!wrapperEl) return;

    const $ = sel => wrapperEl.querySelector(sel);

    const fillEl   = $('.quiz-box__fill');
    const counter  = $('.quiz-box__counter');
    const footEl   = $('.quiz-box__foot');
    const backBtn  = $('.quiz-back');
    const headEl   = $('.quiz-box__head');
    const doneEl   = $('.quiz-box__done');

    let step = 1;
    const answers = {};

    function showStep(n) {
      wrapperEl.querySelectorAll('.quiz-box__step').forEach(el => {
        el.hidden = parseInt(el.dataset.step) !== n;
      });
      step = n;

      // Прогресс-бар
      const pct = n <= TOTAL_OPT_STEPS
        ? Math.round((n - 1) / TOTAL_OPT_STEPS * 100)
        : 90;
      if (fillEl)  fillEl.style.width = pct + '%';
      if (fillEl)  fillEl.parentElement.setAttribute('aria-valuenow', pct);

      // Счётчик
      if (counter) counter.textContent = n <= TOTAL_OPT_STEPS
        ? `Шаг ${n} из ${TOTAL_OPT_STEPS}`
        : 'Почти готово!';

      // Кнопка «Назад»
      if (backBtn) backBtn.hidden = n <= 1;
    }

    // Клик по варианту — сохранить + перейти дальше
    wrapperEl.querySelectorAll('.quiz-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = parseInt(btn.dataset.step);
        answers[s] = btn.dataset.val;

        // Визуальный выбор
        wrapperEl.querySelectorAll(`.quiz-opt[data-step="${s}"]`)
          .forEach(b => b.classList.remove('is-selected'));
        btn.classList.add('is-selected');

        // Динамически обновляем label контакта (шаг 3 → шаг 4)
        if (s === TOTAL_OPT_STEPS) {
          const lbl = $('[data-contact-label]');
          if (lbl) {
            const map = {
              telegram: 'Telegram @username',
              whatsapp: 'Номер WhatsApp',
              email:    'Email адрес',
            };
            lbl.textContent = map[btn.dataset.val] || 'Telegram / WhatsApp / Email';
          }
        }

        setTimeout(() => showStep(step + 1), 280);
      });
    });

    // Кнопка «Назад»
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (step > 1) showStep(step - 1);
      });
    }

    // Кнопка отправки (шаг 4)
    const submitBtn = $('[data-quiz-submit]');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        const nameInp = $('[data-quiz-name]');
        const contInp = $('[data-quiz-contact]');
        let valid = true;

        [nameInp, contInp].forEach(inp => {
          if (!inp) return;
          const empty = !inp.value.trim();
          inp.classList.toggle('invalid', empty);
          const errEl = inp.parentElement.querySelector('.form-error');
          if (errEl) errEl.textContent = empty ? 'Обязательное поле.' : '';
          if (empty) valid = false;
        });

        if (!valid) return;

        submitBtn.disabled    = true;
        submitBtn.textContent = 'Отправляем…';

        fetch('/api/contact', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source:         'quiz',
            service:        answers[1] || '',
            timing:         answers[2] || '',
            contact_method: answers[3] || '',
            name:           nameInp?.value.trim() || '',
            contact:        contInp?.value.trim() || '',
          }),
        })
        .catch(() => {})           // silent fail — всё равно показываем экран успеха
        .finally(() => showDone());
      });
    }

    // Сброс ошибки при вводе
    wrapperEl.addEventListener('input', e => {
      if (e.target.matches('input')) {
        e.target.classList.remove('invalid');
        const errEl = e.target.parentElement.querySelector('.form-error');
        if (errEl) errEl.textContent = '';
      }
    });

    function showDone() {
      wrapperEl.querySelectorAll('.quiz-box__step').forEach(s => { s.hidden = true; });
      if (headEl) headEl.hidden = true;
      if (footEl) footEl.hidden = true;
      if (doneEl) {
        doneEl.hidden = false;
        if (fillEl) fillEl.style.width = '100%';
      }
    }

    // Инициализация — показать первый шаг
    showStep(1);
  }

  // ── Создаём оба экземпляра квиза ──────────────────────────
  new Quiz(document.getElementById('quizInline'));
  new Quiz(document.getElementById('quizPopupBox'));


  // ── OVERLAY (Вариант 2) — открыть / закрыть ───────────────
  const overlay      = document.getElementById('quizOverlay');
  const overlayClose = document.getElementById('quizOverlayClose');

  function openOverlay() {
    if (!overlay) return;
    overlay.hidden = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('is-open'));
    });
    document.body.style.overflow = 'hidden';
    overlayClose?.focus();
  }

  function closeOverlay() {
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    overlay.addEventListener('transitionend', () => {
      if (!overlay.classList.contains('is-open')) overlay.hidden = true;
    }, { once: true });
  }

  if (overlayClose) overlayClose.addEventListener('click', closeOverlay);

  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeOverlay();
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay && !overlay.hidden) closeOverlay();
  });

  // Любой элемент с data-open-quiz открывает оверлей
  document.querySelectorAll('[data-open-quiz]').forEach(el => {
    el.addEventListener('click', openOverlay);
  });


  // ── FAB (Вариант 3) — открывает popup ─────────────────────
  const fab         = document.getElementById('quizFab');
  const quizSection = document.getElementById('quiz');

  if (fab) {
    fab.addEventListener('click', openOverlay);

    // Скрываем FAB пока inline-квиз виден на экране
    if (quizSection && 'IntersectionObserver' in window) {
      const fabObserver = new IntersectionObserver(
        ([entry]) => fab.classList.toggle('is-hidden', entry.isIntersecting),
        { rootMargin: '200px 0px 0px 0px' }
      );
      fabObserver.observe(quizSection);
    }
  }

}());
