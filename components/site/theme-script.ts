/**
 * Runs before the page paints, so the stored or system theme applies without a flash.
 *
 * Kept out of the theme toggle's "use client" module on purpose: a value a server component
 * imports from a client module reaches the browser as a reference to that module, not as the
 * string. The root layout's `<head>` would then wait for the toggle's JavaScript before it
 * could hydrate, and when that JavaScript arrived late React lost its place in the document
 * and failed hydration (React error 418).
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;
