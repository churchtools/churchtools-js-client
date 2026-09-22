import {
  churchtoolsClient,
  activateLogging,
  LOG_LEVEL_INFO,
  errorHelper,
} from '@churchtools/churchtools-client';
import type { paths } from '../types/churchtools-api';

const axiosCookieJarSupport = require('axios-cookiejar-support');
const tough = require('tough-cookie');

// Type definitions from generated OpenAPI types
type WhoAmIResponse =
  paths['/whoami']['get']['responses']['200']['content']['application/json'];
type AppointmentsResponse =
  paths['/calendars/appointments']['get']['responses']['200']['content']['application/json'];
type AppointmentsParams =
  paths['/calendars/appointments']['get']['parameters']['query'];

export class ChurchToolsApiClient {
  private isInitialized = false;
  private isLoggedIn = false;

  constructor(
    private config: {
      BASE_URL: string;
      TOKEN?: string;
      USERNAME?: string;
      PASSWORD?: string;
    },
  ) {}

  private initClient() {
    if (this.isInitialized) return;

    churchtoolsClient.setCookieJar(
      axiosCookieJarSupport.wrapper,
      new tough.CookieJar(),
    );
    churchtoolsClient.setBaseUrl(this.config.BASE_URL);
    activateLogging(LOG_LEVEL_INFO);

    this.isInitialized = true;
  }

  async login(): Promise<boolean> {
    this.initClient();

    if (this.isLoggedIn) return true;

    try {
      if (this.config.TOKEN) {
        churchtoolsClient.setUnauthorizedInterceptor(this.config.TOKEN);
        await churchtoolsClient.get('/contactlabels');
        console.log('Login with token successful.');
      } else {
        await churchtoolsClient.post('/login', {
          username: this.config.USERNAME,
          password: this.config.PASSWORD,
        });
        console.log('Login successful.');
      }

      this.isLoggedIn = true;
      return true;
    } catch (error) {
      console.error(
        'Login failed:',
        errorHelper.getTranslatedErrorMessage(error),
      );
      throw error;
    }
  }

  async whoAmI(): Promise<WhoAmIResponse> {
    await this.ensureLoggedIn();
    return churchtoolsClient
      .get<WhoAmIResponse>('/whoami', {}, true)
      .then((response) => response.data);
  }

  async getAppointments(
    params?: AppointmentsParams,
  ): Promise<AppointmentsResponse> {
    await this.ensureLoggedIn();
    return churchtoolsClient.get<AppointmentsResponse>('/calendars/appointments', params, true).then((response) => response.data);
  }

  async getCalendarAppointmentsByCalendarId(
    calendarId: number,
  ): Promise<AppointmentsResponse> {
    return this.getAppointments({ 'calendar_ids[]': [calendarId] });
  }

  private async ensureLoggedIn(): Promise<void> {
    if (!this.isLoggedIn) {
      await this.login();
    }
  }

  // Helper method for error handling
  handleError(error: any): string {
    return errorHelper.getTranslatedErrorMessage(error);
  }
}
