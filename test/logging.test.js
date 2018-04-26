import { activateLogging, log, deactivateLoggging } from '../src/logging';

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
    deactivateLoggging();
});

test('default no logging', () => {
    log('Foo');
    expect(logStore).toBe('');
});

test('logs after activation', () => {
    activateLogging();
    log('Foo');
    log('Bar');

    expect(logStore).toBe('ChurchTools Client:FooChurchTools Client:Bar');
});

test('logs after quite afer deactivation', () => {
    activateLogging();
    log('Foo');

    expect(logStore).toBe('ChurchTools Client:Foo');

    deactivateLoggging();
    log('Bar');

    expect(logStore).toBe('ChurchTools Client:Foo');
});
