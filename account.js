```javascript
(() => {
'use strict';

const $ = id => document.getElementById(id);
let mode = 'login';

const msg = t => $('msg').textContent = t;

const next = (() => {
    const p = new URLSearchParams(location.search).get('next') || 'products.html';
    return ['products.html','checkout.html','my-orders.html','index.html'].includes(p)
        ? p
        : 'products.html';
})();

function setMode(m) {
    mode = m;

    $('loginTab').classList.toggle('active', m === 'login');
    $('signupTab').classList.toggle('active', m === 'signup');

    $('nameWrap').hidden = m !== 'signup';
    $('fullName').required = m === 'signup';
    $('phone').required = m === 'signup';

    $('submitBtn').textContent =
        m === 'login' ? 'تسجيل الدخول' : 'إنشاء الحساب';

    $('password').autocomplete =
        m === 'login' ? 'current-password' : 'new-password';

    msg('');
}

async function checkCustomer(user) {
    const { data, error } = await sb
        .from('profiles')
        .select('account_status,is_verified,warning_message')
        .eq('id', user.id)
        .maybeSingle();

    if (error) throw error;

    if (data?.account_status === 'suspended') {
        await sb.auth.signOut();
        throw new Error('هذا الحساب موقوف مؤقتًا. تواصل مع إدارة المؤسسة.');
    }

    if (data?.account_status === 'banned') {
        await sb.auth.signOut();
        throw new Error('هذا الحساب محظور. يرجى التواصل مع إدارة المؤسسة.');
    }

    // تسجيل النشاط دون تعطيل تسجيل الدخول إذا فشل RPC
    try {
        const result = await sb.rpc('record_customer_activity', {
            activity_name: 'login'
        });

        if (result.error) {
            console.warn('تعذر تسجيل النشاط:', result.error.message);
        }
    } catch (activityError) {
        console.warn('تعذر تسجيل النشاط:', activityError);
    }

    return data || {};
}

async function session() {
    if (!window.sb) {
        msg('تعذر الاتصال بالخدمة. تأكد من إعداد Supabase.');
        return;
    }

    const { data, error } = await sb.auth.getSession();

    if (error) {
        msg(error.message);
        return;
    }

    if (data.session?.user) {
        try {
            await checkCustomer(data.session.user);

            $('accountForm').hidden = true;
            $('logout').hidden = false;

            msg('أنت مسجل الدخول بالفعل. جارٍ تحويلك…');

            setTimeout(() => location.href = next, 500);

        } catch (e) {
            msg(e.message || 'تعذر التحقق من الحساب.');
        }
    }
}

$('loginTab').onclick = () => setMode('login');
$('signupTab').onclick = () => setMode('signup');

$('accountForm').addEventListener('submit', async e => {
    e.preventDefault();

    if (!window.sb) {
        msg('تعذر الاتصال بقاعدة البيانات.');
        return;
    }

    const btn = $('submitBtn');
    btn.disabled = true;

    try {
        if (mode === 'signup') {
            const full_name = $('fullName').value.trim();
            const phone = $('phone').value.trim();

            if (!full_name || !phone) {
                throw new Error('اكتب الاسم ورقم الهاتف.');
            }

            const { data, error } = await sb.auth.signUp({
                email: $('email').value.trim(),
                password: $('password').value,
                options: {
                    data: { full_name, phone }
                }
            });

            if (error) throw error;

            if (!data.session) {
                msg('تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيد الحساب، ثم سجّل الدخول.');
                setMode('login');
                return;
            }

            await checkCustomer(data.user);

            msg('تم إنشاء الحساب بنجاح.');
            location.href = next;

        } else {
            const { data, error } = await sb.auth.signInWithPassword({
                email: $('email').value.trim(),
                password: $('password').value
            });

            if (error) throw error;

            await checkCustomer(data.user);

            msg('تم تسجيل الدخول بنجاح.');
            location.href = next;
        }

    } catch (err) {
        msg('تعذر إكمال العملية: ' + (err.message || String(err)));

    } finally {
        btn.disabled = false;
    }
});

$('logout').onclick = async () => {
    await sb.auth.signOut();
    location.reload();
};

if (window.sb) {
    sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
            setTimeout(session, 0);
        }
    });

    session();

} else {
    msg('تعذر تحميل إعدادات Supabase.');
}

setMode('login');

})();
```
