/**
 * Logger utility with timestamps
 */

const getTimestamp = () => {
  const now = new Date();
  return now.toISOString();
};

const formatMessage = (level, message, data = null) => {
  const timestamp = getTimestamp();
  let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (data) {
    logMessage += ` ${JSON.stringify(data)}`;
  }
  
  return logMessage;
};

const logger = {
  info: (message, data = null) => {
    console.log(formatMessage('info', message, data));
  },
  
  warn: (message, data = null) => {
    console.warn(formatMessage('warn', message, data));
  },
  
  error: (message, data = null) => {
    console.error(formatMessage('error', message, data));
  },
  
  debug: (message, data = null) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatMessage('debug', message, data));
    }
  }
};

module.exports = logger;
