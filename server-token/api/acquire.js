// server-token/api/acquire.js
const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channelName, uid } = req.body;

  // Agora Credentials from Environment Variables
  const APP_ID = process.env.AGORA_APP_ID;
  const CUSTOMER_ID = process.env.AGORA_CUSTOMER_ID;
  const CUSTOMER_CERTIFICATE = process.env.AGORA_CUSTOMER_CERTIFICATE;

  const auth = Buffer.from(`${CUSTOMER_ID}:${CUSTOMER_CERTIFICATE}`).toString('base64');

  try {
    const response = await axios.post(
      `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`,
      {
        cname: channelName,
        uid: uid,
        clientRequest: {},
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Acquire Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: error.response ? error.response.data : error.message });
  }
};
