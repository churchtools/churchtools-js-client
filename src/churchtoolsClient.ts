import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios';
import { logRequest, logResponse, logError, logMessage, logWarning } from './logging';
import { toCorrectChurchToolsUrl } from './urlHelper';
import { NoJSONError } from './NoJSONError';
import packageJson from '../package.json';

const MINIMAL_CHURCHTOOLS_BUILD_VERSION = 31413;
const MINIMAL_CHURCHTOOLS_VERSION = '3.54.2';
const DEFAULT_TIMEOUT = 15000;
const RATE_LIMIT_TIMEOUT = 30000;
const STATUS_UNAUTHORIZED = 401;
const STATUS_RATELIMITED = 429;
const CUSTOM_RETRY_PARAM = 'X-retry-login';
const ENFORCE_JSON_PARAM = 'X-enforce-json';

export type Params = Record<string, any>;

export type RawResponse<Result> =
    | {
          data: Result;
      }
    | {
          data: { data: Result };
      };

export type PageResponse<Result> = {
    data: {
        data: Result;
        meta: {
            pagination: {
                lastPage: number;
            };
        };
    };
};

type Resolver<Result> = (result: Result | PromiseLike<Result>) => void;
type Rejecter = (error: any) => void;

type RequestOptions = { enforceJSON?: boolean; needsAuthentication?: boolean; timeout?: number };
type GetOptions = RequestOptions & { rawResponse?: boolean; callDeferred?: boolean };
type PutOptions = RequestOptions;
type PostOptions = RequestOptions & { abortController?: AbortController };
type DeleteOptions = RequestOptions;
type PatchOptions = RequestOptions;

class ChurchToolsClient {
    private churchToolsBaseUrl?: string;
    private csrfToken?: string;
    private loadCSRFForOldApi: boolean;
    private ax: AxiosInstance;
    private unauthorizedInterceptorId?: number;
    private unauthenticatedCallbacks: ((info: { error?: Error; url?: string; baseUrl?: string }) => void)[] = [];
    private rateLimitInterceptorId?: number;
    private firstRequestStarted = false;
    private firstRequestCompleted = false;
    private loginRunning = false;
    private deferredRequestCallbacks: (() => void)[] = [];
    private requestTimeout = DEFAULT_TIMEOUT;
    private rateLimitTimeout = RATE_LIMIT_TIMEOUT;
    private currentLoginPromise?: Promise<any>;

    private needsAuthentication: boolean | undefined;
    private hasToken = false;

    private enforceJSON = false;

    public ChurchToolsClient = ChurchToolsClient;

    constructor(churchToolsBaseUrl?: string, loginToken?: string, loadCSRFForOldApi = false) {
        this.churchToolsBaseUrl = churchToolsBaseUrl;
        this.loadCSRFForOldApi = loadCSRFForOldApi;
        this.ax = axios.create({
            baseURL: churchToolsBaseUrl,
            withCredentials: true,
            headers: {
                'User-Agent': `churchtools-js-client/${packageJson.version}`,
            },
        });

        this.ax.interceptors.request.use(logRequest, logError);
        this.ax.interceptors.response.use((response) => {
            logResponse(response);
            this.checkResponse(response);
            return response;
        }, logError);

        // Set headers for authentication
        this.ax.interceptors.request.use((config) => {
            // The backend only checks if the header is set. So if the header is set to false, remove it
            if (config.headers?.['X-OnlyAuthenticated'] === '0') {
                delete config.headers['X-OnlyAuthenticated'];
            } else if (!config.headers?.['X-OnlyAuthenticated'] && (this.needsAuthentication ?? this.hasToken)) {
                config.headers = config.headers ?? {};
                config.headers['X-OnlyAuthenticated'] = '1';
            }
            return config;
        });

        this.setUnauthorizedInterceptor(loginToken);
    }

    setNeedsAuthentication(needsAuthentication: boolean) {
        this.needsAuthentication = needsAuthentication;
    }

    /**
     * Sets the default ChurchTools url.
     *
     * @param {string} baseUrl The ChurchTools Base url to use
     */
    setBaseUrl(baseUrl: string) {
        this.churchToolsBaseUrl = baseUrl.replace(/\/$/, '');
    }

    getBaseUrl() {
        return this.churchToolsBaseUrl;
    }

    setRateLimitTimeout(timeoutInMs: number) {
        this.rateLimitTimeout = timeoutInMs;
    }

    setRequestTimeout(timeoutInMs: number) {
        this.requestTimeout = timeoutInMs;
    }

    delay(t: number) {
        return new Promise(function (resolve) {
            setTimeout(resolve, t);
        });
    }

    /**
     * Defer the execution of requests until the first request and any login requests have been completed.
     *
     * @param callback Function which calls the request
     */
    deferredExecution(callback: () => Promise<any>) {
        if ((this.firstRequestStarted && !this.firstRequestCompleted) || this.loginRunning) {
            this.deferredRequestCallbacks.push(callback);
        } else {
            this.firstRequestStarted = true;
            callback().finally(() => {
                this.firstRequestCompleted = true;
                this.processDeferredRequestCallbacks();
            });
        }
    }

    processDeferredRequestCallbacks() {
        let callback;
        while ((callback = this.deferredRequestCallbacks.pop()) !== undefined) {
            callback();
        }
    }

    enableCrossOriginRequests() {
        this.ax.defaults.withCredentials = true;
    }

    setUserAgent(userAgent: string) {
        this.ax.defaults.headers['User-Agent'] = userAgent;
    }

    buildOldRequestObject(func: string, params: Params) {
        return Object.assign({}, params, { func: func });
    }

    responseToData<Data>(response: RawResponse<Data>) {
        if (response.data && typeof response.data === 'object' && 'data' in response.data) {
            return response.data.data;
        } else {
            return response.data;
        }
    }

    getAbortSignal(abortController: AbortController = new AbortController(), timeout?: number) {
        setTimeout(() => {
            abortController.abort();
        }, timeout ?? this.requestTimeout);
        return abortController.signal;
    }

    /**
     * Calls the old ChurchTools Api
     *
     * @param {string} module defines which module that should be queried
     * @param {string} func defines the function that should be called in the module
     * @param {object} params additional params passed to the called function
     *
     * @returns {Promise}
     */
    oldApi(module: string, func: string, params: Params = {}) {
        this.loadCSRFForOldApi = true;
        return new Promise((resolve, reject) => {
            this.deferredExecution(() =>
                Promise.resolve()
                    .then(() => {
                        if (this.csrfToken) {
                            return;
                        }
                        return this.get('/csrftoken', {}, false, false).then((response) => {
                            if (typeof response === 'string') {
                                this.csrfToken = response;
                            }
                        });
                    })
                    .then(() => {
                        return this.ax.post(
                            `${this.churchToolsBaseUrl}/?q=${module}`,
                            this.buildOldRequestObject(func, params),
                            {
                                headers: {
                                    'CSRF-Token': this.csrfToken ?? '',
                                },
                                signal: this.getAbortSignal(),
                            },
                        );
                    })
                    .then((response) => {
                        if (response.data.status === 'success') {
                            resolve(this.responseToData(response));
                        } else {
                            reject({ response: response });
                        }
                    })
                    .catch((error) => {
                        reject(error);
                    }),
            );
        });
    }

    setLoadCSRFForOldAPI() {
        this.loadCSRFForOldApi = true;
    }

    private checkResponse(response: AxiosResponse) {
        const enforceJSON =
            response.config?.data?.[ENFORCE_JSON_PARAM] ??
            response.config?.params?.[ENFORCE_JSON_PARAM] ??
            this.enforceJSON;
        if (enforceJSON && response.status !== 204 && response.data && typeof response.data !== 'object') {
            throw new NoJSONError(
                `Request to '${response.config.url}' returned no JSON. Return value is:\n ${response.data}`,
            );
        }
    }

    setEnforceJSON(enforceJSON: boolean) {
        this.enforceJSON = enforceJSON;
    }

    buildUrl(uri: string) {
        if (uri.startsWith('http')) {
            return uri;
        }
        return `${this.churchToolsBaseUrl}/api${uri}`;
    }

    get<ResponseType>(
        uri: string,
        params?: Params,
        rawResponse?: boolean,
        callDeferred?: boolean,
    ): Promise<ResponseType>;
    get<ResponseType>(uri: string, params?: Params, options?: GetOptions): Promise<ResponseType>;
    get<ResponseType>(
        uri: string,
        params = {},
        rawResponseOrOptions: boolean | GetOptions = false,
        callDeferred = true,
    ) {
        const rawResponse =
            typeof rawResponseOrOptions === 'object'
                ? (rawResponseOrOptions.rawResponse ?? false)
                : rawResponseOrOptions;
        callDeferred =
            typeof rawResponseOrOptions === 'object' ? (rawResponseOrOptions.callDeferred ?? true) : callDeferred;
        const enforceJson = typeof rawResponseOrOptions === 'object' ? rawResponseOrOptions.enforceJSON : undefined;
        const needsAuthentication =
            typeof rawResponseOrOptions === 'object' ? rawResponseOrOptions.needsAuthentication : undefined;

        const headers: Record<string, any> = {};
        if (needsAuthentication !== undefined) {
            headers['X-OnlyAuthenticated'] = needsAuthentication ? '1' : '0';
        }

        const cb = (resolve: Resolver<ResponseType>, reject: Rejecter) =>
            this.ax
                .get(this.buildUrl(uri), {
                    params: { ...params, [ENFORCE_JSON_PARAM]: enforceJson },
                    signal: this.getAbortSignal(),
                    headers,
                })
                .then((response) => {
                    if (rawResponse) {
                        resolve(response as ResponseType);
                    } else {
                        resolve(this.responseToData(response as RawResponse<ResponseType>));
                    }
                })
                .catch((error) => {
                    reject(error);
                });

        return new Promise<ResponseType>((resolve, reject) => {
            if (callDeferred) {
                this.deferredExecution(() => cb(resolve, reject));
            } else {
                cb(resolve, reject);
            }
        });
    }

    getAllPages<ResponseType>(uri: string, params: Params = {}, resultsPerPage = 100) {
        params.limit = resultsPerPage;

        return new Promise<ResponseType[]>((resolve, reject) => {
            this.getAllPagesInternal(uri, params, 1, resolve, reject);
        });
    }

    getAllPagesInternal<ResponseType>(
        uri: string,
        params: Params,
        page: number,
        resolve: Resolver<ResponseType[]>,
        reject: Rejecter,
        result: ResponseType[] = [],
    ) {
        params.page = page;
        this.get<PageResponse<ResponseType[]>>(uri, params, true)
            .then((response) => {
                result.push(...this.responseToData<ResponseType[]>(response));
                if (response.data.meta.pagination.lastPage > page) {
                    this.getAllPagesInternal(uri, params, page + 1, resolve, reject, result);
                } else {
                    resolve(result);
                }
            })
            .catch(reject);
    }

    put<ResponseType>(uri: string, data: Params, options: PutOptions = {}) {
        return new Promise<ResponseType>((resolve, reject) => {
            const needsAuthentication = options.needsAuthentication;

            const headers: Record<string, any> = {};
            if (needsAuthentication !== undefined) {
                headers['X-OnlyAuthenticated'] = needsAuthentication ? '1' : '0';
            }

            this.deferredExecution(() =>
                this.ax
                    .put(
                        this.buildUrl(uri),
                        {
                            ...data,
                            [ENFORCE_JSON_PARAM]: options?.enforceJSON,
                        },
                        { signal: this.getAbortSignal(undefined, options.timeout), headers },
                    )
                    .then((response) => {
                        resolve(this.responseToData(response));
                    })
                    .catch((error) => {
                        reject(error);
                    }),
            );
        });
    }

    post<ResponseType>(uri: string, data: Params = {}, options: PostOptions = {}) {
        // FormData will be sent as multipart/form-data and the CT server requires a CSRF token for such a request
        // React-Native mangles the constructor.name. Therefore, another check must be applied to react-native
        const isNodeJsFormData = data && data.constructor && data.constructor.name === 'FormData';
        const isBrowserOrReactNativeFormData = globalThis.FormData && data instanceof globalThis.FormData;
        const needsCsrfToken = isNodeJsFormData || isBrowserOrReactNativeFormData;
        const needsAuthentication = options.needsAuthentication;

        const headers: Record<string, any> = {};
        if (needsAuthentication !== undefined) {
            headers['X-OnlyAuthenticated'] = needsAuthentication ? '1' : '0';
        }

        return new Promise<ResponseType>((resolve, reject) => {
            this.deferredExecution(() =>
                Promise.resolve()
                    .then(() => {
                        if (!needsCsrfToken || this.csrfToken) {
                            return Promise.resolve();
                        }
                        return this.get('/csrftoken', undefined, { callDeferred: false }).then((response) => {
                            if (typeof response === 'string') {
                                this.csrfToken = response;
                            }
                        });
                    })
                    .then(() => {
                        const config: AxiosRequestConfig<Params> = {
                            headers,
                        };
                        if (needsCsrfToken) {
                            config.headers = {
                                ...config.headers,
                                'CSRF-Token': this.csrfToken ?? '',
                            };
                        }
                        config.signal = this.getAbortSignal(options.abortController, options.timeout);

                        return this.ax.post(
                            this.buildUrl(uri),
                            needsCsrfToken
                                ? data
                                : {
                                      ...data,
                                      [ENFORCE_JSON_PARAM]: options.enforceJSON,
                                  },
                            config,
                        );
                    })
                    .then((response) => {
                        resolve(this.responseToData(response));
                    })
                    .catch((error) => {
                        reject(error);
                    }),
            );
        });
    }

    patch<ResponseType>(uri: string, data: Params = {}, options: PatchOptions = {}) {
        const needsAuthentication = options.needsAuthentication;

        const headers: Record<string, any> = {};
        if (needsAuthentication !== undefined) {
            headers['X-OnlyAuthenticated'] = needsAuthentication ? '1' : '0';
        }

        return new Promise<ResponseType>((resolve, reject) => {
            this.deferredExecution(() =>
                this.ax
                    .patch(
                        this.buildUrl(uri),
                        {
                            ...data,
                            [ENFORCE_JSON_PARAM]: options.enforceJSON,
                        },
                        { signal: this.getAbortSignal(undefined, options.timeout), headers },
                    )
                    .then((response) => {
                        resolve(this.responseToData(response));
                    })
                    .catch((error) => {
                        reject(error);
                    }),
            );
        });
    }

    deleteApi<ResponseType>(uri: string, data: Params = {}, options: DeleteOptions = {}) {
        const needsAuthentication = options.needsAuthentication;

        const headers: Record<string, any> = {};
        if (needsAuthentication !== undefined) {
            headers['X-OnlyAuthenticated'] = needsAuthentication ? '1' : '0';
        }

        return new Promise<ResponseType>((resolve, reject) => {
            this.deferredExecution(() =>
                this.ax
                    .delete(this.buildUrl(uri), {
                        data: { ...data, [ENFORCE_JSON_PARAM]: options?.enforceJSON },
                        signal: this.getAbortSignal(undefined, options?.timeout),
                        headers,
                    })
                    .then((response) => {
                        resolve(this.responseToData(response));
                    })
                    .catch((error) => {
                        reject(error);
                    }),
            );
        });
    }

    notifyUnauthenticated(data: { error?: Error; url?: string; baseUrl?: string }) {
        logMessage('Notifying unauthenticated.');
        this.unauthenticatedCallbacks.forEach((callback) => callback(data));
    }

    loginWithToken(loginToken: string, personId?: number) {
        if (!this.currentLoginPromise) {
            this.loginRunning = true;
            this.currentLoginPromise = this.get(
                '/whoami',
                {
                    login_token: loginToken,
                    user_id: personId,
                    no_url_rewrite: true,
                    [CUSTOM_RETRY_PARAM]: true,
                },
                {
                    rawResponse: false,
                    callDeferred: false,
                },
            )
                .then(() => {
                    logMessage('Successfully logged in again with login token');
                    if (this.csrfToken || !this.loadCSRFForOldApi) {
                        this.csrfToken = undefined;
                        return true;
                    }
                    return this.get('/csrftoken', {}, false, false).then((response) => {
                        if (typeof response === 'string') {
                            this.csrfToken = response;
                        }
                        return true;
                    });
                })
                .then((res) => {
                    this.loginRunning = false;
                    this.currentLoginPromise = undefined;
                    return res;
                })
                .catch((e) => {
                    logError(e).catch(() => {}); // catch is needed as logError can return a rejected promise
                    this.loginRunning = false;
                    this.currentLoginPromise = undefined;
                    throw e;
                });
        }
        return this.currentLoginPromise;
    }

    retryWithLogin(
        config: AxiosRequestConfig,
        loginToken: string,
        personId: undefined | number,
        resolve: Resolver<AxiosResponse>,
        reject: Rejecter,
        previousError: any,
    ) {
        logWarning('Trying transparent relogin with login token');
        this.loginWithToken(loginToken, personId)
            .then(() => {
                if (config.headers) {
                    config.headers['CSRF-Token'] = this.csrfToken ?? '';
                } else {
                    config.headers = {
                        'CSRF-Token': this.csrfToken ?? '',
                    };
                }
                config.signal = this.getAbortSignal();
                config.httpAgent = undefined;
                config.httpsAgent = undefined;
                this.ax
                    .request(config)
                    .then((response) => {
                        resolve(response);
                    })
                    .catch((error) => {
                        if (
                            (error.response && error.response.status) === STATUS_UNAUTHORIZED ||
                            (error.response &&
                                error.response.message &&
                                error.response.data.message === 'Session expired!')
                        ) {
                            logMessage('Failed to login with login token', error);
                            reject(error);
                            this.notifyUnauthenticated({ error, url: config.url, baseUrl: config.baseURL });
                        } else {
                            reject(error);
                        }
                    });
            })
            .catch(() => {
                reject(previousError);
            });
    }

    setUnauthorizedInterceptor(loginToken?: string, personId?: number) {
        if (this.unauthorizedInterceptorId !== undefined) {
            this.ax.interceptors.response.eject(this.unauthorizedInterceptorId);
        }

        const handleUnauthorized = (response: AxiosResponse, errorObject?: any) =>
            new Promise<AxiosResponse>((resolve, reject) => {
                if (response && response.status === STATUS_UNAUTHORIZED) {
                    if (response.config && response.config.params && response.config.params[CUSTOM_RETRY_PARAM]) {
                        this.notifyUnauthenticated({
                            error: errorObject,
                            url: response.config.url,
                            baseUrl: response.config.baseURL,
                        });
                        reject(errorObject || response);
                    } else {
                        logMessage('Got 401 session expired');
                        if (loginToken) {
                            this.retryWithLogin(response.config, loginToken, personId, resolve, reject, response);
                        } else {
                            this.notifyUnauthenticated({
                                error: errorObject,
                                url: response.config.url,
                                baseUrl: response.config.baseURL,
                            });
                            reject(errorObject || response);
                        }
                    }
                } else {
                    reject(errorObject || response);
                }
            });

        this.unauthorizedInterceptorId = this.ax.interceptors.response.use(
            (response: AxiosResponse) => {
                // onFullfilled (this current function) is called by Axios in case of a 2xx status code.
                // So technically we should be here only in case of a successful request.
                // However, the old ChurchTools API returns { message: 'Session expired' } and a 200 status code
                // in case the user is not currently authorized. That's why we need to fetch and handle this case here.
                // Additionally for some unknown reason, when using axios-cookiejar-support Axios also calls
                // onFullfilled instead of onRejected in case of a 401. That's why we also check for
                // STATUS_UNAUTHORIZED here and handle this case accordingly.
                if (
                    response.status === STATUS_UNAUTHORIZED ||
                    (response.data && response.data.message === 'Session expired!')
                ) {
                    response.status = STATUS_UNAUTHORIZED;
                    return handleUnauthorized(response);
                } else {
                    return Promise.resolve(response);
                }
            },
            (errorObject) => handleUnauthorized(errorObject.response, errorObject),
        );
        this.hasToken = !!loginToken;
    }

    onUnauthenticated(callback: (info: { error?: Error; url?: string; baseUrl?: string }) => void) {
        this.unauthenticatedCallbacks.push(callback);
    }

    setRateLimitInterceptor(timeoutInMs = null) {
        if (timeoutInMs) {
            this.setRateLimitTimeout(timeoutInMs);
        }
        if (this.rateLimitInterceptorId !== undefined) {
            this.ax.interceptors.response.eject(this.rateLimitInterceptorId);
        }

        const handleRateLimited = (response: AxiosResponse, errorObject?: any) =>
            new Promise<AxiosResponse>((resolve, reject) => {
                if (response && response.status === STATUS_RATELIMITED) {
                    logMessage('rate limit reached, waiting ' + this.rateLimitTimeout + ' milliseconds.');
                    this.delay(this.rateLimitTimeout)
                        .then(() => {
                            response.config.signal = this.getAbortSignal();
                            return this.ax.request(response.config);
                        })
                        .then((response) => {
                            resolve(response);
                        })
                        .catch((error) => {
                            reject(error);
                        });
                } else {
                    reject(errorObject || response);
                }
            });

        this.rateLimitInterceptorId = this.ax.interceptors.response.use(
            (response: AxiosResponse) => {
                // onFullfilled (this current function) is called by Axios in case of a 2xx status code.
                // So technically we should be here only in case of a successful request.
                // However, for some unknown reason, when using axios-cookiejar-support Axios also calls
                // onFullfilled instead of onRejected in case of a 429. That's why we also check for
                // STATUS_RATELIMITED here and handle this case accordingly.

                if (response.status === STATUS_RATELIMITED) {
                    return handleRateLimited(response);
                } else {
                    return Promise.resolve(response);
                }
            },
            (errorObject) => handleRateLimited(errorObject.response, errorObject),
        );
    }

    validChurchToolsUrl(
        url: string,
        compareBuild = MINIMAL_CHURCHTOOLS_BUILD_VERSION,
        minimalVersion = MINIMAL_CHURCHTOOLS_VERSION,
    ) {
        const infoApiPath = '/api/info';
        const infoEndpoint = `${toCorrectChurchToolsUrl(url)}${infoApiPath}`;
        return new Promise((resolve, reject) => {
            this.ax
                .get(infoEndpoint, {
                    signal: this.getAbortSignal(),
                    headers: {
                        'X-OnlyAuthenticated': '0',
                    },
                })
                .then((response) => {
                    const build = parseInt(response.data.build);
                    if (build >= compareBuild) {
                        if (response.request.responseURL !== infoEndpoint && response.request.responseURL) {
                            resolve(response.request.responseURL.slice(0, -infoApiPath.length));
                        } else {
                            resolve(url);
                        }
                    } else if (response.data.build) {
                        reject({
                            message:
                                `The url ${url} points to a ChurchTools Installation, but its version is too old.` +
                                ` At least version ${minimalVersion} is required.`,
                            messageKey: 'churchtools.url.invalidold',
                            args: {
                                url: url,
                                minimalChurchToolsVersion: minimalVersion,
                            },
                        });
                    } else {
                        reject({
                            message: `The url ${url} does not point to a valid ChurchTools installation.`,
                            messageKey: 'churchtools.url.invalid',
                            args: {
                                url: url,
                            },
                        });
                    }
                })
                .catch((error) => {
                    if (!error.status) {
                        logMessage('Network error: Offline', error);
                        reject({
                            message:
                                'Could not validate the url. Either the url is wrong or there is a problem with the ' +
                                'internet connection',
                            messageKey: 'churchtools.url.offline',
                        });
                    } else {
                        logMessage('Error on checking url', error);
                        reject({
                            message: `The url ${url} does not point to a valid ChurchTools installation.`,
                            messageKey: 'churchtools.url.invalid',
                            args: {
                                url: url,
                            },
                        });
                    }
                });
        });
    }

    setCookieJar(axiosCookieJarSupport: (axios: AxiosInstance) => AxiosInstance, jar: unknown) {
        this.ax = axiosCookieJarSupport(this.ax);
        // @ts-expect-error axios.defaults.jar is added by npm package axios-cookiejar-support
        this.ax.defaults.jar = jar;
    }
}

export { ChurchToolsClient };

export const defaultChurchToolsClient = new ChurchToolsClient();
