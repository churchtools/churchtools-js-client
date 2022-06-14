import {ChurchToolsClient} from '../src/churchtoolsClient';

test('should fail for invalid credentials', done => {
    let ctc = new ChurchToolsClient('https://review.church.tools', 'foobar', true);
    //ctc.setRateLimitInterceptor();
    //ctc.setCookieJar(axiosCookieJarSupport.default, new tough.CookieJar());
    ctc.get('/contactlabels')
        .then(result => {
            expect(true).toBe(false);
            done();
        })
        .catch(error => {
            if (error.matcherResult) {
                throw error;
            }
            expect(error.statusText).toBe('Unauthorized');
            done();
        });
});
