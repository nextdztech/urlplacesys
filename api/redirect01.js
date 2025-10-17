const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    try {
        // استخراج الكود من المسار
        const segments = req.url.split('/');
        const shortCode = segments[segments.length - 1];
        
        console.log('Processing redirect for code:', shortCode);
        console.log('Full path:', req.url);

        if (!shortCode || shortCode.length < 3) {
            console.log('Invalid short code length');
            res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(404).send('Short code invalid');
        }

        // البحث في قاعدة البيانات
        const { data: link, error } = await supabase
            .from('links')
            .select('*')
            .eq('short_code', shortCode)
            .single();

        if (error) {
            console.log('Database error:', error);
            res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(404).send('Link not found - ' + error.message);
        }

        if (!link) {
            console.log('No link found for code:', shortCode);
            res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(404).send('Link not found');
        }

        console.log('Found link:', link);

        // تحديث عدد الزيارات
        const { error: updateError } = await supabase
            .from('links')
            .update({ 
                visit_count: (link.visit_count || 0) + 1 
            })
            .eq('id', link.id);

        if (updateError) {
            console.log('Error updating visit count:', updateError);
        }

        // إعادة التوجيه
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.redirect(301, link.destination_url);

    } catch (error) {
        console.error('Redirect function error:', error);
        res.setHeader('Access-Control-Allow-Origin', '*');
return res.status(500).send('Server error: ' + error.message);    }
};