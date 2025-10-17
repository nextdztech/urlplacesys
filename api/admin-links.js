const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// التحقق من صحة الكود
function validateCode(code) {
    const codeRegex = /^[a-zA-Z0-9]{3,25}$/;
    return codeRegex.test(code);
}

module.exports = async (req, res) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const method = req.method;
        const { id } = req.query || {};

        // GET: جلب جميع الروابط مع الإحصائيات
        if (method === 'GET') {
            const { data: links, error: linksError } = await supabase
                .from('links')
                .select('*')
                .order('created_at', { ascending: false });

            if (linksError) {
                return res.status(500).json({ error: 'Database error' });
            }

            // حساب الإحصائيات
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            const stats = {
                totalLinks: links.length,
                totalVisits: links.reduce((sum, link) => sum + (link.visit_count || 0), 0),
                todayLinks: links.filter(link => new Date(link.created_at) >= todayStart).length,
                activeLinks: links.filter(link => (link.visit_count || 0) > 0).length
            };

            return res.status(200).json({ links, stats });

        }

        // POST: إنشاء رابط جديد
        if (method === 'POST') {
            const { shortCode, destinationUrl } = JSON.parse(req.body);

            // التحقق من البيانات
            if (!validateCode(shortCode)) {
                return res.status(400).json({ error: 'Invalid short code' });
            }

            try {
                new URL(destinationUrl);
            } catch {
                return res.status(400).json({ error: 'Invalid URL' });

            }

            // التحقق من وجود الكود
            const { data: existing } = await supabase
                .from('links')
                .select('id')
                .eq('short_code', shortCode)
                .single();

            if (existing) {
                return res.status(400).json({ error: 'Short code already exists' });

            }

            // إنشاء الرابط
            const { error } = await supabase
                .from('links')
                .insert({
                    short_code: shortCode,
                    destination_url: destinationUrl,
                    created_by: 'admin'
                });

            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }

            return res.status(201).json({ success: true });

        }

        // PUT: تحديث رابط موجود
        if (method === 'PUT') {
            if (!id) {
                return res.status(400).json({ error: 'Link ID required' });

            }

            const { shortCode, destinationUrl } = JSON.parse(req.body);

            // التحقق من البيانات
            if (!validateCode(shortCode)) {
                return res.status(400).json({ error: 'Invalid short code' });
            }

            try {
                new URL(destinationUrl);
            } catch {
                return res.status(400).json({ error: 'Invalid URL' });

            }

            // التحقق من تفرد الكود (إلا إذا كان نفس الرابط)
            const { data: existing } = await supabase
                .from('links')
                .select('id')
                .eq('short_code', shortCode)
                .neq('id', id)
                .single();

            if (existing) {
                return res.status(400).json({ error: 'Short code already exists' });

            }

            // تحديث الرابط
            const { error } = await supabase
                .from('links')
                .update({
                    short_code: shortCode,
                    destination_url: destinationUrl,
                    updated_at: new Date()
                })
                .eq('id', id);

            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }

            return res.status(200).json({ success: true });
        }

        // DELETE: حذف رابط
        if (method === 'DELETE') {
            if (!id) {
                return res.status(400).json({ error: 'Link ID required' });

            }

            const { error } = await supabase
                .from('links')
                .delete()
                .eq('id', id);

            if (error) {
                return res.status(500).json({ error: 'Database error' });
            }

            return res.status(200).json({ success: true });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Admin Links API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};