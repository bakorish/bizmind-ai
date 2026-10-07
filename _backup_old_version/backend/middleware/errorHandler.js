const notFound = (req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.originalUrl}`,
    });
};

const errorHandler = (err, req, res, next) => {
    console.error('Error:', err.message);

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    if (err.code === '23505') {
        statusCode = 400;
        message = 'Duplicate entry. Record already exists.';
    }
    if (err.code === '23503') {
        statusCode = 400;
        message = 'Referenced record does not exist.';
    }
    if (err.code === '23502') {
        statusCode = 400;
        message = 'Required field missing.';
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
};

module.exports = { notFound, errorHandler };