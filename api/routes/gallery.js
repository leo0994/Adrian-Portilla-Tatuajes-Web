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
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/') || file.mimetype === 'image/svg+xml') {
            return cb(new Error('Solo se permiten archivos de imagen (no SVG)'));
        }
        cb(null, true);
    }
});

// GET /api/gallery
router.get('/', async (req, res) => {
    try {
        const images = await db.galleryImage.findMany({
            where: { active: true },
            orderBy: { created_at: 'desc' }
        });

        const formatted = images.map(img => ({
            publicId: img.public_id,
            url: img.url,
            id: typeof img.id === 'bigint' ? Number(img.id) : img.id
        }));

        res.json({ images: formatted });
    } catch (err) {
        console.error('Gallery fetch error:', err);
        res.status(500).json({ error: 'Error al obtener galería' });
    }
});

// POST /api/gallery (admin only)
router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No se proporcionó imagen' });

    try {
        const result = await new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream(
                { 
                    folder: 'gallery', 
                    resource_type: 'image',
                    tags: ['portfolio', 'gallery'],
                    transformation: [
                        { quality: 'auto', fetch_format: 'auto' }
                    ]
                },
                (error, result) => error ? reject(error) : resolve(result)
            ).end(req.file.buffer);
        });

        const imageRecord = await db.galleryImage.create({
            data: {
                url: result.secure_url,
                public_id: result.public_id,
                active: true
            }
        });

        res.json({
            id: typeof imageRecord.id === 'bigint' ? Number(imageRecord.id) : imageRecord.id,
            publicId: result.public_id,
            url: result.secure_url
        });
    } catch (err) {
        console.error('Gallery upload error detail:', err);
        res.status(500).json({ 
            error: 'Error al subir imagen a Cloudinary',
            details: err.message 
        });
    }
});

// DELETE /api/gallery/:publicId (admin only)
router.delete('/:publicId(*)', requireAdmin, async (req, res) => {
    try {
        // Find in DB first
        const image = await db.galleryImage.findFirst({
            where: { public_id: req.params.publicId }
        });

        if (image) {
            await db.galleryImage.update({
                where: { id: image.id },
                data: { active: false }
            });
        }

        // Technically could delete it from Cloudinary entirely:
        await cloudinary.uploader.destroy(req.params.publicId);

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error al eliminar imagen' });
    }
});

module.exports = router;
