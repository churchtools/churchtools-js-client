import { getTranslatedErrorMessage, getErrorMessageKey } from '../src/errorHelper';

const errorAsString = 'Ein Fehler ist aufgetreten.';

const exception = {
    message: 'undefined is not an object.'
};

const loginErrorData = {
    message: 'Username or password wrong for test',
    translatedMessage: 'Login ist fehlgeschlagen. Benutzername oder Passwort sind falsch.',
    messageKey: 'login.failed',
    args: [],
    errors: []
};

const loginErrorResponse = {
    data: loginErrorData
};

const loginErrorResponseDataData = {
    data: {
        data: loginErrorData
    }
};

const loginErrorAxiosError = {
    response: loginErrorResponse
};

test('should return error message which is already an error string', () => {
    expect(getTranslatedErrorMessage(errorAsString)).toBe(errorAsString);
});

test('should return error message for exceptions', () => {
    expect(getTranslatedErrorMessage(exception)).toBe(exception.message);
});

test('should return translated message from error data', () => {
    expect(getTranslatedErrorMessage(loginErrorData)).toBe(loginErrorData.translatedMessage);
});

test('should return translated message from error response', () => {
    expect(getTranslatedErrorMessage(loginErrorResponse)).toBe(loginErrorData.translatedMessage);
});

test('should return translated message from nested data.data', () => {
    expect(getTranslatedErrorMessage(loginErrorResponseDataData)).toBe(loginErrorData.translatedMessage);
});

test('should return translated message from error object', () => {
    expect(getTranslatedErrorMessage(loginErrorAxiosError)).toBe(loginErrorData.translatedMessage);
});

test('should return message key from error data', () => {
    expect(getErrorMessageKey(loginErrorData)).toBe(loginErrorData.messageKey);
});

test('should return message key from error response', () => {
    expect(getErrorMessageKey(loginErrorResponse)).toBe(loginErrorData.messageKey);
});

test('should return message key from nested data.data', () => {
    expect(getErrorMessageKey(loginErrorResponseDataData)).toBe(loginErrorData.messageKey);
});

test('should return message key from error object', () => {
    expect(getErrorMessageKey(loginErrorAxiosError)).toBe(loginErrorData.messageKey);
});

test('should return null if no message key is set', () => {
    const noMessageKey = {
        message: 'a',
        translatedMessage: 'b',
        messageKey: ''
    };
    expect(getErrorMessageKey(noMessageKey)).toBe(null);
});

const nestedErrors = {
    'message': 'There are validation errors',
    'messageKey': 'validation.error',
    'translatedMessage': 'Die eingegebenen Daten waren nicht korrekt.',
    'args': [],
    'errors': [
        {
            'fieldId': 'forms[0].form[0].value',
            'message': 'Die Eingabe darf nicht leer bleiben.',
            'messageKey': 'validation.not.empty',
            'args': {
                'name': 'forms[0].form[0].value',
                'value': null
            }
        },
        {
            'fieldId': 'forms[0].form[0].value',
            'message': 'Eingabe muss ein Text sein.',
            'messageKey': 'validation.string',
            'args': {
                'name': 'forms[0].form[0].value',
                'value': null
            }
        }
    ]
};

test('should append nested error messages', () => {
    expect(getTranslatedErrorMessage(nestedErrors)).toBe(
        'Die eingegebenen Daten waren nicht korrekt. Die Eingabe darf nicht leer bleiben. Eingabe muss ein Text sein.'
    );
});

const oldErrorFormat = {
    'message': 'Churchtools\\Boot\\DBInitializationException: A server error ocurred',
    'translatedMessage': 'Translation not yet initialized',
    'messageKey': 'server.error',
    'args': [],
    'errors': [
        {
            'message': 'Aktuell läuft ein ChurchTools Update, bitte probieren Sie es in einer Minute erneut.'
        }
    ]
};

test('should work with error messages from the old API', () => {
    expect(getTranslatedErrorMessage(oldErrorFormat)).toBe(
        'Aktuell läuft ein ChurchTools Update, bitte probieren Sie es in einer Minute erneut.'
    );
});
