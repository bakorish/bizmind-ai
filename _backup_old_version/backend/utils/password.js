const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

// Hash password
const hashPassword = async (password) => {
    try {
        const salt = await bcrypt.genSalt(SALT_ROUNDS);
        const hash = await bcrypt.hash(password, salt);
        return hash;
    } catch (error) {
        throw new Error('Error hashing password');
    }
};

// Compare password with hash
const comparePassword = async (password, hash) => {
    try {
        return await bcrypt.compare(password, hash);
    } catch (error) {
        throw new Error('Error comparing password');
    }
};

module.exports = {
    hashPassword,
    comparePassword,
};