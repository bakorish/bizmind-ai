const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const businessRoutes = require('./business.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/business', businessRoutes);

router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'BizMind AI API is running',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;