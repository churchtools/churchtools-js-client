let logging = false;

const activateLogging = () => {
    logging = true;
};

const deactivateLoggging = () => {
    logging = false;
};

const log = (message, message2) => {
    if (logging) {
        console.log('ChurchTools Client:', message, message2); //eslint-disable-line no-console
    }
};

export { log, activateLogging, deactivateLoggging };
