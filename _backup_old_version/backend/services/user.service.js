const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');

class UserService {
    async getProfile(userId) {
        const result = await db.query(
            `SELECT id, email, first_name, last_name, phone, role, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            throw Object.assign(new Error('User not found'), { statusCode: 404 });
        }

        const user = result.rows[0];
        return {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            role: user.role,
            isActive: user.is_active,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
        };
    }

    async updateProfile(userId, updateData) {
        const { firstName, lastName, phone } = updateData;
        const fields = [];
        const values = [];
        let paramCount = 1;

        if (firstName !== undefined) {
            fields.push(`first_name = $${paramCount++}`);
            values.push(firstName);
        }
        if (lastName !== undefined) {
            fields.push(`last_name = $${paramCount++}`);
            values.push(lastName);
        }
        if (phone !== undefined) {
            fields.push(`phone = $${paramCount++}`);
            values.push(phone);
        }

        if (fields.length === 0) {
            throw Object.assign(new Error('No fields to update'), { statusCode: 400 });
        }

        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId);

        const query = `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING id, email, first_name, last_name, phone, role`;

        const result = await db.query(query, values);
        const user = result.rows[0];

        return {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phone: user.phone,
            role: user.role,
        };
    }

    async changePassword(userId, currentPassword, newPassword) {
        const result = await db.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            throw Object.assign(new Error('User not found'), { statusCode: 404 });
        }

        const isValid = await comparePassword(currentPassword, result.rows[0].password_hash);
        if (!isValid) {
            throw Object.assign(new Error('Current password is incorrect'), { statusCode: 400 });
        }

        const newHash = await hashPassword(newPassword);
        await db.query(
            'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [newHash, userId]
        );

        return { message: 'Password updated successfully' };
    }
}

module.exports = new UserService();