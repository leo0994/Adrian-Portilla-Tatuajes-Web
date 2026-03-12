require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/products
router.get('/', async (req, res) => {
    try {
        let products = await db.product.findMany({
            where: { active: true },
            orderBy: { created_at: 'desc' }
        });
        products = products.map(p => ({ ...p, id: typeof p.id === 'bigint' ? Number(p.id) : p.id }));
        res.json({ products });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error obteniendo productos' });
    }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
    try {
        const product = await db.product.findFirst({
            where: { id: Number(req.params.id), active: true }
        });
        if (!product) return res.status(404).json({ error: 'Producto no encontrado' });
        res.json({ product: { ...product, id: typeof product.id === 'bigint' ? Number(product.id) : product.id } });
    } catch (err) {
        return res.status(500).json({ error: 'Error obteniendo producto' });
    }
});

// POST /api/products (admin)
router.post('/', requireAdmin, upload.array('images', 5), async (req, res) => {
    const { name, description, price, currency = 'USD', stock = 0 } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Nombre y precio requeridos' });

    const imageUrls = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { folder: 'products', resource_type: 'image' },
                    (error, result) => error ? reject(error) : resolve(result)
                ).end(file.buffer);
            });
            imageUrls.push(result.secure_url);
        }
    }

    try {
        const product = await db.product.create({
            data: { name, description, price: parseFloat(price), currency, stock: parseInt(stock), images: imageUrls }
        });
        res.status(201).json({ product: { ...product, id: typeof product.id === 'bigint' ? Number(product.id) : product.id } });
    } catch (error) {
        console.error('Prisma Insert Error:', error);
        return res.status(500).json({ error: 'Error guardando producto' });
    }
});

// PUT /api/products/:id (admin)
router.put('/:id', requireAdmin, upload.array('newImages', 5), async (req, res) => {
    let product;
    try {
        product = await db.product.findUnique({ where: { id: Number(req.params.id) } });
    } catch (e) { }
    if (!product) return res.status(404).json({ error: 'Producto no encontrado' });

    const { name, description, price, currency, stock, existingImages } = req.body;
    let images = existingImages ? JSON.parse(existingImages) : product.images;

    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            const result = await new Promise((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    { folder: 'products', resource_type: 'image' },
                    (error, result) => error ? reject(error) : resolve(result)
                ).end(file.buffer);
            });
            images.push(result.secure_url);
        }
    }

    try {
        const updated = await db.product.update({
            where: { id: Number(req.params.id) },
            data: {
                name: name || product.name,
                description: description !== undefined ? description : product.description,
                price: price ? parseFloat(price) : product.price,
                currency: currency || product.currency,
                stock: stock !== undefined ? parseInt(stock) : product.stock,
                images: images
            }
        });
        res.json({ product: { ...updated, id: typeof updated.id === 'bigint' ? Number(updated.id) : updated.id } });
    } catch (error) {
        return res.status(500).json({ error: 'Error actualizando producto' });
    }
});

// DELETE /api/products/:id (admin)
router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await db.product.update({
            where: { id: Number(req.params.id) },
            data: { active: false }
        });
        res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ error: 'Error al eliminar producto' });
    }
});

module.exports = router;
