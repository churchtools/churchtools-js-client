type TranslationFunction = (key: string, args?: Record<string, string>) => string;

const getTranslatedErrorMessage = (error: any, translationFunction?: TranslationFunction) => {
    return getFromResponse(error, translationFunction) || getFromResponseData(error, translationFunction) || error;
};

const getErrorMessageKey = (error: any) => {
    return getFromResponse(error, undefined, true) || getFromResponseData(error, undefined, true);
};

const getFromResponse = (error: any, translationFunction?: TranslationFunction, keyOnly = false) => {
    if (!error || !error.response) {
        return null;
    }

    return getFromResponseData(error.response, translationFunction, keyOnly);
};

const getFromResponseData = (
    response: any,
    translationFunction?: TranslationFunction,
    keyOnly = false,
): string | null => {
    if (!response) {
        return null;
    }

    if (response.data) {
        return getFromResponseData(response.data, translationFunction, keyOnly);
    }

    if (keyOnly) {
        return response.messageKey || null;
    }

    let additional = '';
    if (response.errors) {
        const nestedMessages = getFromNestedErrors(response.errors, translationFunction);
        if (nestedMessages && nestedMessages.length) {
            additional = ' ' + nestedMessages.join(' ');
        }
    }

    if (response.translatedMessage) {
        if (response.translatedMessage === 'Translation not yet initialized' && additional) {
            return additional.trim();
        }
        return response.translatedMessage + additional;
    }

    if (response.messageKey && translationFunction) {
        return translationFunction(response.messageKey, response.args) + additional;
    }

    if (response.message) {
        return response.message + additional;
    }
    return null;
};

const getFromNestedErrors = (errors: any[], translationFunction?: TranslationFunction) => {
    if (!errors || !errors.length) {
        return null;
    }
    return errors.map((error) => getTranslatedErrorMessage(error, translationFunction)).filter((message) => !!message);
};

export { getTranslatedErrorMessage, getErrorMessageKey };
