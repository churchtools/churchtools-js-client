let logging = false;

const activateLogging = () => {
    logging = true;
};

const log = message => {
    if (logging) {
        console.log('ChurchTools Client:', message);
    }
};

export { log, activateLogging };
