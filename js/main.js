/* ============================================================
   KALIKO — main.js
   ============================================================ */

// --- Mobile nav toggle ------------------------------------
(function () {
  const toggle = document.querySelector('.nav-toggle');
  const mobile = document.querySelector('.nav-mobile');
  if (!toggle || !mobile) return;

  toggle.addEventListener('click', () => {
    const open = mobile.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!toggle.contains(e.target) && !mobile.contains(e.target)) {
      mobile.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', false);
    }
  });
})();

// --- Fade-up on scroll ------------------------------------
(function () {
  const els = document.querySelectorAll('.fade-up');
  if (!els.length || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  els.forEach((el) => observer.observe(el));
})();

// --- Active nav link --------------------------------------
(function () {
  const links = document.querySelectorAll('.nav-links a, .nav-mobile a');
  const path = window.location.pathname.replace(/\/$/, '');

  links.forEach((link) => {
    const href = link.getAttribute('href').replace(/\/$/, '');
    if (href === path || (path === '' && href === '/index.html')) {
      link.classList.add('active');
    }
  });
})();
