module.exports = async (req, res) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (req.method === 'OPTIONS') {
        return res.status(404).send('Not found');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { password } = JSON.parse(req.body);
        const adminPassword = process.env.ADMIN_PASSWORD || 'QRAdmin2025!';
        
        if (password === adminPassword) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(401).json({ success: false, error: 'Invalid password' });

        }
    } catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
};