const db = require('../config/db');
const { hashPassword, comparePassword } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt');

class AuthService {
  // Register new user
  async register(userData) {
    const { email, password, firstName, lastName, phone, businessName } = userData;
    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        throw Object.assign(new Error('User with this email already exists'), { statusCode: 400 });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Insert user
      const newUser = await client.query(
        `INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, email, first_name, last_name, phone, role, is_active, created_at`,
        [email, hashedPassword, firstName, lastName, phone || null, 'owner']
      );

      const user = newUser.rows[0];

      // Create business for user
      const businessNameValue = businessName || `${firstName}'s Business`;
      const newBusiness = await client.query(
        `INSERT INTO businesses (user_id, business_name, business_type, currency)
         VALUES ($1, $2, $3, $4)
         RETURNING id, business_name, business_type, currency`,
        [user.id, businessNameValue, 'retail', 'USD']
      );

      await client.query('COMMIT');

      // Generate tokens
      const tokenPayload = { id: user.id, email: user.email, role: user.role };
      const accessToken = generateAccessToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      return {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          phone: user.phone,
          role: user.role,
        },
        business: newBusiness.rows[0],
        accessToken,
        refreshToken,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Login user
  async login(email, password) {
    const result = await db.query(
      'SELECT id, email, password_hash, first_name, last_name, phone, role, is_active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      throw Object.assign(new Error('Account is deactivated'), { statusCode: 401 });
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw Object.assign(new Error('Invalid email or password'), { statusCode: 401 });
    }

    // Get business
    const businessResult = await db.query(
      'SELECT id, business_name, business_type, currency FROM businesses WHERE user_id = $1 LIMIT 1',
      [user.id]
    );

    const tokenPayload = { id: user.id, email: user.email, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
      },
      business: businessResult.rows[0] || null,
      accessToken,
      refreshToken,
    };
  }

  // Refresh token
  async refreshToken(refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      const result = await db.query(
        'SELECT id, email, role, is_active FROM users WHERE id = $1',
        [decoded.id]
      );

      if (result.rows.length === 0 || !result.rows[0].is_active) {
        throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
      }

      const user = result.rows[0];
      const tokenPayload = { id: user.id, email: user.email, role: user.role };
      const newAccessToken = generateAccessToken(tokenPayload);

      return { accessToken: newAccessToken };
    } catch (error) {
      throw Object.assign(new Error('Invalid or expired refresh token'), { statusCode: 401 });
    }
  }
}

module.exports = new AuthService();