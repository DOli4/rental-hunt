// Where the site reads and saves. workerUrl is the Cloudflare Worker address (see worker/README.md);
// leave it empty and the site is read-only, reading the data branch straight from GitHub.
window.RENTAL_CONFIG = {
  workerUrl: "",
  rawBase: "https://raw.githubusercontent.com/DOli4/rental-hunt/data/",
};
