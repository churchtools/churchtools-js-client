import { AxiosInstance, AxiosResponse } from 'axios';

/**
 * Does not log at all.
 */
export const LOG_LEVEL_NONE: number & 0;

/**
 * Logs every request and response and outputs HTTP method, URL and request/response body data.
 */
export const LOG_LEVEL_DEBUG: number & 1;

/**
 * Logs every request and response, but only outputs HTTP method and URL (no request/response body data).
 */
export const LOG_LEVEL_INFO: number & 2;

/**
 * Logs responses having an HTTP error code and unsuccessful requests.
 */
export const LOG_LEVEL_ERROR: number & 4;

type logLevel = typeof LOG_LEVEL_NONE | typeof LOG_LEVEL_DEBUG | typeof LOG_LEVEL_INFO | typeof LOG_LEVEL_ERROR;

/**
 * Activates logging of requests and responses to console.
 * @param level The log level or LOG_LEVEL_INFO if not specified.
 */
export function activateLogging(level?: logLevel): void;

/**
 * Deactivates logging to console.
 * Equivalent to activateLogging(LOG_LEVEL_NONE).
 */
export function deactivateLogging(): void;

declare namespace urlHelper {
    /**
     * Adds the 'https://' prefix to a URL if it has no prefix or any prefix other than 'http://' or 'https://'.
     * @param url
     */
    export function toCorrectChurchToolsUrl(url: string): string;
}

/**
 * A custom function to translate translation keys, optionally with arguments.
 */
type translationFunction = (key: string, args?: any[]) => string;

declare namespace errorHelper {
    /**
     * Takes response data and returns a proper translated human readable error message,
     * if the response data represents an error either in the old or new API format.
     * @param error Can be an AxiosResponse object as returned from ChurchToolsClient, or the response data object,
     * an Error or Exception object or just the error message as string.
     * @param translationFunction If translating the error message requires a translation function,
     * this function will be called if set.
     */
    export function getTranslatedErrorMessage(error: any, translationFunction?: translationFunction): string | null;

    /**
     * Returns the translation key for an error message or null, if the error response does not specify
     * an error message.
     * @param error Can be an AxiosResponse object as returned from ChurchToolsClient, or the response data object,
     * an Error or Exception object or just the error message as string.
     */
    export function getErrorMessageKey(error: any): string | null;
}

declare namespace churchtoolsClient{
    /**
     * The ChurchToolsClient class can be used if connections to more than one ChurchTools installation
     * should be established at the same time or if you prefer an object oriented interface.
     * Otherwise you may want to use the functions that are directly exported in this package.
     */
    export class ChurchToolsClient {
        /***
         * Creates a new instance of the ChurchToolsClient.
         * @param churchToolsBaseUrl The URL to the ChurchTools instance to connect to.
         * @param loginToken Login Token of the user to authenticate with, or null if you only need public APIs.
         * @param loadCSRFForOldApi If set to true, the ChurchTools client will automatically fetch and manage
         * CSRF tokens which might be required to calls to the old API. This is not required if you'll only use
         * the new API. Default is false.
         */
        constructor(churchToolsBaseUrl?: string, loginToken?: string, loadCSRFForOldApi?: boolean);

        /**
         * Sets or updates the URL to the ChurchTools instance to connect to.
         * @param baseUrl The URL to the ChurchTools instance to connect to.
         */
        setBaseUrl(baseUrl: string): void;

        /**
         * Updates the time span to be wait before repeating the request if the ChurchToolsClient gets a rate limit
         * response. Default is 30000 (30 seconds).
         * @param timeoutInMs Delay in ms.
         */
        setRateLimitTimeout(timeoutInMs: number): void;

        /**
         * Sets the milliseconds to wait until a request is cancelled
         * @param timeoutInMs Delay in ms.
         */
        setTimeout(timeoutInMs: number): void;

        /**
         * Enables that cross sites requests should be made with sending credentials.
         */
        enableCrossOriginRequests(): void;

        /**
         * Sends a call to the old ChurchTools API.
         * @param module The module which should retrieve the call.
         * @param func The function to be called.
         * @param params Additional request parameters.
         */
        oldApi(module: string, func: string, params?: object): Promise<any>;

        /**
         * Enables that the ChurchTools client will automatically fetch and manage
         * CSRF tokens which might be required to calls to the old API. This is not required if you'll only use
         * the new API.
         */
        setLoadCSRFForOldAPI(): void;

        /**
         * Sends a GET request to the ChurchTools API.
         * @param uri Either the full URL or the part after "/api".
         * @param params Optional request parameters.
         * @param rawResponse If true, it will return the full AxiosResponse object, otherwise only the response data.
         * Defaults to false.
         */
        get(uri: string, params?: object, rawResponse?: boolean): Promise<AxiosResponse|any>;

        /**
         * Returns all data from a paginated API by calling multiple requests and concatenating the result.
         * @param uri Either the full URL or the part after "/api".
         * @param params Optional request parameters.
         * @param resultsPerPage Optional param defining how many results should be fetched per page. default = 100
         */
        getAllPages(uri: string, params?: object, resultsPerPage?: number): Promise<any[]>;

        /**
         * Sends a PUT request to the ChurchTools API.
         * @param uri Either the full URL or the part after "/api".
         * @param data Optional request body data.
         */
        put(uri: string, data?: any): Promise<any>;

        /**
         * Sends a POST request to the ChurchTools API.
         * @param uri Either the full URL or the part after "/api".
         * @param data Optional request body data.
         */
        post(uri: string, data?: any): Promise<any>;

        /**
         * Sends a PATCH request to the ChurchTools API.
         * @param uri Either the full URL or the part after "/api".
         * @param data Optional request body data.
         */
        patch(uri: string, data?: any): Promise<any>;

        /**
         * Sends a DELETE request to the ChurchTools API.
         * @param uri Either the full URL or the part after "/api".
         * @param data Optional request body data.
         */
        deleteApi(uri: string, data?: any): Promise<any>;

        /**
         * Activates an Axios interceptor which will automatically login using the specified
         * loginToken and personId if the API returns an 401 Unauthorized error. The ChurchToolsClient will then
         * automatically resend the request.
         * @param loginToken Login token for the user to be authenticated with.
         * @param personId The person ID of the user to be authenticated with.
         */
        setUnauthorizedInterceptor(loginToken?: string, personId?: number): void;

        /**
         * Sets a function which will be called if the try to (re-)login using the unauthorized interceptor fails.
         * @param callback Function which will be called if the try to (re-)login using the unauthorized interceptor
         * fails.
         */
        onUnauthenticated(callback: () => void): void;

        /**
         * Activates an Axios interceptor which will automatically resend the request after the specified
         * timeoutInMs if a rate limit error occurs.
         * @param timeoutInMs Optionally (re-)sets the delay to wait until re-send. Defaults to 30000 ms.
         */
        setRateLimitInterceptor(timeoutInMs?: number): void;

        /**
         * Checks if the ChurchToolsClient can connect to the given URL as a valid ChurchTools instance.
         * Optionally it checks if some version requirements are set, e.g. if you require a certain API level.
         * @param url The URL to check for.
         * @param minimalBuildNumber A minimal build number you want the ChurchTools instance to have.
         * @param minimalVersion A minimal version you want the ChurchTools instance to have.
         */
        validChurchToolsUrl(url: string, minimalBuildNumber?: number, minimalVersion?: string): Promise<string>;

        /**
         * Enables support for storing credential cookies on systems that do not support cookie storage by default
         * (e.g. on Node JS environments). Not required when running on web browsers.
         * @param axiosCookieJarSupport An instance of axios-cookiejar-support.
         * @param jar An instance of a Cookie jar, e.g. from tough-cookie package.
         */
        setCookieJar(axiosCookieJarSupport: (instance: AxiosInstance) => AxiosInstance, jar: object): void;
    }

    /**
     * Set or update the URL to the ChurchTools instance to connect to.
     * @param baseUrl The URL to the ChurchTools instance to connect to.
     */
    export function setBaseUrl(baseUrl: string): void;

    /**
     * Updates the time span to be wait before repeating the request if the ChurchToolsClient gets a rate limit
     * response. Default is 30000 (30 seconds).
     * @param timeoutInMs Delay in ms.
     */
    export function setRateLimitTimeout(timeoutInMs: number): void;

    /**
     * Sets the milliseconds to wait until a request is cancelled
     * @param timeoutInMs Delay in ms.
     */
    export function setTimeout(timeoutInMs: number): void;

    /**
     * Enables that cross sites requests should be made with sending credentials.
     */
    export function enableCrossOriginRequests(): void;

    /**
     * Sends a call to the old ChurchTools API.
     * @param module The module which should retrieve the call.
     * @param func The function to be called.
     * @param params Additional request parameters.
     */
    export function oldApi(module: string, func: string, params?: object): Promise<any>;

    /**
     * Enables that the ChurchTools client will automatically fetch and manage
     * CSRF tokens which might be required to calls to the old API. This is not required if you'll only use
     * the new API.
     */
    export function setLoadCSRFForOldAPI(): void;

    /**
     * Sends a GET request to the ChurchTools API.
     * @param uri Either the full URL or the part after "/api".
     * @param params Optional request parameters.
     * @param rawResponse If true, it will return the full AxiosResponse object, otherwise only the response data.
     * Defaults to false.
     */
    export function get(uri: string, params?: object, rawResponse?: boolean): Promise<AxiosResponse|any>;

    /**
     * Returns all data from a paginated API by calling multiple requests and concatenating the result.
     * @param uri Either the full URL or the part after "/api".
     * @param params Optional request parameters.
     * @param resultsPerPage Optional param defining how many results should be fetched per page. default = 100
     */
    export function getAllPages(uri: string, params?: object, resultsPerPage?: number): Promise<any[]>;

    /**
     * Sends a PUT request to the ChurchTools API.
     * @param uri Either the full URL or the part after "/api".
     * @param data Optional request body data.
     */
    export function put(uri: string, data?: any): Promise<any>;

    /**
     * Sends a POST request to the ChurchTools API.
     * @param uri Either the full URL or the part after "/api".
     * @param data Optional request body data.
     */
    export function post(uri: string, data?: any): Promise<any>;

    /**
     * Sends a PATCH request to the ChurchTools API.
     * @param uri Either the full URL or the part after "/api".
     * @param data Optional request body data.
     */
    export function patch(uri: string, data?: any): Promise<any>;

    /**
     * Sends a DELETE request to the ChurchTools API.
     * @param uri Either the full URL or the part after "/api".
     * @param data Optional request body data.
     */
    export function deleteApi(uri: string, data?: any): Promise<any>;

    /**
     * Activates an Axios interceptor which will automatically login using the specified
     * loginToken and personId if the API returns an 401 Unauthorized error. The ChurchToolsClient will then
     * automatically resend the request.
     * @param loginToken Login token for the user to be authenticated with.
     * @param personId The person ID of the user to be authenticated with.
     */
    export function setUnauthorizedInterceptor(loginToken?: string, personId?: number): void;

    /**
     * Sets a function which will be called if the try to (re-)login using the unauthorized interceptor fails.
     * @param callback Function which will be called if the try to (re-)login using the unauthorized interceptor
     * fails.
     */
    export function onUnauthenticated(callback: () => void): void;

    /**
     * Activates an Axios interceptor which will automatically resend the request after the specified
     * timeoutInMs if a rate limit error occurs.
     * @param timeoutInMs Optionally (re-)sets the delay to wait until re-send. Defaults to 30000 ms.
     */
    export function setRateLimitInterceptor(timeoutInMs?: number): void;

    /**
     * Checks if the ChurchToolsClient can connect to the given URL as a valid ChurchTools instance.
     * Optionally it checks if some version requirements are set, e.g. if you require a certain API level.
     * @param url The URL to check for.
     * @param minimalBuildNumber A minimal build number you want the ChurchTools instance to have.
     * @param minimalVersion A minimal version you want the ChurchTools instance to have.
     */
    export function validChurchToolsUrl(url: string, minimalBuildNumber?: number, minimalVersion?: string): Promise<string>;

    /**
     * Enables support for storing credential cookies on systems that do not support cookie storage by default
     * (e.g. on Node JS environments). Not required when running on web browsers.
     * @param axiosCookieJarSupport An instance of axios-cookiejar-support.
     * @param jar An instance of a Cookie jar, e.g. from tough-cookie package.
     */
    export function setCookieJar(axiosCookieJarSupport: (instance: AxiosInstance) => AxiosInstance, jar: object): void;
}
