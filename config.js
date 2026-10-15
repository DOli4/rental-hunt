// Where the site signs in and saves. workerUrl is the Cloudflare Worker address and googleClientId the
// Google sign-in client id (see worker/README.md). Both are public by design; the secrets live on Cloudflare.
window.RENTAL_CONFIG = {
  workerUrl: "",
  googleClientId: "733921269880-8amcl3862nsdtdqljekrfjri1ro0u8ef.apps.googleusercontent.com",
};
