import axios from 'axios';
import { log } from './logging';
import { toCorrectChurchToolsUrl } from './urlHelper';

const MINIMAL_CHURCHTOOLS_BUILD_VERSION = 31413;
const MINIMAL_CHURCHTOOLS_VERSION = '3.54.2';
const DEFAULT_TIMEOUT = 15000;
const STATUS_UNAUTHORIZED = 401;
const CUSTOM_RETRY_PARAM = 'X-retry-login';

let defaultChurchToolsClient = null;

class ChurchToolsClient {
    constructor(churchToolsBaseUrl = null, loginToken = null, loadCSRFForOldApi = false) {
        this.churchToolsBaseUrl = churchToolsBaseUrl;
        this.csrfToken = null;
        this.loadCSRFForOldApi = loadCSRFForOldApi;
        this.ax = axios.create({
            baseURL: churchToolsBaseUrl,
            timeout: DEFAULT_TIMEOUT,
            withCredentials: true
        });

        this.unauthorizedInterceptor = null;
        this.unauthenticatedCallbacks = [];

        this.ax.interceptors.request.use(request => {
            log('Starting Request ', request);
            return request;
        });

        this.ax.interceptors.response.use(response => {
            log('Response: ', response);
            return response;
        });

        this.setUnauthorizedInterceptor(loginToken);
    }

    /**
     * Sets the default ChurchTools url.
     *
     * @param {string} baseUrl The ChurchTools Base url to use
     */
    setBaseUrl(baseUrl) {
        this.churchToolsBaseUrl = baseUrl.replace(/\/$/, '');
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
            Promise.resolve(true)
                .then(() => {
                    if (this.csrfToken) {
                        return true;
                    }
                    return this.get('/csrftoken').then(response => {
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
                            }
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
                });
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

    get(uri, params = {}, rawResponse = false) {
        return new Promise((resolve, reject) => {
            this.ax
                .get(this.buildUrl(uri), { params: params })
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
        });
    }

    getAllPages(uri, params = {}) {
        params.limit = 100;

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
            this.ax
                .put(this.buildUrl(uri), data)
                .then(response => {
                    resolve(this.responseToData(response), response);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    post(uri, data = {}) {
        return new Promise((resolve, reject) => {
            this.ax
                .post(this.buildUrl(uri), data)
                .then(response => {
                    resolve(this.responseToData(response), response);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    patch(uri, data = {}) {
        return new Promise((resolve, reject) => {
            this.ax
                .patch(this.buildUrl(uri), data)
                .then(response => {
                    resolve(this.responseToData(response), response);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    deleteApi(uri, data = {}) {
        return new Promise((resolve, reject) => {
            this.ax
                .delete(this.buildUrl(uri), { data: data })
                .then(response => {
                    resolve(this.responseToData(response), response);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    notifyUnauthenticated() {
        log('Notifying unauthenticated.');
        this.unauthenticatedCallbacks.forEach(callback => {
            callback();
        });
    }

    retryWithLogin(config, loginToken, personId, resolve, reject, previousError) {
        log('Trying transparent relogin with login token');
        this.get('/whoami', {
            login_token: loginToken,
            user_id: personId,
            no_url_rewrite: true,
            [CUSTOM_RETRY_PARAM]: true
        })
            .then(() => {
                log('Successfully logged in again with login token');
                if (this.csrfToken || !this.loadCSRFForOldApi) {
                    this.csrfToken = null;
                    return true;
                }
                return this.get('/csrftoken').then(response => {
                    this.csrfToken = response;
                    return true;
                });
            })
            .then(() => {
                if (config.headers) {
                    config.headers['CSRF-Token'] = this.csrfToken;
                } else {
                    config.headers = {
                        'CSRF-Token': this.csrfToken
                    };
                }
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
                            log('Failed to login with login token', error);
                            reject(error);
                            this.notifyUnauthenticated();
                        } else {
                            reject(previousError);
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

        const handleUnauthorized = response =>
            new Promise((resolve, reject) => {
                if (response && response.status === STATUS_UNAUTHORIZED) {
                    if (response.config && response.config.params && response.config.params[CUSTOM_RETRY_PARAM]) {
                        this.notifyUnauthenticated();
                        reject(response);
                    } else {
                        log('Got 401 session expired');
                        if (loginToken) {
                            this.retryWithLogin(response.config, loginToken, personId, resolve, reject, response);
                        } else {
                            this.notifyUnauthenticated();
                        }
                    }
                } else {
                    reject(response);
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
                if (response.status === STATUS_UNAUTHORIZED || response.data.message === 'Session expired!') {
                    response.status = STATUS_UNAUTHORIZED;
                    return handleUnauthorized(response);
                } else {
                    return Promise.resolve(response);
                }
            },
            errorObject => handleUnauthorized(errorObject.response)
        );
    }

    onUnauthenticated(callback) {
        this.unauthenticatedCallbacks.push(callback);
    }

    validChurchToolsUrl(url) {
        const infoApiPath = '/api/info';
        const infoEndpoint = `${toCorrectChurchToolsUrl(url)}${infoApiPath}`;
        return new Promise((resolve, reject) => {
            this.ax
                .get(infoEndpoint)
                .then(response => {
                    const build = parseInt(response.data.build);
                    if (build >= MINIMAL_CHURCHTOOLS_BUILD_VERSION) {
                        if (response.request.responseURL !== infoEndpoint && response.request.responseURL) {
                            resolve(response.request.responseURL.slice(0, -infoApiPath.length));
                        } else {
                            resolve(url);
                        }
                    } else if (response.data.build) {
                        reject({
                            message:
                                `The url ${url} points to a ChurchTools Installation, but its version is too old.` +
                                ` At least version ${MINIMAL_CHURCHTOOLS_VERSION} is required.`,
                            messageKey: 'churchtools.url.invalidold',
                            args: {
                                url: url,
                                minimalChurchToolsVersion: MINIMAL_CHURCHTOOLS_VERSION
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
                        log('Network error: Offline', error);
                        reject({
                            message:
                                'Could not validate the url. Either the url is wrong or there is a problem with the ' +
                                'internet connection',
                            messageKey: 'churchtools.url.offline'
                        });
                    } else {
                        log('Error on checking url', error);
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

const getAllPages = (uri, params = {}) => {
    return defaultChurchToolsClient.getAllPages(uri, params);
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
    setLoadCSRFForOldAPI
};
