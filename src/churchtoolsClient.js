import axios from 'axios';
import { log } from './logging';
import { toCorrectChurchToolsUrl } from './urlHelper';

let churchToolsBaseUrl = null;
let unauthorizedInterceptor = null;
const unauthenticatedCallbacks = [];
const MINIMAL_CHURCHTOOLS_BUILD_VERSION = 31306;
const MINIMAL_CHURCHTOOLS_VERSION = '3.45.0';

/**
 * Sets the default ChurchTools url.
 *
 * @param {string} baseUrl The ChurchTools Base url to use
 */
const setBaseUrl = baseUrl => {
    churchToolsBaseUrl = baseUrl.replace(/\/$/, '');
};

axios.interceptors.request.use(request => {
    log('Starting Request', request);
    return request;
});

axios.interceptors.response.use(response => {
    log('Response:', response);
    return response;
});

const enableCrossOriginRequests = () => {
    axios.defaults.withCredentials = true;
};

const buildOldRequestObject = (func, params) => {
    return Object.assign({}, params, { func: func });
};

const responseToData = response => {
    return response.data.data ? response.data.data : response.data;
};

/**
 * Calls the old ChurchTools Api
 *
 * @param {string} module defines which module that should be queried
 * @param {string} func defines the function that should be called in the module
 * @param {string} params additional params passed to the called function
 *
 * @returns {Promise}
 */
const oldApi = (module, func, params) => {
    return new Promise((resolve, reject) => {
        axios
            .request({
                url: `${churchToolsBaseUrl}/?q=${module}`,
                method: 'POST',
                params: buildOldRequestObject(func, params)
            })
            .then(response => {
                if (response.data.status === 'success') {
                    resolve(responseToData(response));
                } else {
                    reject({ response: response });
                }
            })
            .catch(error => {
                reject(error);
            });
    });
};

const buildUrl = uri => {
    if (uri.startsWith('http')) {
        return uri;
    }
    return `${churchToolsBaseUrl}/api${uri}`;
};

const get = (uri, params = {}, rawResponse = false) => {
    return new Promise((resolve, reject) => {
        axios
            .get(buildUrl(uri), { params: params })
            .then(response => {
                if (rawResponse) {
                    resolve(response);
                } else {
                    resolve(responseToData(response));
                }
            })
            .catch(error => {
                reject(error);
            });
    });
};

const getAllPages = (uri, params = {}) => {
    params.limit = 100;

    return new Promise((resolve, reject) => {
        getAllPagesInternal(uri, params, 1, resolve, reject);
    });
};

const getAllPagesInternal = (uri, params, page, resolve, reject, result = []) => {
    params.page = page;
    get(uri, params, true)
        .then(response => {
            result.push(...responseToData(response));
            if (response.data.meta.pagination.lastPage > page) {
                getAllPagesInternal(uri, params, page + 1, resolve, reject, result);
            } else {
                resolve(result);
            }
        })
        .catch(reject);
};

const customRetryParam = 'X-retry-login';

const put = (uri, data) => {
    return new Promise((resolve, reject) => {
        axios
            .put(buildUrl(uri), data)
            .then(response => {
                resolve(responseToData(response.data));
            })
            .catch(error => {
                reject(error);
            });
    });
};

const post = (uri, data = {}) => {
    return new Promise((resolve, reject) => {
        axios
            .post(buildUrl(uri), data)
            .then(response => {
                resolve(responseToData(response.data));
            })
            .catch(error => {
                reject(error);
            });
    });
};

const deleteApi = (uri, data = {}) => {
    return new Promise((resolve, reject) => {
        axios
            .delete(buildUrl(uri), { data: data })
            .then(response => {
                resolve(response.data);
            })
            .catch(error => {
                reject(error);
            });
    });
};

const notifyUnauthenticated = () => {
    log('Notifying unauthenticated.');
    unauthenticatedCallbacks.forEach(callback => {
        callback();
    });
};

const retryWithLogin = (config, loginToken, personId, resolve, reject, previousError) => {
    log('Trying transparent relogin with login token');
    get('/whoami', { login_token: loginToken, user_id: personId, no_url_rewrite: true, [customRetryParam]: true })
        .then(() => {
            axios
                .request(config)
                .then(response => {
                    log('Successfully logged in again with login token');
                    resolve(response);
                })
                .catch(error => {
                    if (
                        (error.response && error.response.status) === 401 ||
                        (error.response && error.response.message && error.response.data.message === 'Session expired!')
                    ) {
                        log('Failed to login with login token', error);
                        reject(error);
                        notifyUnauthenticated();
                    } else {
                        reject(previousError);
                    }
                });
        })
        .catch(() => {
            reject(previousError);
        });
};

const setUnauthorizedInterceptor = (loginToken = null, personId = null) => {
    if (unauthorizedInterceptor) {
        axios.interceptors.response.eject(unauthorizedInterceptor);
    }
    unauthorizedInterceptor = axios.interceptors.response.use(
        response => {
            if (response.data.message === 'Session expired!') {
                response.status = 401;
                return Promise.reject({ response: response, config: response.config });
            } else {
                return Promise.resolve(response);
            }
        },
        errorObject => {
            return new Promise((resolve, reject) => {
                if (errorObject.config.params && errorObject.config.params[customRetryParam]) {
                    notifyUnauthenticated();
                    reject(errorObject);
                } else if (errorObject.response && errorObject.response.status === 401) {
                    log('Got 401 session expired', errorObject);
                    if (loginToken) {
                        retryWithLogin(errorObject.config, loginToken, personId, resolve, reject, errorObject);
                    } else {
                        notifyUnauthenticated();
                    }
                } else {
                    reject(errorObject);
                }
            });
        }
    );
};

setUnauthorizedInterceptor();

const onUnauthenticated = callback => {
    unauthenticatedCallbacks.push(callback);
};

const validChurchToolsUrl = url => {
    const infoEndpoint = `${toCorrectChurchToolsUrl(url)}/api/info`;
    return new Promise((resolve, reject) => {
        axios
            .get(infoEndpoint)
            .then(response => {
                const build = parseInt(response.data.build);
                if (build >= MINIMAL_CHURCHTOOLS_BUILD_VERSION) {
                    resolve();
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
};

export {
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
