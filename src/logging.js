let logging = false;

const activateLogging = () => {
    logging = true;
};

const deactivateLoggging = () => {
    logging = false;
};

const log = message => {
    if (logging) {
        console.log('ChurchTools Client:', message); //eslint-disable-line no-console
    }
};

export { log, activateLogging, deactivateLoggging };
