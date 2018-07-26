import axios from 'axios';
import { log } from './logging';
import { toCorrectChurchToolsUrl } from './urlHelper';

let churchToolsBaseUrl = null;
let unauthorizedInterceptor = null;
let tryingToLoginAgain = false;
const unauthenticatedCallbacks = [];
const MINIMAL_CHURCHTOOLS_BUILD_VERSION = 31190;

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
    return `${churchToolsBaseUrl}/api${uri}`;
};

const get = uri => {
    return new Promise((resolve, reject) => {
        axios
            .get(buildUrl(uri))
            .then(response => {
                resolve(responseToData(response));
            })
            .catch(error => {
                reject(error);
            });
    });
};

const put = (uri, data) => {
    return new Promise((resolve, reject) => {
        axios
            .put(buildUrl(uri), data)
            .then(response => {
                resolve(response.data);
            })
            .catch(error => {
                reject(error);
            });
    });
};

const post = (uri, data = {}) => {
    return new Promise((resolve, reject) => {
        axios
            .put(buildUrl(uri), data)
            .then(response => {
                resolve(response.data);
            })
            .catch(error => {
                reject(error);
            });
    });
};

const deleteApi = (uri, data = {}) => {
    return new Promise((resolve, reject) => {
        axios
            .delete(buildUrl(uri), data)
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
    tryingToLoginAgain = true;
    log('Trying transparent relogin with login token');
    get(`/whoami?login_token=${loginToken}&user_id=${personId}&no_url_rewrite=true`)
        .then(() => {
            axios
                .request(config)
                .then(response => {
                    tryingToLoginAgain = false;
                    log('Successfully logged in again with login token');
                    resolve(response);
                })
                .catch(error => {
                    tryingToLoginAgain = false;
                    log('Failed to login with login token', error);
                    reject(error);
                    notifyUnauthenticated();
                });
        })
        .catch(() => {
            tryingToLoginAgain = false;
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
        error => {
            return new Promise((resolve, reject) => {
                if (tryingToLoginAgain) {
                    tryingToLoginAgain = false;
                    notifyUnauthenticated();
                    reject(error);
                }
                if (error.response && error.response.status === 401) {
                    log('Got 401 session expired', error);
                    if (loginToken) {
                        retryWithLogin(error.config, loginToken, personId, resolve, reject, error);
                    } else {
                        notifyUnauthenticated();
                    }
                } else {
                    reject(error);
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
                if (build >= 31190) {
                    resolve();
                } else if (response.data.buid) {
                    reject({
                        message: `The url ${url} points to a ChurchTools Installation, but its version is too old. At least build ${MINIMAL_CHURCHTOOLS_BUILD_VERSION} is required.`,
                        messageKey: 'churchtools.url.invalid.old',
                        args: {
                            url: url,
                            minimalChurchToolsBuildVersion: MINIMAL_CHURCHTOOLS_BUILD_VERSION
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
                log('Error on checking url', error);
                reject({
                    message: `The url ${url} does not point to a valid ChurchTools installation.`,
                    messageKey: 'churchtools.url.invalid',
                    args: {
                        url: url
                    }
                });
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
    validChurchToolsUrl
};
