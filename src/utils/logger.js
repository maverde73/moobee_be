/**
 * Backend Logger Service
 * Professional logging system for Node.js backend
 * @module utils/logger
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Define log levels
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

/**
 * Define colors for each level
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'white',
  silly: 'gray'
};

// Tell winston about our colors
winston.addColors(colors);

/**
 * Format for console output
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} [${info.level}]: ${info.message}`
  )
);

/**
 * Format for file output
 */
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

/**
 * Create the logger instance
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: fileFormat,
  transports: [
    // Write all logs with level 'error' and below to error.log
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Write all logs with level 'info' and below to combined.log
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ],
  exitOnError: false
});

// If we're not in production, log to console too
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
      level: 'debug'
    })
  );
}

/**
 * Stream object for Morgan HTTP logging
 */
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

/**
 * Create child logger with metadata
 */
logger.child = (metadata) => {
  return logger.child(metadata);
};

/**
 * Log database queries (for debugging)
 */
logger.logQuery = (query, params) => {
  if (process.env.LOG_QUERIES === 'true') {
    logger.debug('Database Query', { query, params });
  }
};

/**
 * Log API requests
 */
logger.logRequest = (req, res, responseTime) => {
  const message = `${req.method} ${req.originalUrl}`;
  const meta = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };

  if (res.statusCode >= 500) {
    logger.error(message, meta);
  } else if (res.statusCode >= 400) {
    logger.warn(message, meta);
  } else {
    logger.http(message, meta);
  }
};

/**
 * Log errors with context
 */
logger.logError = (error, context = {}) => {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    ...context
  };

  logger.error('Application Error', errorInfo);
};

/**
 * Performance logging
 */
logger.startTimer = () => {
  return Date.now();
};

logger.endTimer = (startTime, operation) => {
  const duration = Date.now() - startTime;
  logger.verbose(`${operation} completed in ${duration}ms`);
  return duration;
};

/**
 * Audit logging for sensitive operations
 */
logger.audit = (action, userId, details = {}) => {
  const auditLog = {
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details
  };

  // Write to separate audit log file
  const auditTransport = new winston.transports.File({
    filename: path.join(logsDir, 'audit.log'),
    format: fileFormat
  });

  const auditLogger = winston.createLogger({
    transports: [auditTransport]
  });

  auditLogger.info('AUDIT', auditLog);
};

/**
 * Replace console methods in production
 */
if (process.env.NODE_ENV === 'production') {
  console.log = (...args) => logger.info(args.join(' '));
  console.error = (...args) => logger.error(args.join(' '));
  console.warn = (...args) => logger.warn(args.join(' '));
  console.debug = (...args) => logger.debug(args.join(' '));
}

module.exports = logger;