/**
 * Internal API Authentication Middleware
 *
 * Validates service-to-service requests using HMAC-SHA256 signatures
 * with timestamp to prevent replay attacks.
 *
 * Required headers:
 * - X-Internal-Timestamp: Unix timestamp in milliseconds
 * - X-Internal-Signature: HMAC-SHA256 signature
 * - X-Internal-Service: Service name (for logging)
 *
 * Signature payload: `${method}:${path}:${timestamp}`
 */

const crypto = require('crypto');

// Configuration
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET;
const MAX_TIMESTAMP_DIFF_MS = 5 * 60 * 1000; // 5 minutes tolerance

/**
 * Generate HMAC-SHA256 signature
 * @param {string} payload - The payload to sign
 * @param {string} secret - The secret key
 * @returns {string} Hex-encoded signature
 */
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verify HMAC signature with timing-safe comparison
 * @param {string} providedSignature - The signature from the request
 * @param {string} expectedSignature - The computed signature
 * @returns {boolean} True if signatures match
 */
function verifySignature(providedSignature, expectedSignature) {
  if (!providedSignature || !expectedSignature) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const provided = Buffer.from(providedSignature, 'hex');
    const expected = Buffer.from(expectedSignature, 'hex');

    if (provided.length !== expected.length) {
      return false;
    }

    return crypto.timingSafeEqual(provided, expected);
  } catch (error) {
    return false;
  }
}

/**
 * Middleware to validate internal API requests
 *
 * TEMPORARY: HMAC validation disabled - only checks for X-Internal-Service header
 * TODO: Re-enable HMAC validation after debugging
 */
function validateInternalRequest(req, res, next) {
  const service = req.headers['x-internal-service'];

  // Simple check: just require the X-Internal-Service header
  if (!service) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing X-Internal-Service header'
    });
  }

  console.log(`[Internal API] Request from ${service} - ${req.method} ${req.path}`);
  next();
}

module.exports = {
  validateInternalRequest,
  generateSignature,
  verifySignature
};
