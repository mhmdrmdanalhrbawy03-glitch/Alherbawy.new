(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const say = (id, message, type = 'info') => {
    const el = $(id);
    if (!el) return;
    el.textContent = message;
    el.dataset.type = type;
    el.style.display = 'block';
  };
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let sb = null;
  let activeUserId = null;
  let starting = false;

  function getClient() {
    if (window.sb) return window.sb;
    say('loginMsg', 'تعذر تحميل مكتبة Supabase أو إعدادات الاتصال. حدّث الصفحة، وتأكد من اتصال الإنترنت وملفي supabase-config.js وsupabase-client.js.', 'error');
    return null;
  }

  async function verifyAdmin(user) {
    const { data, error } = await sb.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (error) {
      say('loginMsg', 'تم تسجيل الدخول لكن تعذر فحص صلاحيات المدير. تأكد من تشغيل ملف SQL وإنشاء جدول profiles. التفاصيل: ' + error.message, 'error');
      return false;
    }
    if (!data || data.role !== 'admin') {
      await sb.auth.signOut();
      say('loginMsg', 'الحساب دخل بنجاح لكنه ليس مديرًا. أضف UUID الخاص به في جدول profiles واجعل role = admin.', 'error');
      return false;
    }
    return true;
  }

  async function start(user) {
    if (!user || starting || activeUserId === user.id) return;
    starting = true;
    try {
      say('loginMsg', 'جارٍ التحقق من صلاحيات الحساب...');
      if (!(await verifyAdmin(user))) return;
      activeUserId = user.id;
      $('login').classList.add('hidden');
      $('dashboard').classList.remove('hidden');
      $('userEmail').textContent = user.email || 'حساب Google';
      $('welcome').textContent = 'مرحبًا بك في إدارة مؤسسة الحرباوي';
      await Promise.all([loadProducts(), loadOrders(), loadInquiries()]);
    } catch (err) {
      say('loginMsg', 'حدث خطأ أثناء فتح لوحة التحكم: ' + (err?.message || err), 'error');
    } finally {
      starting = false;
    }
  }

  async function loadProducts() {
    const { data, error } = await sb.from('products').select('*').order('created_at', { ascending: false });
    if (error) { say('productMsg', 'تعذر تحميل المنتجات: ' + error.message, 'error'); return; }
    $('productCount').textContent = (data || []).length;
    $('productsRows').innerHTML = (data || []).map(p => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.category)}</td><td>${p.price ?? '—'}</td><td>${p.is_active ? 'نعم' : 'لا'}</td><td><button type="button" onclick="editProduct('${p.id}')">تعديل</button> <button type="button" onclick="deleteProduct('${p.id}')">حذف</button></td></tr>`).join('') || '<tr><td colspan="5">لا توجد منتجات حتى الآن.</td></tr>';
  }

  async function loadOrders() {
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(100);
    $('orderCount').textContent = error ? '!' : (data || []).length;
    $('ordersRows').innerHTML = error ? `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>` : ((data || []).map(o => `<tr><td>${escapeHtml(o.customer_name)}</td><td>${escapeHtml(o.phone)}</td><td>${escapeHtml(JSON.stringify(o.items))}</td><td><select onchange="setOrderStatus('${o.id}',this.value)">${['new','contacted','quoted','completed','cancelled'].map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td>${o.created_at ? new Date(o.created_at).toLocaleString('ar-EG') : '—'}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد طلبات حتى الآن.</td></tr>');
  }

  async function loadInquiries() {
    const { data, error } = await sb.from('inquiries').select('*').order('created_at', { ascending: false }).limit(100);
    $('inquiryCount').textContent = error ? '!' : (data || []).length;
    $('inquiriesRows').innerHTML = error ? `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>` : ((data || []).map(x => `<tr><td>${escapeHtml(x.customer_name)}</td><td>${escapeHtml(x.phone)}</td><td>${escapeHtml(x.kind)}</td><td>${escapeHtml(x.message)}</td><td>${x.created_at ? new Date(x.created_at).toLocaleString('ar-EG') : '—'}</td></tr>`).join('') || '<tr><td colspan="5">لا توجد استفسارات حتى الآن.</td></tr>');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    sb = getClient();
    if (!sb) return;

    $('loginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      say('loginMsg', 'جارٍ تسجيل الدخول...');
      const { data, error } = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
      if (error) { say('loginMsg', 'تعذر تسجيل الدخول: ' + error.message, 'error'); return; }
      await start(data.user);
    });

    $('googleLogin').addEventListener('click', async () => {
      say('loginMsg', 'جارٍ فتح تسجيل الدخول بحساب Google...');
      const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href.split('#')[0].split('?')[0] } });
      if (error) say('loginMsg', 'تعذر بدء تسجيل Google. تأكد من تفعيل Google Provider في Supabase. التفاصيل: ' + error.message, 'error');
    });

    $('logout').addEventListener('click', async () => { await sb.auth.signOut(); window.location.reload(); });
    $('clearForm').addEventListener('click', () => { $('productForm').reset(); $('pid').value = ''; $('pactive').checked = true; });

    $('productForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const id = $('pid').value;
      const row = { name: $('pname').value.trim(), category: $('pcat').value.trim(), price: $('pprice').value ? Number($('pprice').value) : null, unit: $('punit').value.trim() || 'قطعة', image_url: $('pimage').value.trim(), description: $('pdesc').value.trim(), is_active: $('pactive').checked };
      const { error } = id ? await sb.from('products').update(row).eq('id', id) : await sb.from('products').insert(row);
      if (error) { say('productMsg', 'تعذر حفظ المنتج: ' + error.message, 'error'); return; }
      say('productMsg', 'تم حفظ المنتج بنجاح.');
      $('productForm').reset(); $('pid').value = ''; $('pactive').checked = true;
      await loadProducts();
    });

    window.editProduct = async (id) => {
      const { data, error } = await sb.from('products').select('*').eq('id', id).single();
      if (error || !data) { alert('تعذر تحميل المنتج: ' + (error?.message || 'غير موجود')); return; }
      $('pid').value = data.id; $('pname').value = data.name || ''; $('pcat').value = data.category || ''; $('pprice').value = data.price ?? ''; $('punit').value = data.unit || 'قطعة'; $('pimage').value = data.image_url || ''; $('pdesc').value = data.description || ''; $('pactive').checked = !!data.is_active;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.deleteProduct = async (id) => {
      if (!confirm('هل تريد حذف المنتج؟')) return;
      const { error } = await sb.from('products').delete().eq('id', id);
      if (error) alert('تعذر حذف المنتج: ' + error.message); else await loadProducts();
    };
    window.setOrderStatus = async (id, status) => {
      const { error } = await sb.from('orders').update({ status }).eq('id', id);
      if (error) alert('تعذر تحديث حالة الطلب: ' + error.message);
    };

    sb.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        setTimeout(() => start(session.user), 0);
      }
    });
    const { data, error } = await sb.auth.getSession();
    if (error) say('loginMsg', 'تعذر قراءة جلسة الدخول: ' + error.message, 'error');
    else if (data.session?.user) await start(data.session.user);
    else say('loginMsg', 'الاتصال جاهز. اختر Google أو أدخل البريد الإلكتروني وكلمة المرور.');
  });

  window.addEventListener('error', (event) => {
    const msg = event?.message || 'خطأ JavaScript غير معروف';
    const target = $('loginMsg');
    if (target && !document.getElementById('dashboard').classList.contains('hidden')) return;
    say('loginMsg', 'حدث خطأ في تحميل لوحة الإدارة: ' + msg, 'error');
  });
})();
