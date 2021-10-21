import * as AxiosLogger from 'axios-logger';

/**
 * Does not log at all.
 * @type {number}
 */
const LOG_LEVEL_NONE = 0;

/**
 * Logs responses having an HTTP error code and unsuccessful requests.
 * @type {number}
 */
const LOG_LEVEL_ERROR = 1 << 0;

/**
 * Logs every request and response, but only outputs HTTP method and URL (no request/response body data).
 * @type {number}
 */
const LOG_LEVEL_INFO = 1 << 1;

/**
 * Logs every request and response and outputs HTTP method, URL and request/response body data.
 * @type {number}
 */
const LOG_LEVEL_DEBUG = 1 << 2;

let logLevel = LOG_LEVEL_NONE;

const activateLogging = (level = LOG_LEVEL_INFO) => {
    logLevel = level;
};

const deactivateLogging = () => {
    logLevel = LOG_LEVEL_NONE;
};

const logRequest = request => {
    if (logLevel < LOG_LEVEL_INFO) {
        return request;
    }
    return AxiosLogger.requestLogger(request, getAxiosLoggerConfig());
};

const logResponse = response => {
    if (logLevel < LOG_LEVEL_INFO) {
        return response;
    }
    return AxiosLogger.responseLogger(response, getAxiosLoggerConfig());
};

const logError = error => {
    if (logLevel < LOG_LEVEL_ERROR) {
        return Promise.reject(error);
    }
    return AxiosLogger.errorLogger(error, getAxiosLoggerConfig());
};

const logMessage = (message, message2) => {
    if (logLevel >= LOG_LEVEL_INFO) {
        if (message2) {
            console.log('ChurchTools Client:', message, message2); //eslint-disable-line no-console
        } else {
            console.log('ChurchTools Client:', message); //eslint-disable-line no-console
        }
    }
};

const getAxiosLoggerConfig = () => {
    return {
        prefixText: 'ChurchToolsClient',
        data: logLevel >= LOG_LEVEL_DEBUG
    };
};

export {
    logRequest,
    logResponse,
    logError,
    logMessage,
    activateLogging,
    deactivateLogging,
    LOG_LEVEL_NONE,
    LOG_LEVEL_DEBUG,
    LOG_LEVEL_INFO,
    LOG_LEVEL_ERROR
};
