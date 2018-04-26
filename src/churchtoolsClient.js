import axios from 'axios';

let churchToolsBaseUrl = null;
let unauthorizedInterceptor = null;
let tryingToLoginAgain = false;

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
        console.log('Starting Request', request);
        return request;
    });

    axios.interceptors.response.use(response => {
        console.log('Response:', response);
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
                console.log('old', response);
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

const retryWithLogin = (config, loginToken, personId, resolve, reject, previousError) => {
    tryingToLoginAgain = true;
    get(`/whoami?login_token=${loginToken}&user_id=${personId}&no_url_rewrite=true`)
        .then(() => {
            axios
                .request(config)
                .then(response => {
                    tryingToLoginAgain = false;
                    resolve(response);
                })
                .catch(error => {
                    tryingToLoginAgain = false;
                    reject(error);
                });
        })
        .catch(() => {
            tryingToLoginAgain = false;
            reject(previousError);
        });
};

const setUnauthorizedInterceptor = (loginToken = null, personId) => {
    if (unauthorizedInterceptor) {
        axios.interceptors.response.eject(unauthorizedInterceptor);
    }
    unauthorizedInterceptor = axios.interceptors.response.use(
        response => {
            return new Promise((resolve, reject) => {
                if (response.data.message === 'Session expired!') {
                    if (tryingToLoginAgain) {
                        tryingToLoginAgain = false;
                        reject({ response: response });
                    }
                    retryWithLogin(response.config, loginToken, personId, resolve, reject, { response: response });
                } else {
                    resolve(response);
                }
            });
        },
        error => {
            return new Promise((resolve, reject) => {
                if (tryingToLoginAgain) {
                    tryingToLoginAgain = false;
                    reject(error);
                }
                if (error.response && error.response.status === 401) {
                    retryWithLogin(error.config, loginToken, personId, resolve, reject, error);
                } else {
                    reject(error);
                }
            });
        }
    );
};

export { oldApi, get, setBaseUrl, enableLogging, setUnauthorizedInterceptor, enableCrossOriginRequests };
