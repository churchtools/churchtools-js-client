import { oldApi, get } from './churchtoolsClient';

const login = (username, password) => {
    return oldApi('login/ajax', 'login', {
        email: username,
        password: password
    });
};

const masterdata = module => {
    return oldApi(module + '/ajax', 'getMasterdata');
};

const whoami = (loginstring = null, personId = null) => {
    if (loginstring) {
        return get(`/whoami?loginstr=${loginstring}&id=${personId}&no_url_rewrite=true`);
    }
    return get('/whoami');
};

const personEvents = personId => {
    return get(`/persons/${personId}/events`);
};

const logout = () => {
    return oldApi('login/ajax', 'logout');
};

const logintoken = personId => {
    return get(`/persons/${personId}/logintoken`);
};

const person = personId => {
    return get(`/persons/${personId}`);
};

const services = () => {
    return get('/services');
};
const serviceGroups = () => {
    return get('/servicegroups');
};

export { login, logout, whoami, personEvents, masterdata, logintoken, person, services, serviceGroups };
