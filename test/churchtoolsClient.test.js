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
});