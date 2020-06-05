import axios from 'axios';
import axiosCookieJarSupport from 'axios-cookiejar-support';
import tough from 'tough-cookie';
import { log, activateLogging } from './logging.js';
import { toCorrectChurchToolsUrl } from './urlHelper.js';

const MINIMAL_CHURCHTOOLS_BUILD_VERSION = 31412;
const MINIMAL_CHURCHTOOLS_VERSION = '3.54.2';
const DEFAULT_TIMEOUT = 15000;
const STATUS_UNAUTHORIZED = 401;
const CUSTOM_RETRY_PARAM = 'X-retry-login';

let defaultChurchToolsClient = null;

class ChurchToolsClient extends Object {

    constructor(churchToolsBaseUrl = null, loginToken = null, loggingEnabled = false) {
        super();

        if (loggingEnabled) {
            activateLogging();
        }

        this.churchToolsBaseUrl = churchToolsBaseUrl;
        this.ax = axios.create({
            baseURL: churchToolsBaseUrl,
            timeout: DEFAULT_TIMEOUT,
            withCredentials: true
        });

        axiosCookieJarSupport.default(this.ax);
        this.ax.defaults.jar = new tough.CookieJar();

        this.unauthorizedInterceptor = null;
        this.unauthenticatedCallbacks = [];

        this.ax.interceptors.request.use(request => {
            let params = request.params;
            let loginToken = null;
            if (params && params['login_token']) {
                loginToken = params['login_token'];
                delete params['login_token'];
            }
            log('Starting Request ', {
                baseUrl: this.churchToolsBaseUrl,
                url: request.url,
                method: request.method,
                params: params
            });
            if (loginToken) {
                params['login_token'] = loginToken;
            }
            return request;
        });

        this.ax.interceptors.response.use(response => {
            log('Response: ', {status: response.status});
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
        return Object.assign({}, params, {func: func});
    }

    responseToData(response) {
        return response.data.data ? response.data.data : response.data;
    }

    /**
     * Calls the old ChurchTools Api
     *
     * @param {string} module defines which module that should be queried
     * @param {string} func defines the function that should be called in the module
     * @param {string} params additional params passed to the called function
     *
     * @returns {Promise}
     */
    oldApi(module, func, params) {
        return new Promise((resolve, reject) => {
            this.ax
                .request({
                    url: `${this.churchToolsBaseUrl}/?q=${module}`,
                    method: 'POST',
                    params: this.buildOldRequestObject(func, params)
                })
                .then(response => {
                    if (response.data.status === 'success') {
                        resolve(this.responseToData(response));
                    } else {
                        reject({response: response});
                    }
                })
                .catch(error => {
                    reject(error);
                });
        });
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
                .get(this.buildUrl(uri), {params: params })
                .then(response => {
                    if (rawResponse) {
                        resolve(response);
                    } else {
                        resolve(this.responseToData(response));
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
                    resolve(this.responseToData(response));
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
                    resolve(this.responseToData(response));
                })
                .catch(error => {
                    reject(error);
                });
        });
    }

    deleteApi(uri, data = {}) {
        return new Promise((resolve, reject) => {
            this.ax
                .delete(this.buildUrl(uri), {data: data })
                .then(response => {
                    resolve(this.responseToData(response));
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
                this.ax
                    .request(config)
                    .then(response => {
                        log('Successfully logged in again with login token');
                        resolve(response);
                    })
                    .catch(error => {
                        if (
                            (error.response && error.response.status) === STATUS_UNAUTHORIZED ||
                            (error.response && error.response.message && error.response.data.message === 'Session expired!')
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
        if (this.unauthorizedInterceptor) {
            this.ax.interceptors.response.eject(this.unauthorizedInterceptor);
        }
        this.unauthorizedInterceptor = this.ax.interceptors.response.use(
            response => {
                if (response.data.message === 'Session expired!') {
                    response.status = STATUS_UNAUTHORIZED;
                    return Promise.reject({response: response, config: response.config});
                } else {
                    return Promise.resolve(response);
                }
            },
            errorObject => {
                return new Promise((resolve, reject) => {
                    if (errorObject.config.params && errorObject.config.params[CUSTOM_RETRY_PARAM]) {
                        this.notifyUnauthenticated();
                        reject(errorObject);
                    } else if (errorObject.response && errorObject.response.status === STATUS_UNAUTHORIZED) {
                        log('Got 401 session expired', errorObject);
                        if (loginToken) {
                            this.retryWithLogin(errorObject.config, loginToken, personId, resolve, reject, errorObject);
                        } else {
                            this.notifyUnauthenticated();
                        }
                    } else {
                        reject(errorObject);
                    }
                });
            }
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
                            message: `The url ${url} points to a ChurchTools Installation, but its version is too old. At least version ${MINIMAL_CHURCHTOOLS_VERSION} is required.`,
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
                                'Could not validate the url. Either the url is wrong or there is a problem with the internet connection',
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
}

defaultChurchToolsClient = new ChurchToolsClient();

const oldApi = (module, func, params) => {
    return defaultChurchToolsClient.oldApi(module, func, params);
};

const get = (uri, params = {}, rawResponse = false) => {
    return defaultChurchToolsClient.get(uri, params, rawResponse);
};

const getAllPages = (uri, params = {}) => {
    defaultChurchToolsClient.getAllPages(uri, params);
};

const put = (uri, data) => {
    defaultChurchToolsClient.put(uri, data);
};

const post = (uri, data = {}) => {
    defaultChurchToolsClient.post(uri, data);
};

const deleteApi = (uri, data = {}) => {
    defaultChurchToolsClient.deleteApi(uri, data);
};

const setBaseUrl = (baseUrl) => {
    defaultChurchToolsClient.setBaseUrl(baseUrl);
};

const setUnauthorizedInterceptor = (loginToken = null, personId = null) => {
    defaultChurchToolsClient.setUnauthorizedInterceptor(loginToken, personId);
};

const enableCrossOriginRequests = () => {
    defaultChurchToolsClient.enableCrossOriginRequests();
};

const onUnauthenticated = (callback) => {
    defaultChurchToolsClient.onUnauthenticated(callback);
};

const validChurchToolsUrl = (url) => {
    defaultChurchToolsClient.validChurchToolsUrl(url);
};

export {
    ChurchToolsClient,
    oldApi,
    get,
    put,
    post,
    deleteApi,
    setBaseUrl,
    setUnauthorizedInterceptor,
    enableCrossOriginRequests,
    onUnauthenticated,
    validChurchToolsUrl,
    getAllPages
};
