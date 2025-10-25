const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { data: deletedLinks, error } = await supabase
            .from('links')
            .delete()
            .lt('created_at', sixMonthsAgo.toISOString())
            .eq('visit_count', 0)
            .select();

        if (error) {
            return res.status(500).json({ error: 'Database error' });
        }

        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        await supabase
            .from('customer_attempts')
            .delete()
            .lt('reset_time', oneDayAgo.toISOString());

        return res.status(200).json({
            success: true,
            deletedCount: deletedLinks ? deletedLinks.length : 0
        });

    } catch (error) {
        console.error('Cleanup API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};