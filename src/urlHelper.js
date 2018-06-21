const removeProtocol = url => {
    return url.replace(/(^\w+:|^)\/\//, '');
};

const toCorrectChurchToolsUrl = url => {
    if (/^http:.*/.test(url)) {
        return url;
    }
    const urlWithoutProtocol = removeProtocol(url);
    return 'https://' + urlWithoutProtocol.replace(/\/$/, '');
};

export { toCorrectChurchToolsUrl };
