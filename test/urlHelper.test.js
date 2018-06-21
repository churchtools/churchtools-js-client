import { toCorrectChurchToolsUrl } from '../src/urlHelper';

describe('get correct churchtools url', ()=> {
    test('should add protocol', ()=> {
        expect(toCorrectChurchToolsUrl('review.church.tools')).toBe('https://review.church.tools');
    });

    test('should return url without changes', ()=> {
        expect(toCorrectChurchToolsUrl('http://review.church.tools')).toBe('http://review.church.tools');
    });

});