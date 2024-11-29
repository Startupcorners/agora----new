export const handleRenewToken = async (config, client) => {
  config.token = await fetchTokens();
  await client.renewToken(config.token);
};


export const fetchTokens = async (config, uidToFetch) => {
  try {
    const uid = uidToFetch || config.uid; // Use screenShareUid if provided, otherwise default to main UID

    const res = await fetch(
      `${config.serverUrl}/generateTokens?channelName=${config.channelName}&uid=${uid}&role=${config.user.role}`,
      {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
    const data = await res.json();

    // Log fetched tokens for debugging
    console.log(`Fetched RTC Token for UID ${uid}:`, data.rtcToken);
    console.log(`Fetched RTM Token for UID ${uid}:`, data.rtmToken);

    return {
      rtcToken: data.rtcToken,
      rtmToken: data.rtmToken,
    };
  } catch (err) {
    console.error("Failed to fetch tokens:", err);
    throw err;
  }
};