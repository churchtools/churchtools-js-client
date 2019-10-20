import { oldApi, get, post, put, deleteApi, getAllPages } from './churchtoolsClient';

const login = (username, password, rememberMe = true) => {
    return post('/login', {
        username: username,
        password: password,
        rememberMe
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

const group = groupId => {
    return get(`/groups/${groupId}`);
};

const members = groupId => {
    return getAllPages(`/groups/${groupId}/members`);
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
        queryString += `&domainTypes[]=${domainType}`;
    });
    return get(queryString);
};

const persons = (personIds, limit = 10) => {
    if (personIds.length === 0) {
        return [];
    }
    let queryString = '/persons?';
    const queryParams = personIds
        .map(personId => {
            return 'ids[]=' + personId;
        })
        .join('&');
    return get(queryString + queryParams + '&limit=' + limit);
};

const personAllIntern = (persons, remainingPersonIds, resolve, reject) => {
    const personsPerCall = 100;
    const personIds = remainingPersonIds.slice(0, personsPerCall - 1);
    let queryString = '/persons?';
    const queryParams = personIds
        .map(personId => {
            return 'ids[]=' + personId;
        })
        .join('&');
    get(queryString + queryParams + '&limit=' + personsPerCall)
        .then(personsResult => {
            persons = persons.concat(personsResult);
            const remaining = remainingPersonIds.slice(personsPerCall);
            if (remaining.length > 0) {
                personAllIntern(persons, remaining, resolve, reject);
            } else {
                resolve(persons);
            }
        })
        .catch(reject);
};

const personsAll = personIds => {
    return new Promise((resolve, reject) => {
        personAllIntern(
            [],
            personIds,
            persons => {
                resolve(persons);
            },
            error => reject(error)
        );
    });
};

const searchPersons = query => {
    return search(query, ['person']);
};

const acceptServiceRequest = (personId, serviceRequestId, comment = null) => {
    const body = {
        agreed: true
    };
    if (comment) {
        body.comment = comment;
    }
    return put(`/persons/${personId}/servicerequests/${serviceRequestId}`, body);
};

const declineServiceRequest = (personId, serviceRequestId, comment = null) => {
    if (comment) {
        return deleteApi(`/persons/${personId}/servicerequests/${serviceRequestId}`, {
            comment
        });
    }
    return deleteApi(`/persons/${personId}/servicerequests/${serviceRequestId}`);
};

const undoServiceRequest = (personId, serviceRequestId) => {
    return post(`/persons/${personId}/servicerequests/${serviceRequestId}/undo`);
};

const sendDeviceId = (userId, token, type) => {
    return put('/persons/' + userId + '/devices/' + token, {
        type
    });
};

const deleteDeviceId = (userId, token) => {
    return deleteApi('/persons/' + userId + '/devices/' + token);
};

const agenda = eventId => {
    return get(`/events/${eventId}/agenda`);
};

const personMasterData = () => {
    return get('/masterdata/person');
};

const installationInfos = () => {
    return get('/info');
};

const personTags = personId => {
    return get('/persons/' + personId + '/tags');
};

const personRelationships = personId => {
    return get('/persons/' + personId + '/relationships');
};

const statuses = () => {
    return get('/statuses');
};

const campuses = () => {
    return get('/campuses');
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
    persons,
    personsAll,
    sendDeviceId,
    undoServiceRequest,
    deleteDeviceId,
    agenda,
    members,
    group,
    personMasterData,
    installationInfos,
    personTags,
    personRelationships,
    statuses,
    campuses
};
