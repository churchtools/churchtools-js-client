import axios from 'axios';
import { log } from './logging';

let churchToolsBaseUrl = null;
let unauthorizedInterceptor = null;
let tryingToLoginAgain = false;
const unauthenticatedCallbacks = [];

/**
 * Sets the default ChurchTools url.
 *
 * @param {string} baseUrl The ChurchTools Base url to use
 */
const setBaseUrl = baseUrl => {
    churchToolsBaseUrl = baseUrl.replace(/\/$/, '');
};

const enableLogging = () => {
    axios.interceptors.request.use(request => {
        log('Starting Request', request);
        return request;
    });

    axios.interceptors.response.use(response => {
        log('Response:', response);
        return response;
    });
};

const enableCrossOriginRequests = () => {
    axios.defaults.withCredentials = true;
};

const buildOldRequestObject = (func, params) => {
    return Object.assign({}, params, { func: func });
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
                url: `${churchToolsBaseUrl}?q=${module}`,
                method: 'POST',
                params: buildOldRequestObject(func, params)
            })
            .then(response => {
                if (response.data.status === 'success') {
                    resolve(response.data.data);
                } else {
                    reject({ response: response });
                }
            })
            .catch(error => {
                reject(error);
            });
    });
};

const get = uri => {
    const url = `${churchToolsBaseUrl}/api${uri}`;
    return new Promise((resolve, reject) => {
        axios
            .get(url)
            .then(response => {
                resolve(response.data);
            })
            .catch(error => {
                reject(error);
            });
    });
};

const notifyUnauthenticated = () => {
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
                    log('Failed to login with login token');
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
                Promise.reject({ response: response, config: response.config });
            } else {
                Promise.resolve(response);
            }
        },
        error => {
            return new Promise((resolve, reject) => {
                if (tryingToLoginAgain) {
                    tryingToLoginAgain = false;
                    reject(error);
                }
                if (error.response && error.response.status === 401) {
                    log('Got 401 session expired');
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

export {
    oldApi,
    get,
    setBaseUrl,
    enableLogging,
    setUnauthorizedInterceptor,
    enableCrossOriginRequests,
    onUnauthenticated
};
