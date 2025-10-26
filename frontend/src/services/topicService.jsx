import api from './api';

const getTopic = (topicName) => {
    return api.get(`/kg/topics/${topicName}/`);
};

const checkPrerequisites = (topicName) => {
    return api.post('/kg/check-prerequisites/', {
        target_topic_name: topicName,
    });
};

const topicService = {
    getTopic,
    checkPrerequisites,
};

export default topicService;