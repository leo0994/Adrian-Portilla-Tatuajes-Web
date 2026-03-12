require('dotenv').config();
const cloudinary = require('cloudinary').v2;
const db = require('./db');
const fs = require('fs');
const path = require('path');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const mediaDir = 'C:\\Users\\leo\\.gemini\\antigravity\\brain\\1a83f7bf-c344-4f59-8841-92e5bef64781';
const imagesToUpload = [
    'media__1772760880449.png',
    'media__1772760880825.png',
    'media__1772760880923.png',
    'media__1772760880978.png',
    'media__1772760881049.png'
];

async function seed() {
    console.log('Starting seed process for gallery images...');
    try {
        for (const imgName of imagesToUpload) {
            const fullPath = path.join(mediaDir, imgName);
            if (!fs.existsSync(fullPath)) {
                console.log(`Skipping ${imgName}, file not found.`);
                continue;
            }

            console.log(`Uploading ${imgName}...`);
            const uploadResult = await cloudinary.uploader.upload(fullPath, {
                folder: 'gallery',
                resource_type: 'image'
            });

            console.log(`Saving to database: ${uploadResult.secure_url}`);
            await db.galleryImage.create({
                data: {
                    url: uploadResult.secure_url,
                    public_id: uploadResult.public_id,
                    active: true
                }
            });
            console.log(`Successfully saved ${imgName}.`);
        }
        console.log('All done!');
        process.exit(0);
    } catch (e) {
        console.error('Seed Error:', e);
        process.exit(1);
    }
}

seed();
