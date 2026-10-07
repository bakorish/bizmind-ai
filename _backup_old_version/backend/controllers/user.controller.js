const userService = require('../services/user.service');

class UserController {
    async getMe(req, res, next) {
        try {
            const user = await userService.getProfile(req.user.id);
            res.status(200).json({
                success: true,
                data: user,
            });
        } catch (error) {
            next(error);
        }
    }

    async updateMe(req, res, next) {
        try {
            const { firstName, lastName, phone } = req.body;
            const user = await userService.updateProfile(req.user.id, { firstName, lastName, phone });
            res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: user,
            });
        } catch (error) {
            next(error);
        }
    }

    async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword } = req.body;
            const result = await userService.changePassword(req.user.id, currentPassword, newPassword);
            res.status(200).json({
                success: true,
                message: result.message,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();