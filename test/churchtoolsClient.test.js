import { expect, it } from '@jest/globals';
import PolyFillFormData from 'form-data';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import fs from 'node:fs';
import path from 'node:path';
import { ChurchToolsClient } from '../src/churchtoolsClient';
import { useFakeConsole } from './test-utils';

describe('churchtoolsClient', () => {
    useFakeConsole();

    it('should fail for invalid credentials', async () => {
        let ctc = new ChurchToolsClient('https://review.church.tools', 'foobar', true);

        await expect(ctc.get('/contactlabels')).rejects.toHaveProperty('statusText', 'Unauthorized');
    });

    it.each([
        ['form-data PolyFill', PolyFillFormData],
        ['native FormData', FormData]
    ])('should send correct boundary header when posting files using %s', async (_, FormDataImpl) => {
        const mockServer = setupServer(
            http.get('*', () => HttpResponse.json({ 'data': 'mock-csrf-token' })),
            http.post('*', async ({ request }) => {
                const formData = await request.formData();
                return HttpResponse.json({ data: { 'mocked': true, formDataKeys: [...formData.keys()] } });
            })
        );
        mockServer.listen();
        const formData = new FormDataImpl();
        formData.append('text_field', '1234');
        formData.append('files[]', fs.createReadStream(path.resolve(__dirname, './one-pixel.png')));
        const ctc = new ChurchToolsClient('http://jest.test', 'mock-login-token', true);

        const result = await ctc.post('/files/groupimage/42', formData);

        expect(result.formDataKeys).toEqual(['text_field', 'files[]']);

        mockServer.close();
    });

    it('should allow overriding the User-Agent header', () => {
        const ctc = new ChurchToolsClient('http://jest.test');
        
        // Check that the default User-Agent is set
        const defaultUserAgent = ctc.ax.defaults.headers['User-Agent'];
        expect(defaultUserAgent).toMatch(/^churchtools-js-client\//);
        
        // Override the User-Agent
        const customUserAgent = 'my-custom-agent/1.0.0';
        ctc.setUserAgent(customUserAgent);
        
        // Verify it was overridden
        expect(ctc.ax.defaults.headers['User-Agent']).toBe(customUserAgent);
    });

    it('should remove the User-Agent header from defaults and requests', async () => {
        const client = new ChurchToolsClient('http://jest.test');
        client.ax.defaults.adapter = async (config) => ({
            data: {},
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
        });

        client.removeUserAgent();

        expect(client.ax.defaults.headers['User-Agent']).toBeUndefined();

        const responseWithoutUserAgent = await client.ax.get('/user-agent-test', {
            headers: { 'User-Agent': 'request-specific-agent/1.0.0' },
        });
        expect(responseWithoutUserAgent.config.headers['User-Agent']).toBeUndefined();

        client.setUserAgent('restored-agent/1.0.0');

        const responseWithRestoredUserAgent = await client.ax.get('/user-agent-test');
        expect(responseWithRestoredUserAgent.config.headers['User-Agent']).toBe('restored-agent/1.0.0');
    });

    it.each([
        ['post', (client) => client.post('/write')],
        ['put', (client) => client.put('/write', {})],
        ['patch', (client) => client.patch('/write')],
        ['delete', (client) => client.deleteApi('/write')],
    ])('should send a CSRF token for %s requests when enabled', async (_, request) => {
        const client = new ChurchToolsClient('http://jest.test');
        const requests = [];
        client.ax.defaults.adapter = async (config) => {
            requests.push(config);
            return {
                data: config.url.endsWith('/csrftoken') ? 'mock-csrf-token' : {},
                status: 200,
                statusText: 'OK',
                headers: {},
                config,
            };
        };
        client.setLoadCSRFForAPI();

        await request(client);
        await request(client);

        expect(requests).toHaveLength(3);
        expect(requests[0].url).toBe('http://jest.test/api/csrftoken');
        expect(requests[1].headers['CSRF-Token']).toBe('mock-csrf-token');
        expect(requests[2].headers['CSRF-Token']).toBe('mock-csrf-token');
    });

    it('should not load a CSRF token for REST requests by default', async () => {
        const client = new ChurchToolsClient('http://jest.test');
        const requests = [];
        client.ax.defaults.adapter = async (config) => {
            requests.push(config);
            return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
        };

        await client.post('/write');

        expect(requests).toHaveLength(1);
        expect(requests[0].headers['CSRF-Token']).toBeUndefined();
    });

    it('should not load a CSRF token for login requests', async () => {
        const client = new ChurchToolsClient('http://jest.test');
        const requests = [];
        client.ax.defaults.adapter = async (config) => {
            requests.push(config);
            return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
        };
        client.setLoadCSRFForAPI();

        await client.post('/login');

        expect(requests).toHaveLength(1);
        expect(requests[0].url).toBe('http://jest.test/api/login');
        expect(requests[0].headers['CSRF-Token']).toBeUndefined();
    });
});
