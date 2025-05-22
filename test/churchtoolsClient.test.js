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
});