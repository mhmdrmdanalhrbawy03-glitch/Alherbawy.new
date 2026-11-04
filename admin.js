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
      await Promise.all([loadProducts(), loadOrders(), loadInquiries(), loadFaqs(), loadPaymentMethods(), loadCustomers(), loadCustomerActivity()]);
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
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(150);
    $('orderCount').textContent = error ? '!' : (data || []).length;
    if(error){$('ordersRows').innerHTML=`<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;return;}
    const labels={pending_review:'قيد المراجعة',payment_confirmed:'تم تأكيد الدفع',processing:'جارٍ التجهيز',shipped:'تم الشحن / التسليم',completed:'مكتمل',cancelled:'ملغي',payment_rejected:'إثبات مرفوض'};
    const html=[];
    for(const o of (data||[])){
      let receipt='—'; if(o.receipt_path){const {data:signed}=await sb.storage.from('payment-receipts').createSignedUrl(o.receipt_path,300);if(signed?.signedUrl)receipt=`<a target="_blank" rel="noopener" href="${escapeHtml(signed.signedUrl)}">عرض الإثبات</a>`;}
      const items=(o.items||[]).map(i=>`${escapeHtml(i.name)} × ${Number(i.quantity||1)}`).join('<br>');
      html.push(`<tr><td>${escapeHtml(o.customer_name)}<br><small>${escapeHtml(o.phone)}</small></td><td>${escapeHtml(o.tracking_code||'—')}<br>${items}<br><b>${Number(o.total_amount||0).toLocaleString('ar-EG')} ج.م</b><br>${escapeHtml(o.payment_method_name||'')}</td><td>${receipt}</td><td><select onchange="setOrderStatus('${o.id}',this.value)">${Object.entries(labels).filter(([k])=>k!=='payment_rejected').map(([k,v])=>`<option value="${k}" ${o.status===k?'selected':''}>${v}</option>`).join('')}</select><select style="margin-top:5px" onchange="setPaymentStatus('${o.id}',this.value)"><option value="pending_review" ${o.payment_status==='pending_review'?'selected':''}>الدفع قيد المراجعة</option><option value="payment_confirmed" ${o.payment_status==='payment_confirmed'?'selected':''}>تم تأكيد الدفع</option><option value="payment_rejected" ${o.payment_status==='payment_rejected'?'selected':''}>رفض الإثبات</option></select><input class="field" style="min-width:160px;margin-top:5px" placeholder="ملاحظة للعميل" value="${escapeHtml(o.admin_note||'')}" onchange="saveOrderNote('${o.id}',this.value)"></td><td>${o.created_at?new Date(o.created_at).toLocaleString('ar-EG'):'—'}</td></tr>`);
    }
    $('ordersRows').innerHTML=html.join('')||'<tr><td colspan="7">لا توجد طلبات حتى الآن.</td></tr>';
  }


  async function loadCustomers() {
    const body = $('customersRows'); if (!body) return;
    body.innerHTML = '<tr><td colspan="6">جارٍ تحميل العملاء…</td></tr>';
    const [{ data: profiles, error: profileError }, { data: orders, error: orderError }] = await Promise.all([
      sb.from('profiles').select('id,email,full_name,phone,role,created_at,account_status,is_verified,warning_message,last_seen_at').eq('role','customer').order('created_at',{ascending:false}),
      sb.from('orders').select('id,user_id,tracking_code,customer_name,total_amount,status,created_at').not('user_id','is',null).order('created_at',{ascending:false}).limit(1000)
    ]);
    if (profileError) { body.innerHTML = `<tr><td colspan="6">${escapeHtml(profileError.message)}</td></tr>`; say('customersMsg','تعذر تحميل بيانات العملاء. شغّل ملف SQL الخاص بإدارة الحسابات أولًا.','error'); return; }
    if (orderError) { body.innerHTML = `<tr><td colspan="6">${escapeHtml(orderError.message)}</td></tr>`; return; }
    const grouped = new Map(); for (const o of (orders||[])) { if(!grouped.has(o.user_id)) grouped.set(o.user_id,[]); grouped.get(o.user_id).push(o); }
    $('customerCount').textContent=(profiles||[]).length;
    body.innerHTML=(profiles||[]).map(c=>{
      const list=grouped.get(c.id)||[], verified=c.is_verified?' <span title="حساب موثّق" style="color:#1687d9;font-weight:900">✔ موثّق</span>':'';
      const status=c.account_status||'active', statusLabel={active:'نشط',warned:'محذّر',suspended:'موقوف مؤقتًا',banned:'محظور'}[status]||status;
      const orderHtml=list.length?list.map(o=>`<div style="padding:6px 0;border-bottom:1px solid #eee"><b>${escapeHtml(o.tracking_code||o.id)}</b> — ${Number(o.total_amount||0).toLocaleString('ar-EG')} ج.م<br><small>${escapeHtml(o.status||'—')} · ${o.created_at?new Date(o.created_at).toLocaleDateString('ar-EG'):'—'}</small></div>`).join(''):'لا توجد طلبات';
      return `<tr><td><b>${escapeHtml(c.full_name||'عميل بدون اسم')}</b>${verified}<br><small>${escapeHtml(c.id)}</small></td><td>${escapeHtml(c.phone||'—')}<br>${escapeHtml(c.email||'—')}</td><td>${c.created_at?new Date(c.created_at).toLocaleDateString('ar-EG'):'—'}<br><small>آخر ظهور: ${c.last_seen_at?new Date(c.last_seen_at).toLocaleString('ar-EG'):'غير متاح'}</small></td><td>${list.length}</td><td style="white-space:normal;min-width:220px">${orderHtml}</td><td style="white-space:normal;min-width:230px"><b>${statusLabel}</b>${c.warning_message?`<br><small>التحذير: ${escapeHtml(c.warning_message)}</small>`:''}<br><button type="button" onclick="toggleCustomerVerified('${c.id}',${!c.is_verified})">${c.is_verified?'إلغاء التوثيق':'توثيق ✔'}</button> <button type="button" onclick="warnCustomer('${c.id}')">تحذير</button><br><button type="button" onclick="setCustomerStatus('${c.id}','${status==='suspended'?'active':'suspended'}')">${status==='suspended'?'إعادة تفعيل':'إيقاف مؤقت'}</button> <button type="button" onclick="setCustomerStatus('${c.id}','${status==='banned'?'active':'banned'}')">${status==='banned'?'رفع الحظر':'حظر'}</button></td></tr>`;
    }).join('')||'<tr><td colspan="6">لا يوجد عملاء مسجلون حتى الآن.</td></tr>';
    say('customersMsg','تم تحميل العملاء وطلباتهم وحالة الحسابات.','info');
  }

  async function loadCustomerActivity(){
    const el=$('activityRows'); if(!el)return;
    const {data,error}=await sb.from('customer_activity').select('id,user_id,activity_name,created_at').order('created_at',{ascending:false}).limit(100);
    if(error){el.innerHTML=`<tr><td colspan="3">${escapeHtml(error.message)} — تأكد من تشغيل تحديث SQL.</td></tr>`;return;}
    const ids=[...new Set((data||[]).map(a=>a.user_id))];
    const {data:profiles}=ids.length?await sb.from('profiles').select('id,full_name,email').in('id',ids):{data:[]};
    const byId=new Map((profiles||[]).map(p=>[p.id,p]));
    const labels={login:'تسجيل دخول',order_created:'إنشاء طلب',profile_view:'فتح الحساب'};
    el.innerHTML=(data||[]).map(a=>{const p=byId.get(a.user_id)||{};return `<tr><td>${escapeHtml(p.full_name||p.email||a.user_id)}</td><td>${escapeHtml(labels[a.activity_name]||a.activity_name)}</td><td>${a.created_at?new Date(a.created_at).toLocaleString('ar-EG'):'—'}</td></tr>`}).join('')||'<tr><td colspan="3">لا يوجد نشاط مسجل بعد.</td></tr>';
  }

  window.toggleCustomerVerified=async(id,value)=>{const {error}=await sb.from('profiles').update({is_verified:value}).eq('id',id);if(error)return alert('تعذر تحديث التوثيق: '+error.message);await loadCustomers();};
  window.warnCustomer=async(id)=>{const reason=prompt('اكتب سبب التحذير الذي سيظهر في سجل الحساب:');if(reason===null)return;if(!reason.trim())return alert('اكتب سبب التحذير.');const {error}=await sb.from('profiles').update({account_status:'warned',warning_message:reason.trim()}).eq('id',id);if(error)return alert('تعذر تحذير الحساب: '+error.message);await loadCustomers();};
  window.setCustomerStatus=async(id,status)=>{const labels={active:'إعادة تفعيل',suspended:'إيقاف مؤقت',banned:'حظر'};if(!confirm(`تأكيد ${labels[status]||status} هذا الحساب؟`))return;const {error}=await sb.from('profiles').update({account_status:status}).eq('id',id);if(error)return alert('تعذر تحديث حالة الحساب: '+error.message);await loadCustomers();};

  async function loadPaymentMethods(){const {data,error}=await sb.from('payment_methods').select('*').order('sort_order');$('paymentMethodsRows').innerHTML=error?`<tr><td colspan="4">${escapeHtml(error.message)}</td></tr>`:(data||[]).map(m=>`<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.account_number)}<br>${escapeHtml(m.account_name||'')}</td><td>${m.is_active?'نعم':'لا'}</td><td><button type="button" onclick="editPaymentMethod('${m.id}')">تعديل</button> <button type="button" onclick="deletePaymentMethod('${m.id}')">حذف</button></td></tr>`).join('')||'<tr><td colspan="4">لم تضف وسائل دفع بعد.</td></tr>';}

  async function loadFaqs() {
    const {data,error}=await sb.from('faqs').select('*').order('sort_order').order('created_at',{ascending:false});
    $('faqsRows').innerHTML=error?`<tr><td colspan=4>${escapeHtml(error.message)}</td></tr>`:(data||[]).map(f=>`<tr><td>${escapeHtml(f.question)}</td><td style="white-space:normal;min-width:220px">${escapeHtml(f.answer)}</td><td>${f.is_active?'نعم':'لا'}</td><td><button type="button" onclick="editFaq('${f.id}')">تعديل</button> <button type="button" onclick="deleteFaq('${f.id}')">حذف</button></td></tr>`).join('')||'<tr><td colspan=4>لا توجد أسئلة.</td></tr>';
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
    $('refreshCustomers')?.addEventListener('click', loadCustomers);
    $('refreshActivity')?.addEventListener('click', loadCustomerActivity);
    $('clearForm').addEventListener('click', () => { $('productForm').reset(); $('pid').value = ''; $('pactive').checked = true; $('imagePreview').innerHTML=''; $('imageUploadMsg').textContent='اختر صورة وسيتم رفعها تلقائيًا إلى تخزين Supabase.'; });
    $('addProductNew').addEventListener('click', () => { $('productForm').reset(); $('pid').value=''; $('pactive').checked=true; $('imagePreview').innerHTML=''; $('imageUploadMsg').textContent='اختر صورة وسيتم رفعها تلقائيًا إلى تخزين Supabase.'; $('productForm').scrollIntoView({behavior:'smooth',block:'center'}); $('pname').focus({preventScroll:true}); });

    $('pimageFile').addEventListener('change', async () => {
      const file=$('pimageFile').files?.[0]; if(!file)return;
      if(!file.type.startsWith('image/')){say('imageUploadMsg','اختر ملف صورة صالحًا.','error');return;}
      if(file.size>5*1024*1024){say('imageUploadMsg','حجم الصورة يجب ألا يتجاوز 5 ميجابايت.','error');return;}
      say('imageUploadMsg','جارٍ رفع الصورة...');
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
      const path=`products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const {error}=await sb.storage.from('product-images').upload(path,file,{upsert:false,contentType:file.type});
      if(error){say('imageUploadMsg','فشل رفع الصورة: '+error.message,'error');return;}
      const {data}=sb.storage.from('product-images').getPublicUrl(path); $('pimage').value=data.publicUrl;
      $('imagePreview').innerHTML=`<img src="${escapeHtml(data.publicUrl)}" alt="معاينة" style="max-width:180px;max-height:130px;border-radius:12px">`;
      say('imageUploadMsg','تم رفع الصورة بنجاح.');
    });

    $('paymentMethodForm').addEventListener('submit',async e=>{e.preventDefault();const id=$('pmId').value;const row={name:$('pmName').value.trim(),account_number:$('pmNumber').value.trim(),account_name:$('pmOwner').value.trim(),instructions:$('pmInstructions').value.trim(),is_active:$('pmActive').checked};const {error}=id?await sb.from('payment_methods').update(row).eq('id',id):await sb.from('payment_methods').insert(row);if(error){alert('تعذر حفظ وسيلة الدفع: '+error.message);return;} $('paymentMethodForm').reset();$('pmId').value='';$('pmActive').checked=true;loadPaymentMethods();});
    $('pmClear').addEventListener('click',()=>{$('paymentMethodForm').reset();$('pmId').value='';$('pmActive').checked=true;});
    window.editPaymentMethod=async id=>{const {data,error}=await sb.from('payment_methods').select('*').eq('id',id).single();if(error)return alert(error.message);$('pmId').value=data.id;$('pmName').value=data.name;$('pmNumber').value=data.account_number;$('pmOwner').value=data.account_name||'';$('pmInstructions').value=data.instructions||'';$('pmActive').checked=data.is_active;};
    window.deletePaymentMethod=async id=>{if(!confirm('حذف وسيلة الدفع؟'))return;const {error}=await sb.from('payment_methods').delete().eq('id',id);if(error)alert(error.message);else loadPaymentMethods();};
    window.setPaymentStatus=async(id,payment_status)=>{const row={payment_status};if(payment_status==='payment_confirmed')row.status='payment_confirmed';if(payment_status==='payment_rejected')row.status='payment_rejected';const {error}=await sb.from('orders').update(row).eq('id',id);if(error)alert(error.message);else loadOrders();};
    window.saveOrderNote=async(id,admin_note)=>{const {error}=await sb.from('orders').update({admin_note}).eq('id',id);if(error)alert(error.message);};

    $('faqForm').addEventListener('submit',async e=>{e.preventDefault();const id=$('faqId').value;const row={question:$('faqQuestion').value.trim(),answer:$('faqAnswer').value.trim(),is_active:$('faqActive').checked};const {error}=id?await sb.from('faqs').update(row).eq('id',id):await sb.from('faqs').insert(row);if(error){alert('تعذر حفظ السؤال: '+error.message);return;} $('faqForm').reset();$('faqId').value='';$('faqActive').checked=true;await loadFaqs();});
    $('clearFaq').addEventListener('click',()=>{$('faqForm').reset();$('faqId').value='';$('faqActive').checked=true;});
    window.editFaq=async id=>{const {data,error}=await sb.from('faqs').select('*').eq('id',id).single();if(error)return alert(error.message);$('faqId').value=data.id;$('faqQuestion').value=data.question;$('faqAnswer').value=data.answer;$('faqActive').checked=data.is_active;window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});};
    window.deleteFaq=async id=>{if(!confirm('حذف السؤال؟'))return;const {error}=await sb.from('faqs').delete().eq('id',id);if(error)alert(error.message);else loadFaqs();};

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
    window.setOrderStatus = async (id, status) => { const { error } = await sb.from('orders').update({ status }).eq('id', id); if (error) alert('تعذر تحديث حالة الطلب: ' + error.message); };

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
