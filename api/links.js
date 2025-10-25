const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function getClientIP(req) {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           '127.0.0.1';
}

async function checkCustomerAttempts(ip) {
    const now = new Date();
    
    const { data: attempts } = await supabase
        .from('customer_attempts')
        .select('*')
        .eq('ip_address', ip)
        .limit(1);

    const attempt = attempts && attempts.length > 0 ? attempts[0] : null;

    if (!attempt) {
        await supabase
            .from('customer_attempts')
            .insert({
                ip_address: ip,
                attempt_count: 1,
                last_attempt: now,
                reset_time: new Date(now.getTime() + 8 * 60 * 60 * 1000)
            });
        return { allowed: true, remaining: 9 };
    }

    if (new Date(attempt.reset_time) <= now) {
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

    if (attempt.attempt_count >= 10) {
        return { allowed: false, remaining: 0 };
    }

    await supabase
        .from('customer_attempts')
        .update({
            attempt_count: attempt.attempt_count + 1,
            last_attempt: now
        })
        .eq('ip_address', ip);

    return { allowed: true, remaining: 10 - attempt.attempt_count };
}

function validateCode(code) {
    const codeRegex = /^[a-zA-Z0-9]{3,25}$/;
    return codeRegex.test(code);
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const ip = getClientIP(req);
        const method = req.method;

        // POST: إنشاء أو تحديث رابط (للعملاء)
        if (method === 'POST') {
            const attemptCheck = await checkCustomerAttempts(ip);
            if (!attemptCheck.allowed) {
                return res.status(429).json({ 
                    error: 'Too many attempts',
                    remaining: attemptCheck.remaining
                });
            }

            const { shortCode, destinationUrl } = req.body;

            if (!validateCode(shortCode)) {
                return res.status(400).json({ 
                    error: 'Invalid short code',
                    remaining: attemptCheck.remaining
                });
            }

            try {
                new URL(destinationUrl);
            } catch {
                return res.status(400).json({ 
                    error: 'Invalid URL',
                    remaining: attemptCheck.remaining
                });
            }

            const { data: existingLinks } = await supabase
                .from('links')
                .select('*')
                .eq('short_code', shortCode)
                .limit(1);

            const existingLink = existingLinks && existingLinks.length > 0 ? existingLinks[0] : null;

            if (existingLink) {
                const { error } = await supabase
                    .from('links')
                    .update({ 
                        destination_url: destinationUrl,
                        updated_at: new Date()
                    })
                    .eq('short_code', shortCode);

                if (error) {
                    return res.status(500).json({ 
                        error: 'Database error',
                        remaining: attemptCheck.remaining
                    });
                }

                return res.status(200).json({ 
                    success: true,
                    action: 'updated',
                    shortCode,
                    remaining: attemptCheck.remaining
                });
            } else {
                const { error } = await supabase
                    .from('links')
                    .insert({
                        short_code: shortCode,
                        destination_url: destinationUrl,
                        created_by: 'customer'
                    });

                if (error) {
                    return res.status(500).json({ 
                        error: 'Database error',
                        remaining: attemptCheck.remaining
                    });
                }

                return res.status(201).json({ 
                    success: true,
                    action: 'created',
                    shortCode,
                    remaining: attemptCheck.remaining
                });
            }
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};