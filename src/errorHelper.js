const getTranslatedErrorMessage = (error, translationFunction = null) => {
    return getFromResponse(error, translationFunction) || getFromResponseData(error, translationFunction) || error;
};

const getErrorMessageKey = error => {
    return getFromResponse(error, null, true) || getFromResponseData(error, null, true);
};

const getFromResponse = (error, translationFunction = null, keyOnly = false) => {
    if (!error || !error.response) {
        return null;
    }

    return getFromResponseData(error.response, translationFunction, keyOnly);
};

const getFromResponseData = (response, translationFunction, keyOnly = false) => {
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

const getFromNestedErrors = (errors, translationFunction) => {
    if (!errors || !errors.length) {
        return null;
    }
    return errors.map(error => getTranslatedErrorMessage(error, translationFunction)).filter(message => !!message);
};

export { getTranslatedErrorMessage, getErrorMessageKey };
