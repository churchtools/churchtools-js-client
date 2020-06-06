# ChurchTools JS Client

JS-Client, um einfach auf ChurchTools zuzugreifen. Für bestimmte API-Calls existieren dedizierte Funktionen (siehe churchtoolsApi.js), für alle anderen APIs können generische get/post/put/delete Funktionen verwendet werden (siehe churchtoolsClient.js).

Session-Cookies werden nach dem Login automatisch gespeichert und für die folgenden Calls verwendet. Wenn die Session abläuft, wird ein automatischer Relogin versucht, sofern beim ChurchTools-Client ein Login-Tokin hinterlegt wurde.

## Installation

`npm install churchtools-client@git+ssh://git@gitlab.ct-srv.de:2222/churchtools/churchtools-js-client.git`

## Nutzung in einer Web-Anwendung

Beim Import von `churchtools-client` wird automatisch das mit Webpack gepackte churchtools-client.js Bundle aus dem dist-Verzeichnis verwendet.

```
import { churchtoolsApi, churchtoolsClient, activateLogging } from 'churchtools-client';

if (__DEV__) {
    activateLogging();
}

churchtoolsClient.setBaseUrl('https://foobar.church.tools');
const result = await churchtoolsApi.login(this.state.username, this.state.password);
if (result.status === 'success') {
    console.log('Login successful!');
    const whoami = await churchtoolsClient.get('/whoami');
    console.dir(whoami);
}
```

## Nutzung in einer Node.js-Anwendung

Es existiert im dist-Verzeichnis ein extra Webpack-Bundle für node.js.

 ```
const ctcPackage = require('churchtools-client/dist/churchtools-client-node.js').churchtoolsClient;
const { churchtoolsApi, churchtoolsClient, activateLogging } = ctcPackage;
 
if (__DEV__) {
    activateLogging();
}

churchtoolsClient.setBaseUrl('https://foobar.church.tools');
const result = await churchtoolsApi.login(this.state.username, this.state.password);
if (result.status === 'success') {
    console.log('Login successful!');
    const whoami = await churchtoolsClient.get('/whoami');
    console.dir(whoami);
}
 ```

## Auf mehrere ChurchTools-Installationen gleichzeitig zugreifen

Wenn auf mehrere ChurchTools-Installationen gleichzeitig zugegriffen werden soll (z.B. für einen Service, der Daten von mehrere CT-Installationen abruft), sind die direkten Funktionsaufrufe ungünstig, da immer nur eine URL via `setBaseUrl` für alle folgenden Aufrufe gesetzt werden kann.

Aus diesem Grund gibt es die Möglichkeit, den `ChurchToolsClient` als Objekt zu instantiieren. Alle Basis-Funktionen aus `churchtoolsClient.js` können dann über dieses Objekt ausgeführt werden. Für die vordefinierten API-Calls aus `churchtoolsApi.js` besteht diese Möglichkeit noch nicht.

Beispiel mit dem Node.js-Bundle:
```
const ctcPackage = require('churchtools-client/dist/churchtools-client-node.js').churchtoolsClient;
const ChurchToolsClient = ctcPackage.churchtoolsClient.ChurchToolsClient;
 
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

## Release-Version bauen

1. `npm run build`
2. Änderungen im `build` Ordner comitten.
3. Neuen Tag erstellen `git tag v0.1.2`
4. Tag und code pushen `git push --tags`

