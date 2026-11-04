(()=>{
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const say=(id,msg)=>{const el=$(id);if(el)el.textContent=msg};
const money=n=>Number(n||0).toLocaleString('ar-EG',{maximumFractionDigits:2});
let cart={},rows=[],methods=[],selected=null,user=null,total=0,missingPrices=false;
try{cart=JSON.parse(localStorage.getItem('alh-cart')||'{}');if(!cart||typeof cart!=='object'||Array.isArray(cart))cart={};}catch{cart={};}
rows=Object.entries(cart).filter(([,x])=>x&&Number(x.qty)>0);
missingPrices=rows.some(([,x])=>x.price===null||x.price===undefined||x.price==='');
total=rows.reduce((s,[,x])=>s+(Number(x.price)||0)*Number(x.qty),0);
$('summary').innerHTML=rows.length?rows.map(([id,x])=>`<div>${esc(x.name||'منتج')} × ${Number(x.qty)} — ${x.price===null||x.price===undefined||x.price===''?'السعر يؤكد من المؤسسة':money(Number(x.price)*Number(x.qty))+' جنيه'}</div>`).join(''):'السلة فارغة. <a href="products.html">تصفح المنتجات</a>';
$('total').textContent=missingPrices?'يوجد منتج بدون سعر؛ أضف السعر من لوحة التحكم قبل إرسال الطلب.':`الإجمالي: ${money(total)} جنيه`;
if(!rows.length){$('authBox').hidden=true;$('checkoutForm').hidden=true;say('authMsg','أضف منتجات إلى السلة أولًا.');}
if(missingPrices){$('checkoutForm').hidden=true;say('checkoutMsg','لا يمكن إرسال الطلب قبل تحديد أسعار جميع المنتجات.');}
function client(){if(!window.sb){say('authMsg','تعذر الاتصال بقاعدة البيانات. تأكد من إعداد Supabase ثم أعد تحميل الصفحة.');return null;}return window.sb;}
function showMethod(){if(!selected){$('methodDetails').hidden=true;return;} $('methodDetails').hidden=false;$('methodDetails').innerHTML=`<b>${esc(selected.name)}</b><br>بيانات التحويل: <strong>${esc(selected.account_number)}</strong><br>اسم الحساب: ${esc(selected.account_name||'—')}<br>${esc(selected.instructions||'حوّل المبلغ ثم ارفع صورة الإيصال.')}`;}
async function loadMethods(){const db=client();if(!db)return;const {data,error}=await db.from('payment_methods').select('id,name,account_name,account_number,instructions,sort_order').eq('is_active',true).order('sort_order');if(error){$('methods').textContent='تعذر تحميل وسائل الدفع: '+error.message;return;}methods=data||[];$('methods').innerHTML=methods.length?methods.map((m,i)=>`<label class="paychoice"><input type="radio" name="method" value="${esc(m.id)}" ${i===0?'checked':''}> <b>${esc(m.name)}</b></label>`).join(''):'لا توجد وسائل دفع مفعّلة حاليًا. تواصل مع المؤسسة.';selected=methods[0]||null;showMethod();$('checkoutForm').hidden=!selected||!rows.length||missingPrices;document.querySelectorAll('[name="method"]').forEach(r=>r.addEventListener('change',()=>{selected=methods.find(m=>m.id===r.value)||null;showMethod();}));}
async function refreshSession(){const db=client();if(!db)return;const {data,error}=await db.auth.getSession();if(error){say('authMsg','تعذر قراءة جلسة الدخول: '+error.message);return;}user=data.session?.user||null;if(user){$('authBox').hidden=true;$('paymentBox').hidden=false;if(!$('customerName').value)$('customerName').value=user.user_metadata?.full_name||user.user_metadata?.name||'';if(!$('customerPhone').value)$('customerPhone').value=user.user_metadata?.phone||'';await loadMethods();}else{$('authBox').hidden=false;$('paymentBox').hidden=true;const u=new URL(location.href);if(u.searchParams.get('auth')!=='shown'){u.searchParams.set('auth','shown');history.replaceState({},'',u);location.href='account.html?next='+encodeURIComponent('checkout.html');}}}
$('authForm').addEventListener('submit',async e=>{e.preventDefault();const db=client();if(!db)return;const btn=$('signup');btn.disabled=true;say('authMsg','جارٍ إنشاء الحساب…');try{const {data,error}=await db.auth.signUp({email:$('email').value.trim(),password:$('password').value,options:{data:{full_name:$('fullName').value.trim(),phone:$('phone').value.trim()}}});if(error)throw error;if(data.session){say('authMsg','تم إنشاء الحساب وتسجيل الدخول.');await refreshSession();}else{say('authMsg','تم إنشاء الحساب. أكّد بريدك الإلكتروني إذا طُلب منك، ثم سجّل الدخول.');}}catch(err){say('authMsg','تعذر إنشاء الحساب: '+(err.message||String(err)));}finally{btn.disabled=false;}});
$('signin').addEventListener('click',async()=>{const db=client();if(!db)return;const btn=$('signin');btn.disabled=true;say('authMsg','جارٍ تسجيل الدخول…');try{const {data,error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)throw error;say('authMsg','تم تسجيل الدخول بنجاح.');await refreshSession();}catch(err){say('authMsg','تعذر تسجيل الدخول: '+(err.message||String(err)));}finally{btn.disabled=false;}});
$('checkoutForm').addEventListener('submit',async e=>{
 e.preventDefault();const db=client();if(!db)return;
 if(!rows.length){say('checkoutMsg','السلة فارغة.');return;}
 if(!user){say('checkoutMsg','سجّل الدخول أولًا ثم أرسل الطلب.');return;}
 if(!selected){say('checkoutMsg','اختر وسيلة دفع مفعّلة أولًا.');return;}
 if(missingPrices){say('checkoutMsg','يوجد منتج بدون سعر. لا يمكن إرسال الطلب.');return;}
 const name=$('customerName').value.trim(),phone=$('customerPhone').value.trim(),file=$('receipt').files?.[0];
 if(!name||!phone){say('checkoutMsg','اكتب اسم العميل ورقم الهاتف.');return;}
 if(file&&file.size>5*1024*1024){say('checkoutMsg','حجم الملف أكبر من 5 ميجابايت.');return;}
 if(file&&!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type)){say('checkoutMsg','نوع الملف غير مدعوم. استخدم JPG أو PNG أو WEBP أو PDF.');return;}
 const btn=$('placeOrder');btn.disabled=true;btn.textContent='جارٍ إرسال الطلب…';
 let uploadedPath=null;
 try{
  if(file){say('checkoutMsg','جارٍ رفع إثبات التحويل…');const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';uploadedPath=`${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;const up=await db.storage.from('payment-receipts').upload(uploadedPath,file,{contentType:file.type,upsert:false});if(up.error)throw new Error('فشل رفع إثبات التحويل: '+up.error.message);}
  const items=rows.map(([id,x])=>({product_id:id,name:String(x.name||'منتج'),quantity:Number(x.qty),unit:String(x.unit||'قطعة'),unit_price:Number(x.price)}));
  const payload={user_id:user.id,customer_name:name,phone,items,total_amount:total,payment_method_id:selected.id,payment_method_name:selected.name,payment_reference:$('reference').value.trim()||null,receipt_path:uploadedPath,notes:$('notes').value.trim(),status:'pending_review',payment_status:'pending_review'};
  say('checkoutMsg','جارٍ حفظ الطلب…');
  const {data,error}=await db.from('orders').insert(payload).select('id,tracking_code').single();
  if(error)throw new Error('تعذر حفظ الطلب: '+error.message);
  localStorage.removeItem('alh-cart');rows=[];
  $('summary').innerHTML='تم تسجيل الطلب بنجاح.';$('total').textContent='';
  $('checkoutForm').reset();$('checkoutForm').hidden=true;
  $('checkoutMsg').innerHTML=`تم استلام طلبك بنجاح، وحالته <b>قيد المراجعة</b>. رقم التتبع: <b>${esc(data.tracking_code||data.id)}</b>. <a href="my-orders.html">انتقل إلى طلباتي لمتابعة الحالة${uploadedPath?'':' ورفع إثبات التحويل'}</a>.`;
 }catch(err){say('checkoutMsg','لم يتم إرسال الطلب. '+(err.message||String(err)));}
 finally{btn.disabled=false;btn.textContent='إرسال الطلب';}
});
if(window.sb){refreshSession();window.sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'||event==='TOKEN_REFRESHED')setTimeout(refreshSession,0);});}else{say('authMsg','تعذر الاتصال بقاعدة البيانات. تحقق من إعدادات Supabase وملف supabase-client.js.');}
})();
