const multer = require('multer');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route not found.' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'The PDF must be 50 MB or smaller.'
      : 'The upload could not be processed.';
    return res.status(400).json({ error: message });
  }

  const status = Number.isInteger(error.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
  if (status >= 500) {
    console.error(JSON.stringify({
      level: 'error',
      requestId: req.id,
      message: error.message,
      stack: error.stack
    }));
  }

  return res.status(status).json({
    error: status >= 500 ? 'An internal server error occurred.' : error.message,
    request_id: req.id
  });
}

module.exports = { HttpError, asyncHandler, notFoundHandler, errorHandler };

