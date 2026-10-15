// Runs in <head> before anything is drawn: never show the page inside another site (stops click-tricks),
// and skip the sign-in screen flash for people who are already signed in.
if (globalThis.top !== globalThis.self) document.documentElement.style.display = "none";
try { if (localStorage.getItem("rh-session")) document.documentElement.classList.remove("locked"); } catch (e) { console.warn("[rental] browser storage blocked, showing sign-in", e); }
