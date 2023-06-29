# churchtools-js-client

churchtools-js-client is a client written in JavaScript to easily access the
[ChurchTools REST API](https://demo.church.tools/api). Its main benefits include:

- Easy to use abstraction of the login process which handles session cookies and automatically performs a re-login if
  the session expired (using the login token provided).
- Supports both, the old and the new version of the ChurchTools API.
- Automatically requests and handles the submission of CSRF tokens for the old API.
- Can be used in a web application running in a browser or on server-side in a Node.js application.

## Installation

Please use `npm` to install this package in your application:

```npm install @churchtools/churchtools-client```

If your target application is a Node.js application, you will also need to install the packages
`axios-cookiejar-support` and `tough-cookie`. They are not required when targeting a web browser.

### CORS Header Configuration

If you intend to connect to a ChurchTools instance from an application running in a web browser,
any request to the ChurchTools instance is effectively a cross origin request. As a security concept the browser will
block these requests by default.

However, the [CORS mechanism](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) can be used to allow the
respective requests. This requires setting CORS headers on the server side.

If you host your ChurchTools instance on your own server, you need to enable CORS headers in your
`churchtools.config`:

```
access_control_allow_origin=https://your-website-where-you-use-churchtools-js-client.com
access_control_allow_credentials=true
```

Please refer [to the ChurchTools documentation](https://intern.church.tools/?q=churchwiki#WikiView/filterWikicategory_id:0/doc:CORS/follow_redirect:true/)
for more information.

If you use the ChurchTools hosting service, please
[contact the ChurchTools support](https://www.church.tools/de/contact) to set CORS headers.

## Usage Example

The import of the package slightly differs in a web application from a Node.js application:

### Web Application

```html
<script src="node_modules/@churchtools/churchtools-client/dist/churchtools-client.bundled.js"></script>
<script>
    const { churchtoolsClient, activateLogging } = window.churchtoolsClient;

    activateLogging();
    churchtoolsClient.setBaseUrl('https://demo.church.tools');

    churchtoolsClient.get('/whoami').then(whoAmI => {
        console.log(whoAmI);
    }).catch(error => {
        console.error(error);
    });
</script>
```

For a more sophisticated example (including login functionality), please check the examples/Browser/ directory in this
repository. Run `npm install` followed by `npm start` to launch a demo web server which serves a simple test application
running in your browser.

### Node.js Application

```js
const { churchtoolsClient, activateLogging } = require('@churchtools/churchtools-client');
const axiosCookieJarSupport = require('axios-cookiejar-support');
const tough = require('tough-cookie');

churchtoolsClient.setCookieJar(axiosCookieJarSupport.wrapper, new tough.CookieJar());
churchtoolsClient.setBaseUrl('https://demo.church.tools');

activateLogging();
churchtoolsClient.get('/whoami').then(whoAmI => {
    console.dir(whoAmI);
    console.log(`Hello ${whoAmI.firstName}!`);
});
```

For a more sophisticated example (including login functionality), please check the examples/Node.js/ directory in this
repository. Run `npm install` followed by `npm start` to launch the test application.

## General Usage

`churchtoolsClient` when imported as described in the examples above, exposes a range of utility functions to use the
ChurchTools API. In particular, the following functions can be used:

- `setBaseUrl(baseUrl: string)`\
  Set the URL of the ChurchTools instance you want to connect to. Please see below if you want to connect to multiple
  instances.
- `validChurchToolsUrl(baseUrl: string)`\
  Check if the URL points to an actual ChurchTools instance.
- `setCookieJar(axiosCookieJarSupport, jar)`\
  Enable cookie support and automatic session handling. See the example above how to use it.
  This is only required for a Node.js application, not when running in a browser.
- `get(uri: string, params: object)`\
  `post(uri: string, data: object)`\
  `put(uri: string, data: object)`\
  `patch(uri: string, data: object)`\
  `deleteApi(uri: string, data: object)`\
  Send API requests. Please [check the documentation](https://demo.church.tools/api) to see what's available.
- `oldApi(module: string, func: string, params: object)`\
  Send request to ChurchTools' legacy API.
  Please [check the documentation](https://api.church.tools/) to see what's available.

## Connect to multiple ChurchTools instances simultaneously

If your application needs to access multiple ChurchTools instances simultaneously, you will find that
`setBaseUrl` only allows to set a single URL for all following calls.

Instead, an object-wrapped approach can be used to manage and call multiple instances. This is an example for a Node.js
application:

```js
const { ChurchtoolsClient, activateLogging } = require('@churchtools/churchtools-client');

const clientA = new ChurchToolsClient();
clientA.setBaseUrl('https://foobar.church.tools');
clientA.post('/login', {
    username: usernameA,
    password: passwordA
}).then(result => {
    if (result.status === 'success') {
        console.log('Login successful!');
        return clientA.get('/whoami');
    }
}).then(result => {
    console.log('User A: ', result.data);
});

const clientB = new ChurchToolsClient();
clientB.setBaseUrl('https://baz.church.tools');
clientB.post('/login', {
    username: usernameB,
    password: passwordB
}).then(result => {
    if (result.status === 'success') {
        console.log('Login successful!');
        return clientB.get('/whoami');
    }
}).then(result => {
    console.log('User B: ', result.data);
});
```
