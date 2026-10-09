/** Public configuration, compiled into the bundle. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const github = process.env.NEXT_PUBLIC_GITHUB_URL ?? "";
/** Only http(s) URLs are ever rendered as links. */
export const GITHUB_URL = /^https?:\/\//.test(github) ? github : null;
