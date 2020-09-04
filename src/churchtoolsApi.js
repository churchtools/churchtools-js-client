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

const getAllByIds = (baseQuery, options, result, remainingIds, resolve, reject) => {
    const resultsPerCall = 100;
    const ids = remainingIds.slice(0, resultsPerCall - 1);
    let queryString = baseQuery + '?';
    const queryOptions = options ? options + '&' : '';
    const queryParams = ids
        .map(id => {
            return 'ids[]=' + id;
        })
        .join('&');
    get(queryString + queryOptions + queryParams + '&limit=' + resultsPerCall)
        .then(resultFromApi => {
            result = result.concat(resultFromApi);
            const remaining = remainingIds.slice(resultsPerCall);
            if (remaining.length > 0) {
                getAllByIds(baseQuery, options, result, remaining, resolve, reject);
            } else {
                resolve(result);
            }
        })
        .catch(reject);
};

const groupsAll = (groupIds, showOverdueGroups = true, showInactiveGroups = true) => {
    if (groupIds === null || groupIds === undefined) {
        return getAllPages('/groups');
    }
    return new Promise((resolve, reject) => {
        getAllByIds(
            '/groups',
            `show_overdue_groups=${showOverdueGroups}&show_inactive_groups=${showInactiveGroups}`,
            [],
            groupIds,
            groups => {
                resolve(groups);
            },
            error => reject(error)
        );
    });
};

const personsAll = personIds => {
    return new Promise((resolve, reject) => {
        getAllByIds(
            '/persons',
            '',
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

const sendDeviceId = (userId, token, type, version = null) => {
    return put('/persons/' + userId + '/devices/' + token, {
        type,
        version
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

const config = () => {
    return get('/config');
};

const groupsForPerson = (personId, showInactiveGroups = false, showOverdueGroups = false) => {
    return get(
        `/persons/${personId}/groups?` +
            `show_overdue_groups=${showOverdueGroups}&show_inactive_groups=${showInactiveGroups}`
    );
};

const getFilteredGroups = optios => {
    let query = '';
    if (typeof optios.isPublic === 'boolean') {
        query += `&is_public=${optios.isPublic}`;
    }
    if (typeof optios.showOverdueGroups === 'boolean') {
        query += `&show_overdue_groups=${optios.showOverdueGroups}`;
    }
    if (typeof optios.showInactiveGroups === 'boolean') {
        query += `&show_inactive_groups=${optios.showInactiveGroups}`;
    }
    if (typeof optios.isOpenForMembers === 'boolean') {
        query += `&is_open_for_members=${optios.isOpenForMembers}`;
    }
    if (typeof optios.withoutMyGroups === 'boolean') {
        query += `&without_my_groups=${optios.withoutMyGroups}`;
    }
    if (optios.campusIds && optios.campusIds.length) {
        query += optios.campusIds.map(id => `&campus_ids[]=${id}`).join('');
    }
    if (optios.ageGroupIds && optios.ageGroupIds.length) {
        query += optios.ageGroupIds.map(id => `&agegroup_ids[]=${id}`).join('');
    }
    if (optios.groupTypeIds && optios.groupTypeIds.length) {
        query += optios.groupTypeIds.map(id => `&group_type_ids[]=${id}`).join('');
    }
    if (typeof optios.limit === 'number' && optios.limit != Infinity) {
        query += `&limit=${optios.limit}`;
    }
    if (query.length === 0) {
        return [];
    }
    // remove leading '&'
    query = query.slice(1);
    if (optios.limit === Infinity) {
        return getAllPages(`/groups?${query}`);
    }
    return get(`/groups?${query}`);
};

const getGroupSignUpLink = (groupId, personId) => {
    return post(`/publicgroups/${groupId}/token`, { personId, clicked: [personId] });
};

const setProfilePictureForPerson = (personId, originalWidth, originalHeight, options, pictureObj) => {
    // options format: {crop: {top: number, bottom: number, right: number, left: number}, focus: {x: number, y: number}}
    // pictureObj format: {name: string, type: string, uri: string}
    const formData = new FormData();
    formData.append('max_width', originalWidth.toString());
    formData.append('max_height', originalHeight.toString());
    formData.append('image_options', JSON.stringify(options));
    formData.append('files[]', pictureObj);
    return post(`/files/avatar/${personId}`, formData);
};

const getFileMetadata = fileId => {
    return get(`/files/${fileId}/metadata`);
};

const deleteAvatar = personId => {
    return deleteApi(`/files/avatar/${personId}`);
};

const getEvent = eventId => {
    return get(`/events/${eventId}`);
};

const getAllEvents = () => {
    return get('/events?include=eventServices');
};

const getPublicGroupInfo = groupId => {
    return get(`/publicgroups/${groupId}`);
};

const getPermissionsGlobal = () => {
    return get('/permissions/global');
};

const getPermissionsForPerson = personId => {
    return get(`/permissions/internal/persons/${personId}`);
};


const getPermissionsForGroup = groupId => {
    return get(`/permissions/internal/groups/${groupId}`);
};

const invitePerson = personId => {
    return post(`/persons/${personId}/invite`);
};

const getPersonProperties = (...personIds) => {
    return post('/persons/properties', { ids: personIds });
};

const getMemberfields = groupId => {
    return get(`/groups/${groupId}/memberfields`);
};

const updateGroupMember = (groupId, personId, data) => {
    /*
     * Format of `data`:
     * {
     *   "groupTypeRoleId": 0,
     *   "comment": "string",
     *   "memberStartDate": "2020-09-04",
     *   "memberEndDate": "2020-09-04",
     *   "fields": {
     *     "12": true,
     *     "14": "Text",
     *     "17": null
     *   }
     * }
     */

    return put(`/groups/${groupId}/members/${personId}`, data);
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
    campuses,
    groupsAll,
    config,
    groupsForPerson,
    getFilteredGroups,
    getGroupSignUpLink,
    setProfilePictureForPerson,
    getFileMetadata,
    deleteAvatar,
    getEvent,
    getAllEvents,
    getPublicGroupInfo,
    getPermissionsGlobal,
    getPermissionsForPerson,
    getPermissionsForGroup,
    invitePerson,
    getPersonProperties,
    getMemberfields,
    updateGroupMember
};
