require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /api/payments/intent
// El total se calcula 100% server-side a partir de los productos y cantidades
// enviados por el cliente. Nunca se confía en un "amount" venido del frontend,
// para evitar que alguien manipule el precio del checkout.
router.post('/intent', async (req, res) => {
    const { items, currency = 'USD', description } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'El carrito está vacío o es inválido' });
    }

    // Normalizar y validar items: [{ id, qty }]
    const parsedItems = items.map(i => ({
        id: Number(i.id),
        qty: Number(i.qty)
    }));

    if (parsedItems.some(i => !Number.isInteger(i.id) || !Number.isInteger(i.qty) || i.qty <= 0)) {
        return res.status(400).json({ error: 'Items del carrito inválidos' });
    }

    try {
        const ids = parsedItems.map(i => i.id);
        const products = await db.product.findMany({
            where: { id: { in: ids }, active: true }
        });

        const productMap = new Map(products.map(p => [p.id, p]));

        let amount = 0;
        for (const item of parsedItems) {
            const product = productMap.get(item.id);
            if (!product) {
                return res.status(400).json({ error: `Producto ${item.id} no encontrado o no disponible` });
            }
            if (product.stock !== null && product.stock < item.qty) {
                return res.status(400).json({ error: `Stock insuficiente para "${product.name}"` });
            }
            amount += product.price * item.qty;
        }

        if (amount <= 0) {
            return res.status(400).json({ error: 'Monto inválido' });
        }

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
            publicKey: process.env.ONVO_PUBLIC_KEY,
            amount: Math.round(amount * 100) / 100,
            currency: currency.toUpperCase()
        });
    } catch (err) {
        console.error('ONVO error:', err);
        res.status(500).json({ error: 'Error procesando pago' });
    }
});

module.exports = router;
