require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// GET /api/admin/stats
router.get('/stats', requireAdmin, async (req, res) => {
    try {
        const galleryCount = await db.galleryImage.count({ where: { active: true } });
        const productCount = await db.product.count({ where: { active: true } });
        // We could also count recent contact requests if we had a ContactRequest model, 
        // but for now let's just do these two.

        res.json({
            galleryCount,
            productCount,
            recentActivity: [] // placeholder for now
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

module.exports = router;
