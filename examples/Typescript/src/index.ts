import 'dotenv/config';
import { ChurchToolsApiClient } from './clients/churchtools-api';
import config from './config';

const ctClient = new ChurchToolsApiClient(config);

ctClient.whoAmI().then((response) => {
  console.log('WhoAmI Response:', response.data.firstName);
});
