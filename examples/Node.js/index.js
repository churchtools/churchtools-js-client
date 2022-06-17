
// Settings: Please set accordingly to run this demo.
const SETTINGS = {
    BASEURL: 'https://demo.church.tools',
    USERNAME: 'please-replace',
    PASSWORD: 'please-replace',
    // if TOKEN is set, the TOKEN is used to log in instead of USERNAME/PASSWORD
    //TOKEN: 'please-replace'
};

// End of Settings

const { churchtoolsClient, activateLogging, LOG_LEVEL_INFO, errorHelper } = require('@churchtools/churchtools-client');
const axiosCookieJarSupport = require('axios-cookiejar-support');
const tough = require('tough-cookie');

function initChurchToolsClient() {
    churchtoolsClient.setCookieJar(axiosCookieJarSupport.wrapper, new tough.CookieJar());
    churchtoolsClient.setBaseUrl(SETTINGS.BASEURL);
    // Logging can be activated to either LOG_LEVEL_NONE (no logging at all, default),
    // LOG_LEVEL_DEBUG (outputs every request and response including request/response data)
    // LOG_LEVEL_INFO (outputs every request and response, but only method and URL) or
    // LOG_LEVEL_ERROR (outputs only errors).
    activateLogging(LOG_LEVEL_INFO);
}

//
function login() {
    // if we have a login token, we use this
    if (SETTINGS.TOKEN) {
        churchtoolsClient.setUnauthorizedInterceptor(SETTINGS.TOKEN);
        // we call /api/contactlabels here, as an example. Any api call will trigger an automatic login with TOKEN
        return churchtoolsClient.get('/contactlabels')
            .then(() => {
                console.log('Login with token successful.');
                return true;
            });
    }

    // no login token => use username / password
    return churchtoolsClient.post('/login', {
        username: SETTINGS.USERNAME,
        password: SETTINGS.PASSWORD
    }).then(() => {
        console.log('Login successful.');
        return true;
    });
}

initChurchToolsClient();
login().then(() => {
    return churchtoolsClient.get('/whoami').then(whoAmI => {
        console.log(`Hello ${whoAmI.firstName}!`);
    });
}).catch(error => {
    // getTranslatedErrorMessage returns a human readable translated error message
    // from either a full response object, response data or Exception or Error instances.
    console.error(errorHelper.getTranslatedErrorMessage(error));
});
