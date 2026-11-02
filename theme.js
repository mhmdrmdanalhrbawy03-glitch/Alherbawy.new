/* Shared premium theme controller for all site pages. */
(function () {
  'use strict';
  const KEY = 'alh-theme';
  const read = () => { try { return localStorage.getItem(KEY) === 'dark'; } catch (_) { return false; } };
  const write = value => { try { localStorage.setItem(KEY, value ? 'dark' : 'light'); } catch (_) {} };
  function apply(dark) {
    document.body.classList.toggle('dark-mode', !!dark);
    const button = document.getElementById('alhThemeButton');
    if (button) {
      button.innerHTML = dark
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a7 7 0 1 0 9 9 9 9 0 1 1-9-9Z"/></svg><span>نهاري</span>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z"/></svg><span>ليلي</span>';
      button.setAttribute('aria-label', dark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي');
      button.setAttribute('aria-pressed', dark ? 'true' : 'false');
      button.title = dark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي';
    }
  }
  function init() {
    let button = document.getElementById('alhThemeButton');
    if (!button) {
      button = document.createElement('button');
      button.id = 'alhThemeButton'; button.type = 'button'; button.className = 'theme-toggle premium-theme-toggle';
      button.addEventListener('click', () => { const next = !document.body.classList.contains('dark-mode'); write(next); apply(next); });
      document.body.appendChild(button);
    }
    apply(read());
  }
  // Apply the saved theme as soon as possible, including pages without app.js.
  try { if (read()) document.documentElement.classList.add('alh-dark-pending'); } catch (_) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
  window.initAlhTheme = init;
})();
