import { activateLogging, logMessage, deactivateLogging } from '../src/logging';

let logStore = '';
let logFuncSave = undefined;

beforeEach(() => {
    logStore = '';
    const storeLog = (firstInput, secondInput) => (logStore += firstInput + secondInput);
    logFuncSave = console.log; //eslint-disable-line no-console
    console['log'] = jest.fn(storeLog); //eslint-disable-line no-console
});

afterEach(() => {
    console.log = logFuncSave; //eslint-disable-line no-console
    deactivateLogging();
});

test('default no logging', () => {
    logMessage('Foo');
    expect(logStore).toBe('');
});

test('logs after activation', () => {
    activateLogging();
    logMessage('Foo');
    logMessage('Bar');

    expect(logStore).toBe('ChurchTools Client:FooChurchTools Client:Bar');
});

test('logs after quite afer deactivation', () => {
    activateLogging();
    logMessage('Foo');

    expect(logStore).toBe('ChurchTools Client:Foo');

    deactivateLogging();
    logMessage('Bar');

    expect(logStore).toBe('ChurchTools Client:Foo');
});
