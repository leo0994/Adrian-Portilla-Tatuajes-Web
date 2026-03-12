require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const galleryRoutes = require('./routes/gallery');
const productsRoutes = require('./routes/products');
const contactRoutes = require('./routes/contact');
const paymentsRoutes = require('./routes/payments');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');


const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: ['http://localhost:4321', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/gallery', galleryRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);


app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
    console.log(`🚀 Adrian Portilla API running on http://localhost:${PORT}`);
});
