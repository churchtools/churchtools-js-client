const removeProtocol = (url: string) => {
    return url.replace(/(^\w+:|^)\/\//, '');
};

const toCorrectChurchToolsUrl = (url: string) => {
    if (/^http:.*/.test(url)) {
        return url;
    }
    const urlWithoutProtocol = removeProtocol(url);
    return 'https://' + urlWithoutProtocol.replace(/\/$/, '');
};

export { toCorrectChurchToolsUrl };
