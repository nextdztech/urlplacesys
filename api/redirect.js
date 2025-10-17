const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    try {
        const shortCode = req.url.split('/').pop();
        
        if (shortCode.length < 3) {
            return res.redirect(302, '/activate');
        }

        const { data, error } = await supabase
            .from('links')
            .select('id, destination_url, visit_count')
            .eq('short_code', shortCode)
            .limit(1);

        if (error) {
            return res.redirect(302, '/activate');
        }

        if (data.length === 0) {
            return res.redirect(302, '/activate');
        }

        const link = data[0];

        try {
            await supabase
                .from('links')
                .update({ visit_count: link.visit_count + 1 })
                .eq('id', link.id);
        } catch (updateError) {
            console.log('Update failed');
        }

        return res.redirect(301, link.destination_url);

    } catch (error) {
        return res.redirect(302, '/activate');
    }
};