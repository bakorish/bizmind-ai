const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { registerValidation, loginValidation, checkValidation } = require('../utils/validators');
const { protect } = require('../middleware/auth');

router.post('/register', registerValidation, checkValidation, authController.register);
router.post('/login', loginValidation, checkValidation, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', protect, authController.logout);

module.exports = router;