require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const router = express.Router();

// POST /api/payments/intent
router.post('/intent', async (req, res) => {
    const { amount, currency = 'USD', description } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Monto inválido' });
    }

    try {
        const response = await fetch('https://api.onvopay.com/v1/payment-intents', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.ONVO_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100), // cents
                currency: currency.toUpperCase(),
                description: description || 'Compra en Adrian Portilla Tattoo Store'
            })
        });

        if (!response.ok) {
            const err = await response.json();
            return res.status(response.status).json({ error: err.message || 'Error creando payment intent' });
        }

        const data = await response.json();
        res.json({
            paymentIntentId: data.id || data.paymentIntentId,
            publicKey: process.env.ONVO_PUBLIC_KEY
        });
    } catch (err) {
        console.error('ONVO error:', err);
        res.status(500).json({ error: 'Error procesando pago' });
    }
});

module.exports = router;
