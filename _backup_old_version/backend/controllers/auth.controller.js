const authService = require('../services/auth.service');

class AuthController {
    async register(req, res, next) {
        try {
            const { email, password, firstName, lastName, phone, businessName } = req.body;
            const result = await authService.register({
                email, password, firstName, lastName, phone, businessName,
            });

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await authService.login(email, password);

            res.status(200).json({
                success: true,
                message: 'Login successful',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    async refresh(req, res, next) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Refresh token is required',
                });
            }

            const result = await authService.refreshToken(refreshToken);

            res.status(200).json({
                success: true,
                message: 'Token refreshed',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    async logout(req, res) {
        res.status(200).json({
            success: true,
            message: 'Logout successful. Please remove token from client.',
        });
    }
}

module.exports = new AuthController();