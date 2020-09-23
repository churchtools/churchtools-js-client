
// Settings: Please set accordingly to run this demo.
const BASEURL = 'https://testjan.church.tools';
const USERNAME = 'eva';
const PASSWORD = 'ChurchTools2018';
const LOGGING = false;
// End of Settings

const { churchtoolsClient, activateLogging } = require('@churchtools/churchtools-client');
const axiosCookieJarSupport = require('axios-cookiejar-support');
const tough = require('tough-cookie');

function initChurchToolsClient() {
    churchtoolsClient.setCookieJar(axiosCookieJarSupport.default, new tough.CookieJar());
    churchtoolsClient.setBaseUrl(BASEURL);
    if (LOGGING) {
        activateLogging();
    }
}

function handleError(error) {
    if (error.response && error.response.data) {
        console.log(error.response.data.translatedMessage || error.response.data.message);
    } else {
        console.error(error);
    }
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
        if (LOGGING) {
            console.dir(whoAmI);
        }
        console.log(`Hello ${whoAmI.firstName}!`);
    });
}).catch(handleError);
