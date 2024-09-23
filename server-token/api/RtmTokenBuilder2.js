const AccessToken = require("./AccessToken2").AccessToken2;
const ServiceRtm = require("./AccessToken2").ServiceRtm;

class RtmTokenBuilder {
  /**
   * Build the RTM token.
   *
   * @param appId The App ID issued to you by Agora. Apply for a new App ID from
   * Agora Dashboard if it is missing from your kit. See Get an App ID.
   * @param appCertificate Certificate of the application that you registered in
   * the Agora Dashboard. See Get an App Certificate.
   * @param userId The user's account, max length is 64 Bytes.
   * @param expire represented by the number of seconds elapsed since now. If, for example, you want to access the
   * Agora Service within 10 minutes after the token is generated, set expire as 600(seconds).
   * @return The RTM token.
   */
  static buildToken(appId, appCertificate, userId, expire) {
    // Log the input parameters for debugging
    console.log("Building RTM Token with parameters:", {
      appId,
      appCertificate,
      userId,
      expire,
    });

    // Create AccessToken and convert UID to string for RTM
    let token = new AccessToken(appId, appCertificate, null, expire);
    const stringUserId = userId.toString(); // Convert UID to string for RTM

    // Log the converted userId
    console.log("Converted userId to string:", stringUserId);

    // Create and add RTM service privilege
    let serviceRtm = new ServiceRtm(stringUserId);
    serviceRtm.add_privilege(ServiceRtm.kPrivilegeLogin, expire);

    // Log the added privilege for RTM
    console.log("Added privilege for RTM login with expiry:", expire);

    // Add the RTM service to the token
    token.add_service(serviceRtm);

    // Log the final token structure before building
    console.log("Final token structure:", JSON.stringify(token, null, 2));

    // Return the built token
    const generatedToken = token.build();

    // Log the generated token
    console.log("Generated RTM Token:", generatedToken);

    return generatedToken;
  }
}

module.exports.RtmTokenBuilder = RtmTokenBuilder;
