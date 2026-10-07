const businessService = require('../services/business.service');

class BusinessController {
    async getMyBusiness(req, res, next) {
        try {
            const business = await businessService.getBusiness(req.user.id);
            res.status(200).json({
                success: true,
                data: business,
            });
        } catch (error) {
            next(error);
        }
    }

    async updateMyBusiness(req, res, next) {
        try {
            const { businessName, businessType, currency, address, city, country } = req.body;
            const business = await businessService.updateBusiness(req.user.id, {
                businessName, businessType, currency, address, city, country,
            });
            res.status(200).json({
                success: true,
                message: 'Business updated successfully',
                data: business,
            });
        } catch (error) {
            next(error);
        }
    }

    async getStats(req, res, next) {
        try {
            const stats = await businessService.getStats(req.user.id);
            res.status(200).json({
                success: true,
                data: stats,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new BusinessController();