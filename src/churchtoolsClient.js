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
    new Promise((resolve, reject) => {
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
                    reject(response);
                }
            });
    });
};

const get = uri => {
    const url = `${churchToolsBaseUrl}/api${uri}`;
    return axios.get(url);
};

export { oldApi, get, setBaseUrl };
