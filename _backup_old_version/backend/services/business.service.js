const db = require('../config/db');

class BusinessService {
    async getBusiness(userId) {
        const result = await db.query(
            `SELECT id, business_name, business_type, currency, address, city, country, created_at, updated_at
       FROM businesses WHERE user_id = $1 LIMIT 1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const b = result.rows[0];
        return {
            id: b.id,
            businessName: b.business_name,
            businessType: b.business_type,
            currency: b.currency,
            address: b.address,
            city: b.city,
            country: b.country,
            createdAt: b.created_at,
            updatedAt: b.updated_at,
        };
    }

    async updateBusiness(userId, updateData) {
        const { businessName, businessType, currency, address, city, country } = updateData;
        const fields = [];
        const values = [];
        let paramCount = 1;

        if (businessName !== undefined) {
            fields.push(`business_name = $${paramCount++}`);
            values.push(businessName);
        }
        if (businessType !== undefined) {
            fields.push(`business_type = $${paramCount++}`);
            values.push(businessType);
        }
        if (currency !== undefined) {
            fields.push(`currency = $${paramCount++}`);
            values.push(currency);
        }
        if (address !== undefined) {
            fields.push(`address = $${paramCount++}`);
            values.push(address);
        }
        if (city !== undefined) {
            fields.push(`city = $${paramCount++}`);
            values.push(city);
        }
        if (country !== undefined) {
            fields.push(`country = $${paramCount++}`);
            values.push(country);
        }

        if (fields.length === 0) {
            throw Object.assign(new Error('No fields to update'), { statusCode: 400 });
        }

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);

        const query = `UPDATE businesses SET ${fields.join(', ')} WHERE user_id = $${paramCount} RETURNING *`;

        const result = await db.query(query, values);
        const b = result.rows[0];

        return {
            id: b.id,
            businessName: b.business_name,
            businessType: b.business_type,
            currency: b.currency,
            address: b.address,
            city: b.city,
            country: b.country,
        };
    }

    async getStats(userId) {
        const businessResult = await db.query(
            'SELECT id FROM businesses WHERE user_id = $1 LIMIT 1',
            [userId]
        );

        if (businessResult.rows.length === 0) {
            return null;
        }

        const businessId = businessResult.rows[0].id;

        const [productsCount, customersCount, ordersCount, revenueResult] = await Promise.all([
            db.query('SELECT COUNT(*) as count FROM products WHERE business_id = $1', [businessId]),
            db.query('SELECT COUNT(*) as count FROM customers WHERE business_id = $1', [businessId]),
            db.query('SELECT COUNT(*) as count FROM orders WHERE business_id = $1', [businessId]),
            db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE business_id = $1 AND status != $2', [businessId, 'cancelled']),
        ]);

        return {
            totalProducts: parseInt(productsCount.rows[0].count),
            totalCustomers: parseInt(customersCount.rows[0].count),
            totalOrders: parseInt(ordersCount.rows[0].count),
            totalRevenue: parseFloat(revenueResult.rows[0].total),
        };
    }
}

module.exports = new BusinessService();