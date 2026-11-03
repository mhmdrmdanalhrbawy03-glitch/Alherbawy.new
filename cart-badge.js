(function () {
  'use strict';

  const KEY = 'alh-cart';

  function getCount() {
    try {
      const cart = JSON.parse(localStorage.getItem(KEY) || '{}');

      if (!cart || typeof cart !== 'object' || Array.isArray(cart)) {
        return 0;
      }

      return Object.values(cart).reduce((total, item) => {
        return total + Math.max(0, Number(item?.qty) || 0);
      }, 0);
    } catch (e) {
      return 0;
    }
  }

  function createBadge() {
    let link = document.querySelector(
      'a[data-alh-cart-link], a[href="checkout.html"]'
    );

    if (!link) {
      const host =
        document.querySelector('.header-tools') ||
        document.querySelector('nav > div');

      if (!host) return;

      link = document.createElement('a');
      link.href = 'checkout.html';
      link.className = 'alh-cart-link';
      link.dataset.alhCartLink = '1';
      link.innerHTML = '🛒 <span>السلة</span>';
      host.appendChild(link);
    }

    link.classList.add('alh-cart-link');
    link.dataset.alhCartLink = '1';

    if (!link.querySelector('.alh-cart-count')) {
      const badge = document.createElement('b');
      badge.className = 'alh-cart-count';
      link.appendChild(badge);
    }

    return link;
  }

  function update() {
    const count = getCount();

    document.querySelectorAll('.alh-cart-count').forEach(badge => {
      badge.textContent = count > 99 ? '99+' : count;
      badge.hidden = count === 0;
    });

    document.querySelectorAll('[data-alh-cart-link]').forEach(link => {
      link.setAttribute('aria-label', `السلة، ${count} منتج`);
    });
  }

  function init() {
    createBadge();
    update();
  }

  const style = document.createElement('style');
  style.textContent = `
    .alh-cart-link {
      display:inline-flex!important;
      align-items:center!important;
      gap:7px!important;
      padding:8px 13px!important;
      border:1px solid #c99f28!important;
      border-radius:10px!important;
      background:#080808!important;
      color:#f5d77e!important;
      font-weight:900!important;
      text-decoration:none!important;
    }

    .alh-cart-count {
      display:inline-grid!important;
      place-items:center!important;
      min-width:22px!important;
      height:22px!important;
      padding:0 5px!important;
      border-radius:50px!important;
      background:#e51d35!important;
      color:#fff!important;
      font-size:12px!important;
      font-weight:900!important;
    }

    .alh-cart-count[hidden] {
      display:none!important;
    }
  `;

  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.addEventListener('storage', e => {
    if (e.key === KEY) update();
  });

  window.addEventListener('alh-cart-updated', update);
  window.addEventListener('pageshow', update);

  window.AlhCartBadge = { update };
})();
