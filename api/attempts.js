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

// التحقق من محاولات العميل بدون زيادة العدد
async function getCustomerAttempts(ip) {
    const now = new Date();
    
    // البحث عن سجل المحاولات للـ IP
    const { data: attempt } = await supabase
        .from('customer_attempts')
        .select('*')
        .eq('ip_address', ip)
        .single();

    if (!attempt) {
        return { remaining: 10 };
    }

    // التحقق من انتهاء فترة الـ 8 ساعات
    if (new Date(attempt.reset_time) <= now) {
        // إعادة تعيين المحاولات
        await supabase
            .from('customer_attempts')
            .update({
                attempt_count: 0,
                last_attempt: now,
                reset_time: new Date(now.getTime() + 8 * 60 * 60 * 1000)
            })
            .eq('ip_address', ip);
        return { remaining: 10 };
    }

    return { remaining: Math.max(0, 10 - attempt.attempt_count) };
}

module.exports = async (req, res) => {
    // تعيين headers للـ CORS
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // معالجة طلبات OPTIONS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const ip = getClientIP(event);
        const attemptsInfo = await getCustomerAttempts(ip);

        return res.status(200).json(attemptsInfo);

    } catch (error) {
        console.error('Attempts API Error:', error);
        return res.status(500).json({ error: 'Internal server error', remaining: 10 });
    }
};