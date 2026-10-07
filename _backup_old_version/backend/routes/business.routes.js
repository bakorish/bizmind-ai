const express = require('express');
const router = express.Router();
const businessController = require('../controllers/business.controller');
const { protect } = require('../middleware/auth');
const { businessValidation, checkValidation } = require('../utils/validators');

router.get('/me', protect, businessController.getMyBusiness);
router.put('/me', protect, businessValidation, checkValidation, businessController.updateMyBusiness);
router.get('/stats', protect, businessController.getStats);

module.exports = router;