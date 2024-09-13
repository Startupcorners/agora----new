const express = require('express');
const cors = require('cors');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
require('dotenv').config();

const PORT = process.env.PORT;
const APP_ID = process.env.APP_ID;
const APP_CERTIFICATE = process.env.APP_CERTIFICATE;

const app = express();
app.use(cors())

app.options('/access_token', cors())

const nocache = (req, resp, next) => {
    resp.header('Cache-control', 'private, no-cache, no-store, must-revalidate');
    resp.header('Expires', '-1');
    resp.header('Pragma', 'no-cache');
    next();
};

const generateAccessToken = (req, resp) => {
    resp.header('Access-Control-Allow-Origin', '*');
    
    const channelName = req.query.channelName;
    if (!channelName) {
        return resp.status(422).json({
            'error': 'channelName is required'
        });
    }

    let uid = req.query.uid;
    if (!uid || uid == '') {
        uid = 0;
    }

    let role = RtcRole.SUBSCRIBER;
    if (req.query.role == 'publisher') {
        role = RtcRole.PUBLISHER;
    }

    let expireTime = req.query.expireTime;
    if (!expireTime || expireTime == '') {
        expireTime = 3600; //seconds
    } else {
        expireTime = parseInt(expireTime, 10);
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTime + expireTime;

    const token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);

    return resp.json({
        'token': token
    });
};

app.get('/', (req, resp) => {
    const now = new Date();
    const formattedDate = now.toISOString().replace(/T/, ' ').replace(/\..+/, '');

    return resp.json({
        'status': 'up',
        'time': formattedDate
    });
});
app.get('/access_token', nocache, generateAccessToken);


app.listen(PORT, () => {
    console.log(`Listening on port: ${PORT}`);
});

module.exports = app;