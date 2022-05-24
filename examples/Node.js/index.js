
// Settings: Please set accordingly to run this demo.
const BASEURL = 'https://demo.church.tools';
const USERNAME = 'please-replace';
const PASSWORD = 'please-replace';
// End of Settings

const { churchtoolsClient, activateLogging, LOG_LEVEL_INFO, errorHelper } = require('@churchtools/churchtools-client');
const axiosCookieJarSupport = require('axios-cookiejar-support');
const tough = require('tough-cookie');

function initChurchToolsClient() {
    churchtoolsClient.setCookieJar(axiosCookieJarSupport.wrapper, new tough.CookieJar());
    churchtoolsClient.setBaseUrl(BASEURL);
    // Logging can be activated to either LOG_LEVEL_NONE (no logging at all, default),
    // LOG_LEVEL_DEBUG (outputs every request and response including request/response data)
    // LOG_LEVEL_INFO (outputs every request and response, but only method and URL) or
    // LOG_LEVEL_ERROR (outputs only errors).
    activateLogging(LOG_LEVEL_INFO);
}

function login(username, password) {
    return churchtoolsClient.post('/login', {
        username,
        password
    });
}

initChurchToolsClient();
login(USERNAME, PASSWORD).then(() => {
    console.log('Login successful.');
    return churchtoolsClient.get('/whoami').then(whoAmI => {
        console.log(`Hello ${whoAmI.firstName}!`);
    });
}).catch(error => {
    // getTranslatedErrorMessage returns a human readable translated error message
    // from either a full response object, response data or Exception or Error instances.
    console.error(errorHelper.getTranslatedErrorMessage(error));
});
