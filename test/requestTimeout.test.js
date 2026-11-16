import axios from 'axios';
import { createServer } from 'node:http';
import { ChurchToolsClient } from '../src/churchtoolsClient';

describe('request timeouts', () => {
    const server = createServer((request, response) => {
        if (request.url === '/api/success') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ data: 'loaded' }));
        }
        // All other routes deliberately leave the request pending.
    });
    let baseUrl;

    beforeAll(async () => {
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    beforeEach(() => {
        jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        server.closeAllConnections();
    });

    afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
    });

    it('reports the default deadline as a timeout, not a cancellation', async () => {
        const client = new ChurchToolsClient(baseUrl);
        const result = client.get('/pending').catch((error) => error);

        await jest.advanceTimersByTimeAsync(15000);
        const error = await result;

        expect(error).toMatchObject({ code: 'ETIMEDOUT', config: { url: `${baseUrl}/api/pending` } });
        expect(axios.isAxiosError(error)).toBe(true);
        expect(axios.isCancel(error)).toBe(false);
    });

    it('honors the per-request deadline instead of the client default', async () => {
        const client = new ChurchToolsClient(baseUrl);
        client.setRequestTimeout(1000);
        const controller = new AbortController();
        const result = client
            .post('/pending', {}, { timeout: 50, abortController: controller })
            .catch((error) => error);

        await jest.advanceTimersByTimeAsync(49);
        expect(controller.signal.aborted).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        const error = await result;

        expect(error).toMatchObject({ code: 'ETIMEDOUT' });
        expect(axios.isCancel(error)).toBe(false);
    });

    it.each([false, true])('preserves explicit cancellation (already aborted: %s)', async (alreadyAborted) => {
        const client = new ChurchToolsClient(baseUrl);
        const controller = new AbortController();
        if (alreadyAborted) {
            controller.abort();
        }
        const result = client
            .post('/pending', {}, { timeout: 50, abortController: controller })
            .catch((error) => error);

        await jest.advanceTimersByTimeAsync(10);
        controller.abort();
        // A later deadline must not reclassify an explicit cancellation.
        await jest.advanceTimersByTimeAsync(100);
        const error = await result;

        expect(error).toMatchObject({ code: 'ERR_CANCELED' });
        expect(axios.isCancel(error)).toBe(true);
        await expect(client.post('/pending', {}, { abortController: controller })).rejects.toMatchObject({
            code: 'ERR_CANCELED',
        });
    });

    it('still returns successful response data', async () => {
        const client = new ChurchToolsClient(baseUrl);

        await expect(client.get('/success')).resolves.toBe('loaded');
    });
});
