require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const express = require('express');
const router = express.Router();
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const rateLimit = require('express-rate-limit');

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

// Endpoint público sin auth: limitar intentos para que no se use como
// relay de spam/phishing ni para agotar la cuota de Cloudinary/SMTP.
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Demasiadas solicitudes. Por favor intenta de nuevo en unos minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// El HTML del correo interpola estos campos directamente; hay que escaparlos
// para que un valor como "<img src=x onerror=...>" no se ejecute en el cliente de correo.
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// POST /api/contact
router.post('/', contactLimiter, upload.array('images', 5), async (req, res) => {
    const { name, email, phone, style, bodyPart, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: 'Nombre, email y mensaje son requeridos' });
    }

    if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Email inválido' });
    }

    const uploadedImages = [];
    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            try {
                const result = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        { 
                            folder: 'contact-requests', 
                            resource_type: 'image',
                            tags: ['contact', 'request'],
                            transformation: [
                                { quality: 'auto', fetch_format: 'auto' }
                            ]
                        },
                        (error, result) => error ? reject(error) : resolve(result)
                    ).end(file.buffer);
                });
                uploadedImages.push(result.secure_url);
            } catch (err) {
                console.error('Image upload error:', err);
            }
        }
    }

    console.log('📩 New contact request:', { name, email, phone, style, bodyPart, message, images: uploadedImages.length });

    try {
        const PDFDocument = require('pdfkit');
        const nodemailer = require('nodemailer');

        // Create PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));

        // Wait to finish writing
        const pdfPromise = new Promise((resolve) => {
            doc.on('end', () => resolve(Buffer.concat(buffers)));
        });

        // --- PDF Design ---
        const primaryColor = '#050505';
        const accentColor = '#dc2626';

        // Header
        doc.rect(0, 0, doc.page.width, 120).fill(primaryColor);
        doc.fillColor(accentColor).fontSize(28).font('Times-Bold').text('ADRIAN PORTILLA', 50, 40, { align: 'center', characterSpacing: 2 });
        doc.fillColor('#ffffff').fontSize(14).font('Helvetica').text('TATTOO APPOINTMENT REQUEST', 50, 75, { align: 'center', characterSpacing: 1 });

        // Body Background
        doc.rect(0, 120, doc.page.width, doc.page.height - 120).fill('#f9fafb');

        // Client Details Box
        const startY = 160;
        doc.rect(50, startY, doc.page.width - 100, 180).fill('#ffffff').stroke('#e5e7eb');

        doc.fillColor(accentColor).fontSize(16).font('Times-Bold').text('CLIENT DETAILS', 70, startY + 20);

        doc.fillColor('#4b5563').fontSize(11).font('Helvetica-Bold')
            .text('Name:', 70, startY + 50).font('Helvetica').fillColor('#111827').text(name, 150, startY + 50)
            .fillColor('#4b5563').font('Helvetica-Bold').text('Email:', 70, startY + 70).font('Helvetica').fillColor('#111827').text(email, 150, startY + 70)
            .fillColor('#4b5563').font('Helvetica-Bold').text('Phone:', 70, startY + 90).font('Helvetica').fillColor('#111827').text(phone || 'N/A', 150, startY + 90)
            .fillColor('#4b5563').font('Helvetica-Bold').text('Style:', 70, startY + 110).font('Helvetica').fillColor('#111827').text(style || 'N/A', 150, startY + 110)
            .fillColor('#4b5563').font('Helvetica-Bold').text('Placement:', 70, startY + 130).font('Helvetica').fillColor('#111827').text(bodyPart || 'N/A', 150, startY + 130);

        // Message Box
        let nextY = startY + 200;
        doc.fillColor(accentColor).fontSize(16).font('Times-Bold').text('IDEA DESCRIPTION', 50, nextY);
        nextY += 25;

        doc.fillColor('#111827').fontSize(11).font('Helvetica-Oblique').text(`"${message}"`, 50, nextY, {
            width: doc.page.width - 100,
            lineGap: 4
        });

        // Add fetched images buffers to PDF
        if (uploadedImages.length > 0) {
            nextY = doc.y + 40;
            if (nextY > doc.page.height - 150) { doc.addPage(); nextY = 50; }
            doc.fillColor(accentColor).fontSize(16).font('Times-Bold').text('REFERENCE IMAGES', 50, nextY);

            let imgX = 50;
            let imgY = nextY + 30;
            const imgWidth = 140;

            for (let i = 0; i < uploadedImages.length; i++) {
                try {
                    const fetch = (await import('node-fetch')).default;
                    const response = await fetch(uploadedImages[i]);
                    const imgBuffer = await response.buffer();

                    if (imgX + imgWidth > doc.page.width - 50) {
                        imgX = 50;
                        imgY += imgWidth + 20;
                    }
                    if (imgY + imgWidth > doc.page.height - 50) {
                        doc.addPage();
                        imgX = 50; imgY = 50;
                    }
                    doc.image(imgBuffer, imgX, imgY, { fit: [imgWidth, imgWidth], align: 'center', valign: 'center' });
                    imgX += imgWidth + 20;
                } catch (e) {
                    console.error("Failed to load image for PDF:", e);
                }
            }
        }

        doc.end();
        const pdfBuffer = await pdfPromise;

        // --- Send Email ---
        // Using ephemeral nodemailer ethereal account or standard SMTP structure.
        // Replace with realistic process.env later.

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for 587
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const mailOptions = {
            from: `"Adrian Portilla Studio" <${process.env.SMTP_USER}>`,
            to: email, // Correo del cliente
            bcc: process.env.SMTP_USER, // Copia oculta para el tatuador
            subject: `Tattoo Request Received - ${name}`,
            text: `Hi ${name},\n\nWe have received your tattoo request. Attached is the receipt of the information you provided.\n\nAdrian will review it and get back to you soon.\n\nBest regards,\nAdrian Portilla Studio`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #111; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                    <h2 style="color: #dc2626;">Hi ${escapeHtml(name)},</h2>
                    <p>We successfully received your tattoo request!</p>
                    <p>For your records, we have attached a beautiful PDF summary of the information and reference photos you shared with us.</p>
                    <p>Adrian will personally review your idea and get back to you within 24-48 hours to discuss the next steps.</p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 0.85em; color: #777;">Best regards,<br><strong>Adrian Portilla Tattoo Studio</strong></p>
                </div>
            `,
            attachments: [
                {
                    filename: `Tattoo_Request_${name.replace(/\s+/g, '_')}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        // Attempting to send (it will likely fail locally without credentials, but we log it gracefully)
        try {
            if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                await transporter.sendMail(mailOptions);
                console.log('📬 Email receipt sent successfully with PDF attached.');
            } else {
                console.log('⚠️ PDF Generated but SMTP is not fully configured (falta SMTP_USER/SMTP_PASS), skipping email dispatch.');
            }
        } catch (emailErr) {
            console.error('Email error:', emailErr);
        }

    } catch (pdfError) {
        console.error('PDF Generation Error:', pdfError);
    }

    res.json({
        success: true,
        message: 'Solicitud recibida correctamente',
        imagesUploaded: uploadedImages.length
    });
});

module.exports = router;
