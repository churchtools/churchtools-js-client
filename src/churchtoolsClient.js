import axios from 'axios';

let churchToolsBaseUrl = null;

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

export { oldApi, get, setBaseUrl, enableLogging };
