export function useFakeConsole() {
    const originalConsole = global.console;

    const fakeConsole = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
    };

    beforeAll(() => {
        global.console = fakeConsole;
    });
    afterAll(() => {
        global.console = originalConsole;
    });

    return fakeConsole;
}