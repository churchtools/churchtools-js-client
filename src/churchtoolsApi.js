import { oldApi, get, post, put, deleteApi } from './churchtoolsClient';

const login = (username, password) => {
    return post('/login', {
        username: username,
        password: password
    });
};

const totp = (code, personId) => {
    return post('/login/totp', {
        code,
        personId
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

const search = (query, domainTypes = []) => {
    let queryString = `/search?query=${query}`;
    domainTypes.forEach(domainType => {
        queryString += `&domainType[]=${domainType}`;
    });
    return get(queryString);
};

const persons = personIds => {
    if (personIds.length === 0) {
        return [];
    }
    let queryString = '/persons?';
    const queryParams = personIds
        .map(personId => {
            return 'ids[]=' + personId;
        })
        .join('&');
    return get(queryString + queryParams);
};

const searchPersons = query => {
    return search(query, ['person']);
};

const acceptServiceRequest = (personId, serviceRequestId, serviceId) => {
    const body = {
        serviceId: serviceId,
        agreed: true
    };
    return put(`/persons/${personId}/servicerequests/${serviceRequestId}`, body);
};

const declineServiceRequest = (personId, serviceRequestId) => {
    return deleteApi(`/persons/${personId}/servicerequests/${serviceRequestId}`);
};

export {
    login,
    totp,
    logout,
    whoami,
    personEvents,
    masterdata,
    logintoken,
    person,
    services,
    serviceGroups,
    acceptServiceRequest,
    declineServiceRequest,
    search,
    searchPersons,
    persons
};
