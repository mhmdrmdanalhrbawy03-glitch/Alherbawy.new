const WA = '201007978423';

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__toast);
  window.__toast = setTimeout(() => t.classList.remove('show'), 2400);
}

function installTheme() {
  if (window.initAlhTheme) window.initAlhTheme();
}

function installCartBadge() {
  if (window.AlhCartBadge) {
    window.AlhCartBadge.update();
    return;
  }
  if (document.querySelector('script[data-alh-cart-badge]')) return;

  const s = document.createElement('script');
  s.src = 'cart-badge.js';
  s.dataset.alhCartBadge = '1';
  s.defer = true;
  document.head.appendChild(s);
}

function installContactDock() {
  if (document.querySelector('.contact-dock')) return;

  const d = document.createElement('div');
  d.className = 'contact-dock';
  d.innerHTML = `
    <a class="dock-whatsapp" href="https://wa.me/${WA}" aria-label="واتساب">
      واتساب
    </a>
    <a class="dock-phone" href="tel:01007978423" aria-label="اتصال">
      اتصال
    </a>
  `;
  document.body.append(d);
}

async function loadFaqs() {
  const box = document.getElementById('faqList');
  if (!box) return;

  if (!window.sb) {
    box.innerHTML = '<p class="faq-error">تعذر الاتصال بقاعدة البيانات.</p>';
    return;
  }

  try {
    const { data, error } = await window.sb
      .from('faqs')
      .select('question,answer')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    box.innerHTML = (data || []).map(f => `
      <details class="faq-item">
        <summary>${esc(f.question)}</summary>
        <p>${esc(f.answer)}</p>
      </details>
    `).join('') || '<p class="faq-empty">سيتم إضافة الأسئلة قريبًا.</p>';

  } catch (e) {
    box.innerHTML = '<p class="faq-error">الأسئلة الشائعة غير متاحة حاليًا.</p>';
    console.error('FAQ load:', e);
  }
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

function shell() {
  installTheme();
  installCartBadge();
  installContactDock();
  loadFaqs();

  if ('IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.08 });

    document.querySelectorAll(
      'section,.premium-card,.product-card,.gallery-tile'
    ).forEach(x => {
      x.classList.add('reveal');
      obs.observe(x);
    });
  }
}

document.addEventListener('DOMContentLoaded', shell);
