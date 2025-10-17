const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// دالة للحصول على IP الخاص بالعميل
function getClientIP(event) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           event.connection?.remoteAddress || 
           '127.0.0.1';
}

// التحقق من محاولات العميل
async function checkCustomerAttempts(ip) {
    const now = new Date();
    
    // البحث عن سجل المحاولات للـ IP
    const { data: attempt } = await supabase
        .from('customer_attempts')
        .select('*')
        .eq('ip_address', ip)
        .single();

    if (!attempt) {
        // إنشاء سجل جديد
        await supabase
            .from('customer_attempts')
            .insert({
                ip_address: ip,
                attempt_count: 1,
                last_attempt: now,
                reset_time: new Date(now.getTime() + 8 * 60 * 60 * 1000) // 8 ساعات
            });
        return { allowed: true, remaining: 9 };
    }

    // التحقق من انتهاء فترة الـ 8 ساعات
    if (new Date(attempt.reset_time) <= now) {
        // إعادة تعيين المحاولات
        await supabase
            .from('customer_attempts')
            .update({
                attempt_count: 1,
                last_attempt: now,
                reset_time: new Date(now.getTime() + 8 * 60 * 60 * 1000)
            })
            .eq('ip_address', ip);
        return { allowed: true, remaining: 9 };
    }

    // التحقق من عدد المحاولات
    if (attempt.attempt_count >= 10) {
        return { allowed: false, remaining: 0 };
    }

    // زيادة عدد المحاولات
    await supabase
        .from('customer_attempts')
        .update({
            attempt_count: attempt.attempt_count + 1,
            last_attempt: now
        })
        .eq('ip_address', ip);

    return { allowed: true, remaining: 10 - attempt.attempt_count };
}

// التحقق من صحة الكود
function validateCode(code) {
    const codeRegex = /^[a-zA-Z0-9]{3,25}$/;
    return codeRegex.test(code);
}

// دالة رئيسية للـ API
module.exports = async (req, res) => {
    // تعيين headers للـ CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    // معالجة طلبات OPTIONS
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(200).end();    }

    try {
        const ip = getClientIP(event);
        const path = req.url.replace('/api/links', '');
        const method = req.method;

// GET: جلب رابط أو إعادة توجيه
        if (method === 'GET') {
            const shortCode = path.substring(1) || req.query?.shortCode;

            if (!shortCode) {
                res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(400).json({ error: 'Short code required' });
            }

            // البحث عن الرابط
            const { data: link, error } = await supabase
                .from('links')
                .select('*')
                .eq('short_code', shortCode)
                .single();

            if (error || !link) {
                res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(404).json({ error: 'Link not found' });

            }

            // زيادة عدد الزيارات
            await supabase
                .from('links')
                .update({ visit_count: link.visit_count + 1 })
                .eq('id', link.id);

            // إعادة توجيه
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-cache');
return res.redirect(301, link.destination_url);
        }

        // POST: إنشاء أو تحديث رابط (للعملاء)
        if (method === 'POST') {
            // التحقق من المحاولات
            const attemptCheck = await checkCustomerAttempts(ip);
            if (!attemptCheck.allowed) {
                res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(429).json({ 
    error: 'Too many attempts',
    remaining: attemptCheck.remaining
});
            }

            const { shortCode, destinationUrl } = JSON.parse(req.body);

            // التحقق من البيانات
            if (!validateCode(shortCode)) {
                res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(400).json({ 
    error: 'Invalid short code',
    remaining: attemptCheck.remaining
});
            }

            try {
                new URL(destinationUrl);
            } catch {
                res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(400).json({ 
    error: 'Invalid URL',
    remaining: attemptCheck.remaining
});
            }

            // البحث عن رابط موجود
            const { data: existingLink } = await supabase
                .from('links')
                .select('*')
                .eq('short_code', shortCode)
                .single();

            if (existingLink) {
                // تحديث الرابط الموجود
                const { error } = await supabase
                    .from('links')
                    .update({ 
                        destination_url: destinationUrl,
                        updated_at: new Date()
                    })
                    .eq('short_code', shortCode);

                if (error) {
                    res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(500).json({ 
    error: 'Database error',
    remaining: attemptCheck.remaining
});
                }

                res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(200).json({ 
    success: true,
    action: 'updated',
    shortCode,
    remaining: attemptCheck.remaining
});
            } else {
                // إنشاء رابط جديد
                const { error } = await supabase
                    .from('links')
                    .insert({
                        short_code: shortCode,
                        destination_url: destinationUrl,
                        created_by: 'customer'
                    });

                if (error) {
                    res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(500).json({ 
    error: 'Database error',
    remaining: attemptCheck.remaining
});
                }

                res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(201).json({ 
    success: true,
    action: 'created',
    shortCode,
    remaining: attemptCheck.remaining
});
            }
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Error:', error);
        res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(500).json({ error: 'Internal server error' });    }
};