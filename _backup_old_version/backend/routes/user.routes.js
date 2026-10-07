const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth');
const { updateProfileValidation, changePasswordValidation, checkValidation } = require('../utils/validators');

router.get('/me', protect, userController.getMe);
router.put('/me', protect, updateProfileValidation, checkValidation, userController.updateMe);
router.put('/me/password', protect, changePasswordValidation, checkValidation, userController.changePassword);

module.exports = router;