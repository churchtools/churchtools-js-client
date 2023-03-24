import * as AxiosLogger from 'axios-logger';
import { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

enum LOG_LEVEL {
    /**
     * Does not log at all.
     */
    NONE = 0,

    /**
     * Logs responses having an HTTP error code and unsuccessful requests.
     */
    ERROR = 1 << 0,

    /**
     * Logs every request and response, but only outputs HTTP method and URL (no request/response body data).
     */
    INFO = 1 << 1,

    /**
     * Logs every request and response and outputs HTTP method, URL and request/response body data.
     */
    DEBUG = 1 << 2,
}

const LOG_LEVEL_NONE = LOG_LEVEL.NONE;

const LOG_LEVEL_ERROR = LOG_LEVEL.ERROR;

const LOG_LEVEL_INFO = LOG_LEVEL.INFO;

const LOG_LEVEL_DEBUG = LOG_LEVEL.DEBUG;

let logLevel = LOG_LEVEL.NONE;

const activateLogging = (level = LOG_LEVEL.INFO) => {
    logLevel = level;
};

const deactivateLogging = () => {
    logLevel = LOG_LEVEL.NONE;
};

const logRequest = (request: AxiosRequestConfig) => {
    if (logLevel < LOG_LEVEL.INFO) {
        return request;
    }
    return AxiosLogger.requestLogger(request, getAxiosLoggerConfig());
};

const logResponse = (response: AxiosResponse) => {
    if (logLevel < LOG_LEVEL.INFO) {
        return response;
    }
    return AxiosLogger.responseLogger(response, getAxiosLoggerConfig());
};

const logError = (error: AxiosError) => {
    if (logLevel < LOG_LEVEL.ERROR) {
        return Promise.reject(error);
    }
    return AxiosLogger.errorLogger(error, getAxiosLoggerConfig(LOG_LEVEL.ERROR));
};

const logMessage = (...args: Parameters<typeof console.log>) => {
    if (logLevel >= LOG_LEVEL.INFO) {
        console.log('ChurchTools Client:', ...args); //eslint-disable-line no-console
    }
};

const logWarning = (...args: Parameters<typeof console.warn>) => {
    console.warn('ChurchTools Client:', ...args); //eslint-disable-line no-console
};

const getAxiosLoggerConfig = (minLogLevelForData = LOG_LEVEL.DEBUG) => {
    return {
        prefixText: 'ChurchToolsClient',
        data: logLevel >= minLogLevelForData,
        params: logLevel >= minLogLevelForData,
        headers: logLevel >= minLogLevelForData,
        logger: (...args: any[]) => console.log(...args),
    };
};

export {
    logRequest,
    logResponse,
    logError,
    logMessage,
    logWarning,
    activateLogging,
    deactivateLogging,
    LOG_LEVEL_NONE,
    LOG_LEVEL_DEBUG,
    LOG_LEVEL_INFO,
    LOG_LEVEL_ERROR,
};
