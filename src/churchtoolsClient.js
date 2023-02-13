import axios from 'axios';
import {logRequest, logResponse, logError, logMessage, logWarning} from './logging';
import { toCorrectChurchToolsUrl } from './urlHelper';

const MINIMAL_CHURCHTOOLS_BUILD_VERSION = 31413;
const MINIMAL_CHURCHTOOLS_VERSION = '3.54.2';
const DEFAULT_TIMEOUT = 15000;
const RATE_LIMIT_TIMEOUT = 30000;
const STATUS_UNAUTHORIZED = 401;
const STATUS_RATELIMITED = 429;
const CUSTOM_RETRY_PARAM = 'X-retry-login';

let defaultChurchToolsClient = null;

class ChurchToolsClient {
    constructor(churchToolsBaseUrl = null, loginToken = null, loadCSRFForOldApi = false) {
        this.churchToolsBaseUrl = churchToolsBaseUrl;
        this.csrfToken = null;
        this.loadCSRFForOldApi = loadCSRFForOldApi;
        this.ax = axios.create({
            baseURL: churchToolsBaseUrl,
            withCredentials: true
        });

        this.unauthorizedInterceptor = null;
        this.unauthenticatedCallbacks = [];
        this.rateLimitInterceptor = null;

        this.firstRequestStarted = false;
        this.firstRequestCompleted = false;
        this.loginRunning = false;
        this.deferredRequestCallbacks = [];

        this.ax.interceptors.request.use(logRequest, logError);
        this.ax.interceptors.response.use(logResponse, logError);

        this.setUnauthorizedInterceptor(loginToken);

        this.requestTimeout = DEFAULT_TIMEOUT;
        this.rateLimitTimeout = RATE_LIMIT_TIMEOUT;
        this.currentLoginPromise = undefined;
    }

    /**
     * Sets the default ChurchTools url.
     *
     * @param {string} baseUrl The ChurchTools Base url to use
     */
    setBaseUrl(baseUrl) {
        this.churchToolsBaseUrl = baseUrl.replace(/\/$/, '');
    }

    setRateLimitTimeout(timeoutInMs) {
        this.rateLimitTimeout = timeoutInMs;
    }

    setRequestTimeout(timeoutInMs) {
        this.requestTimeout = timeoutInMs;
    }

    delay(t, v) {
        return new Promise(function(resolve) {
            setTimeout(resolve.bind(null, v), t);
        });
    }

    /**
     * Defer the execution of requests until the first request and any login requests have been completed.
     *
     * @param callback Function which calls the request
     */
    deferredExecution(callback) {
        if ((this.firstRequestStarted && !this.firstRequestCompleted) || this.loginRunning) {
            this.deferredRequestCallbacks.push(callback);
        } else {
            this.firstRequestStarted = true;
            callback()
                .catch(() => {
                    this.firstRequestCompleted = true;
                    this.processDeferredRequestCallbacks();
                })
                .then(() => {
                    this.firstRequestCompleted = true;
                    this.processDeferredRequestCallbacks();
                });
        }
    }

    processDeferredRequestCallbacks() {
        let callback;
        while ((callback = this.deferredRequestCallbacks.pop()) !== undefined) {
            callback();
        }
    }

    enableCrossOriginRequests() {
        this.ax.defaults.withCredentials = true;
    }

    buildOldRequestObject(func, params) {
        return Object.assign({}, params, { func: func });
    }

    responseToData(response) {
        return response.data.data ? response.data.data : response.data;
    }

    getCancelToken() {
        let source = axios.CancelToken.source();
        setTimeout(() => {
            source.cancel('Timeout');
        }, this.requestTimeout);
        return source.token;
    }

    /**
     * Calls the old ChurchTools Api
     *
     * @param {string} module defines which module that should be queried
     * @param {string} func defines the function that should be called in the module
     * @param {object} params additional params passed to the called function
     *
     * @returns {Promise}
     */
    oldApi(module, func, params = {}) {
        this.loadCSRFForOldApi = true;
        return new Promise((resolve, reject) => {
            this.deferredExecution(() =>
                Promise.resolve(true)
                    .then(() => {
                        if (this.csrfToken) {
                            return true;
                        }
                        return this.get('/csrftoken', {}, false, false).then(response => {
                            this.csrfToken = response;
                            return true;
                        });
                    })
                    .then(() => {
                        return this.ax.post(
                            `${this.churchToolsBaseUrl}/?q=${module}`,
                            this.buildOldRequestObject(func, params),
                            {
                                headers: {
                                    'CSRF-Token': this.csrfToken
                                },
                                cancelToken: this.getCancelToken()
                            }
                        );
                    })
                    .then(response => {
                        if (response.data.status === 'success') {
                            resolve(this.responseToData(response));
                        } else {
                            reject({ response: response });
                        }
                    })
                    .catch(error => {
                        reject(error);
                    })
            );
        });
    }

    setLoadCSRFForOldAPI() {
        this.loadCSRFForOldApi = true;
    }

    buildUrl(uri) {
        if (uri.startsWith('http')) {
            return uri;
        }
        return `${this.churchToolsBaseUrl}/api${uri}`;
    }

    get(uri, params = {}, rawResponse = false, callDeferred = true) {
        const cb = (resolve, reject) =>
            this.ax
                .get(this.buildUrl(uri), { params: params, cancelToken: this.getCancelToken() })
                .then(response => {
                    if (rawResponse) {
                        resolve(response);
                    } else {
                        resolve(this.responseToData(response), response);
                    }
                })
                .catch(error => {
                    reject(error);
                });

        return new Promise((resolve, reject) => {
            if (callDeferred) {
                this.deferredExecution(() => cb(resolve, reject));
            } else {
                cb(resolve, reject);
            }
        });
    }

    getAllPages(uri, params = {}, resultsPerPage = 100) {
        params.limit = resultsPerPage;

        return new Promise((resolve, reject) => {
            this.getAllPagesInternal(uri, params, 1, resolve, reject);
        });
    }

    getAllPagesInternal(uri, params, page, resolve, reject, result = []) {
        params.page = page;
        this.get(uri, params, true)
            .then(response => {
                result.push(...this.responseToData(response));
                if (response.data.meta.pagination.lastPage > page) {
                    this.getAllPagesInternal(uri, params, page + 1, resolve, reject, result);
                } else {
                    resolve(result);
                }
            })
            .catch(reject);
    }

    put(uri, data) {
        return new Promise((resolve, reject) => {
            this.deferredExecution(() =>
                this.ax
                    .put(this.buildUrl(uri), data, { cancelToken: this.getCancelToken() })
                    .then(response => {
                        resolve(this.responseToData(response), response);
                    })
                    .catch(error => {
                        reject(error);
                    })
            );
        });
    }

    post(uri, data = {}) {
        // FormData will be sent as multipart/form-data and the CT server requires a CSRF token for such a request
        // React-Native mangles the constructor.name. Therefore another check must be applied to react-native
        const needsCsrfToken =
            (!globalThis.FormData && data && data.constructor && data.constructor.name === 'FormData') || // Node-JS
            (globalThis.FormData && data instanceof FormData); // browser/react-native
        return new Promise((resolve, reject) => {
            this.deferredExecution(() =>
                Promise.resolve()
                    .then(() => {
                        if (!needsCsrfToken || this.csrfToken) {
                            return Promise.resolve();
                        }
                        return this.get('/csrftoken').then(response => {
                            this.csrfToken = response;
                        });
                    })
                    .then(() => {
                        const config = { cancelToken: this.getCancelToken() };
                        if (needsCsrfToken) {
                            config.headers = {
                                'CSRF-Token': this.csrfToken
                            };
                        }
                        return this.ax.post(this.buildUrl(uri), data, config);
                    })
                    .then(response => {
                        resolve(this.responseToData(response), response);
                    })
                    .catch(error => {
                        reject(error);
                    })
            );
        });
    }

    patch(uri, data = {}) {
        return new Promise((resolve, reject) => {
            this.deferredExecution(() =>
                this.ax
                    .patch(this.buildUrl(uri), data, { cancelToken: this.getCancelToken() })
                    .then(response => {
                        resolve(this.responseToData(response), response);
                    })
                    .catch(error => {
                        reject(error);
                    })
            );
        });
    }

    deleteApi(uri, data = {}) {
        return new Promise((resolve, reject) => {
            this.deferredExecution(() =>
                this.ax
                    .delete(this.buildUrl(uri), { data: data, cancelToken: this.getCancelToken() })
                    .then(response => {
                        resolve(this.responseToData(response), response);
                    })
                    .catch(error => {
                        reject(error);
                    })
            );
        });
    }

    notifyUnauthenticated() {
        logMessage('Notifying unauthenticated.');
        this.unauthenticatedCallbacks.forEach(callback => {
            callback();
        });
    }

    loginWithToken(loginToken, personId) {
        if (!this.currentLoginPromise) {
            this.loginRunning = true;
            this.currentLoginPromise = this.get(
                '/whoami',
                {
                    login_token: loginToken,
                    user_id: personId,
                    no_url_rewrite: true,
                    [CUSTOM_RETRY_PARAM]: true
                },
                false,
                false
            )
                .then(() => {
                    logMessage('Successfully logged in again with login token');
                    if (this.csrfToken || !this.loadCSRFForOldApi) {
                        this.csrfToken = null;
                        return true;
                    }
                    return this.get('/csrftoken', {}, false, false).then(response => {
                        this.csrfToken = response;
                        return true;
                    });
                })
                .then(res => {
                    this.loginRunning = false;
                    this.currentLoginPromise = undefined;
                    return res;
                })
                .catch(e => {
                    logError(e).catch(() => {}); // catch is needed as logError can return a rejected promise
                    this.loginRunning = false;
                    this.currentLoginPromise = undefined;
                    throw e;
                });
        }
        return this.currentLoginPromise;
    }

    retryWithLogin(config, loginToken, personId, resolve, reject, previousError) {
        logWarning('Trying transparent relogin with login token');
        this.loginWithToken(loginToken, personId)
            .then(() => {
                if (config.headers) {
                    config.headers['CSRF-Token'] = this.csrfToken;
                } else {
                    config.headers = {
                        'CSRF-Token': this.csrfToken
                    };
                }
                config.cancelToken = this.getCancelToken();
                config.httpAgent = undefined;
                config.httpsAgent = undefined;
                this.ax
                    .request(config)
                    .then(response => {
                        resolve(response);
                    })
                    .catch(error => {
                        if (
                            (error.response && error.response.status) === STATUS_UNAUTHORIZED ||
                            (error.response &&
                                error.response.message &&
                                error.response.data.message === 'Session expired!')
                        ) {
                            logMessage('Failed to login with login token', error);
                            reject(error);
                            this.notifyUnauthenticated();
                        } else {
                            reject(error);
                        }
                    });
            })
            .catch(() => {
                reject(previousError);
            });
    }

    setUnauthorizedInterceptor(loginToken = null, personId = null) {
        if (this.unauthorizedInterceptor !== null) {
            this.ax.interceptors.response.eject(this.unauthorizedInterceptor);
        }

        const handleUnauthorized = (response, errorObject) =>
            new Promise((resolve, reject) => {
                if (response && response.status === STATUS_UNAUTHORIZED) {
                    if (response.config && response.config.params && response.config.params[CUSTOM_RETRY_PARAM]) {
                        this.notifyUnauthenticated();
                        reject(errorObject || response);
                    } else {
                        logMessage('Got 401 session expired');
                        if (loginToken) {
                            this.retryWithLogin(response.config, loginToken, personId, resolve, reject, response);
                        } else {
                            this.notifyUnauthenticated();
                        }
                    }
                } else {
                    reject(errorObject || response);
                }
            });

        this.unauthorizedInterceptor = this.ax.interceptors.response.use(
            response => {
                // onFullfilled (this current function) is called by Axios in case of a 2xx status code.
                // So technically we should be here only in case of a successful request.
                // However, the old ChurchTools API returns { message: 'Session expired' } and a 200 status code
                // in case the user is not currently authorized. That's why we need to fetch and handle this case here.
                // Additionally for some unknown reason, when using axios-cookiejar-support Axios also calls
                // onFullfilled instead of onRejected in case of a 401. That's why we also check for
                // STATUS_UNAUTHORIZED here and handle this case accordingly.
                if (
                    response.status === STATUS_UNAUTHORIZED ||
                    (response.data && response.data.message === 'Session expired!')
                ) {
                    response.status = STATUS_UNAUTHORIZED;
                    return handleUnauthorized(response);
                } else {
                    return Promise.resolve(response);
                }
            },
            errorObject => handleUnauthorized(errorObject.response, errorObject)
        );
    }

    onUnauthenticated(callback) {
        this.unauthenticatedCallbacks.push(callback);
    }

    setRateLimitInterceptor(timeoutInMs = null) {
        if (timeoutInMs) {
            this.setRateLimitTimeout(timeoutInMs);
        }
        if (this.rateLimitInterceptor !== null) {
            this.ax.interceptors.response.eject(this.rateLimitInterceptor);
        }

        const handleRateLimited = (response, errorObject) =>
            new Promise((resolve, reject) => {
                if (response && response.status === STATUS_RATELIMITED) {
                    logMessage('rate limit reached, waiting ' + this.rateLimitTimeout + ' milliseconds.');
                    this.delay(this.rateLimitTimeout)
                        .then(() => {
                            response.config.cancelToken = this.getCancelToken();
                            return this.ax.request(response.config);
                        })
                        .then(response => {
                            resolve(response);
                        })
                        .catch(error => {
                            reject(error);
                        });
                } else {
                    reject(errorObject || response);
                }
            });

        this.rateLimitInterceptor = this.ax.interceptors.response.use(
            response => {
                // onFullfilled (this current function) is called by Axios in case of a 2xx status code.
                // So technically we should be here only in case of a successful request.
                // However, for some unknown reason, when using axios-cookiejar-support Axios also calls
                // onFullfilled instead of onRejected in case of a 429. That's why we also check for
                // STATUS_RATELIMITED here and handle this case accordingly.

                if (response.status === STATUS_RATELIMITED) {
                    return handleRateLimited(response);
                } else {
                    return Promise.resolve(response);
                }
            },
            errorObject => handleRateLimited(errorObject.response, errorObject)
        );
    }

    validChurchToolsUrl(url, minimalBuildNumber = null, minimalVersion = null) {
        const infoApiPath = '/api/info';
        const infoEndpoint = `${toCorrectChurchToolsUrl(url)}${infoApiPath}`;
        return new Promise((resolve, reject) => {
            this.ax
                .get(infoEndpoint, { cancelToken: this.getCancelToken() })
                .then(response => {
                    const build = parseInt(response.data.build);
                    const compareBuild = minimalBuildNumber ? minimalBuildNumber : MINIMAL_CHURCHTOOLS_BUILD_VERSION;
                    if (!minimalVersion) {
                        minimalVersion = MINIMAL_CHURCHTOOLS_VERSION;
                    }
                    if (build >= compareBuild) {
                        if (response.request.responseURL !== infoEndpoint && response.request.responseURL) {
                            resolve(response.request.responseURL.slice(0, -infoApiPath.length));
                        } else {
                            resolve(url);
                        }
                    } else if (response.data.build) {
                        reject({
                            message:
                                `The url ${url} points to a ChurchTools Installation, but its version is too old.` +
                                ` At least version ${minimalVersion} is required.`,
                            messageKey: 'churchtools.url.invalidold',
                            args: {
                                url: url,
                                minimalChurchToolsVersion: minimalVersion
                            }
                        });
                    } else {
                        reject({
                            message: `The url ${url} does not point to a valid ChurchTools installation.`,
                            messageKey: 'churchtools.url.invalid',
                            args: {
                                url: url
                            }
                        });
                    }
                })
                .catch(error => {
                    if (!error.status) {
                        logMessage('Network error: Offline', error);
                        reject({
                            message:
                                'Could not validate the url. Either the url is wrong or there is a problem with the ' +
                                'internet connection',
                            messageKey: 'churchtools.url.offline'
                        });
                    } else {
                        logMessage('Error on checking url', error);
                        reject({
                            message: `The url ${url} does not point to a valid ChurchTools installation.`,
                            messageKey: 'churchtools.url.invalid',
                            args: {
                                url: url
                            }
                        });
                    }
                });
        });
    }

    setCookieJar(axiosCookieJarSupport, jar) {
        this.ax = axiosCookieJarSupport(this.ax);
        this.ax.defaults.jar = jar;
    }
}

defaultChurchToolsClient = new ChurchToolsClient();

const oldApi = (module, func, params) => {
    return defaultChurchToolsClient.oldApi(module, func, params);
};

const get = (uri, params = {}, rawResponse = false) => {
    return defaultChurchToolsClient.get(uri, params, rawResponse);
};

const getAllPages = (uri, params = {}, resultsPerPage = 100) => {
    return defaultChurchToolsClient.getAllPages(uri, params, resultsPerPage);
};

const put = (uri, data) => {
    return defaultChurchToolsClient.put(uri, data);
};

const post = (uri, data = {}) => {
    return defaultChurchToolsClient.post(uri, data);
};

const patch = (uri, data = {}) => {
    return defaultChurchToolsClient.patch(uri, data);
};

const deleteApi = (uri, data = {}) => {
    return defaultChurchToolsClient.deleteApi(uri, data);
};

const setBaseUrl = baseUrl => {
    return defaultChurchToolsClient.setBaseUrl(baseUrl);
};

const setUnauthorizedInterceptor = (loginToken = null, personId = null) => {
    return defaultChurchToolsClient.setUnauthorizedInterceptor(loginToken, personId);
};

const enableCrossOriginRequests = () => {
    return defaultChurchToolsClient.enableCrossOriginRequests();
};

const onUnauthenticated = callback => {
    return defaultChurchToolsClient.onUnauthenticated(callback);
};

const validChurchToolsUrl = url => {
    return defaultChurchToolsClient.validChurchToolsUrl(url);
};

const setCookieJar = (axiosCookieJarSupport, jar) => {
    return defaultChurchToolsClient.setCookieJar(axiosCookieJarSupport, jar);
};

const setLoadCSRFForOldAPI = () => {
    return defaultChurchToolsClient.setLoadCSRFForOldAPI();
};

const setRateLimitTimeout = timeoutInMs => {
    return defaultChurchToolsClient.setRateLimitTimeout(timeoutInMs);
};

const setRateLimitInterceptor = (timeoutInMs = null) => {
    return defaultChurchToolsClient.setRateLimitInterceptor(timeoutInMs);
};

const setRequestTimeout = timeoutInMs => {
    return defaultChurchToolsClient.setRequestTimeout(timeoutInMs);
};

export {
    ChurchToolsClient,
    oldApi,
    get,
    put,
    post,
    patch,
    deleteApi,
    setBaseUrl,
    setUnauthorizedInterceptor,
    enableCrossOriginRequests,
    onUnauthenticated,
    validChurchToolsUrl,
    getAllPages,
    setCookieJar,
    setLoadCSRFForOldAPI,
    setRateLimitTimeout,
    setRateLimitInterceptor,
    setRequestTimeout
};
