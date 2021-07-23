
// Settings: Please set accordingly to run this demo.
const BASEURL = 'https://demo.church.tools';
const USERNAME = 'please-replace';
const PASSWORD = 'please-replace';
// End of Settings

const { churchtoolsClient, activateLogging, LOG_LEVEL_INFO, errorHelper } = require('@churchtools/churchtools-client');
const axiosCookieJarSupport = require('axios-cookiejar-support');
const tough = require('tough-cookie');

function initChurchToolsClient() {
    churchtoolsClient.setCookieJar(axiosCookieJarSupport.default, new tough.CookieJar());
    churchtoolsClient.setBaseUrl(BASEURL);
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
}).catch(error => console.error(errorHelper.getTranslatedErrorMessage(error)));
