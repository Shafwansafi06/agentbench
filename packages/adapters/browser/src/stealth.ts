/**
 * In-page stealth evaluation. Deliberately SELF-CONTAINED: every check
 * runs against the provider's own browser with no third-party
 * bot-detection site, so results are reproducible and attributable. Public
 * gauntlet sites (CreepJS, sannysoft) are roadmap — useful, but flaky and
 * impossible to attribute when they change.
 */
export interface StealthChecks {
  /** navigator.webdriver must be false/undefined */
  webdriver_leak: boolean;
  /** navigator.languages present and non-empty */
  languages_present: boolean;
  /** navigator.plugins non-empty (headless shells often expose 0) */
  plugins_present: boolean;
  /** window.chrome defined (Chromium-fingerprint consistency) */
  chrome_object: boolean;
  /** notifications permission probe does not contradict the UA */
  permissions_consistent: boolean;
  /** WebGL renderer is a real GPU, not SwiftShader/llvmpipe software rendering */
  webgl_gpu: boolean;
  /** UA and navigator.platform agree on OS family */
  ua_platform_consistent: boolean;
}

export const STEALTH_CHECKS: (keyof StealthChecks)[] = [
  "webdriver_leak",
  "languages_present",
  "plugins_present",
  "chrome_object",
  "permissions_consistent",
  "webgl_gpu",
  "ua_platform_consistent",
];

const STEALTH_EVAL = `(() => {
  const out = {};
  out.webdriver_leak = navigator.webdriver === false || navigator.webdriver === undefined;
  out.languages_present = Array.isArray(navigator.languages) && navigator.languages.length > 0;
  try { out.plugins_present = navigator.plugins !== null && navigator.plugins.length > 0; }
  catch { out.plugins_present = false; }
  out.chrome_object = typeof window.chrome !== "undefined" && window.chrome !== null;
  out.permissions_consistent = (async () => {
    try {
      const perm = await navigator.permissions.query({ name: "notifications" });
      return perm.state === "denied" ? Notification.permission === "denied" : true;
    } catch { return true; }
  })();
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) { out.webgl_gpu = false; }
    else {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      const s = String(renderer).toLowerCase();
      out.webgl_gpu = !s.includes("swiftshader") && !s.includes("llvmpipe") && !s.includes("software");
    }
  } catch { out.webgl_gpu = false; }
  const ua = navigator.userAgent;
  const plat = String(navigator.platform || "");
  const uaWin = /Windows/.test(ua), uaMac = /Mac OS X|Macintosh/.test(ua), uaLinux = /Linux/.test(ua) && !/Android/.test(ua);
  out.ua_platform_consistent =
    (uaWin && /Win/.test(plat)) ||
    (uaMac && /Mac/.test(plat)) ||
    (uaLinux && /Linux/.test(plat)) ||
    (!uaWin && !uaMac && !uaLinux);
  return out;
})()`;

export async function evaluateStealth(page: {
  evaluate<T = unknown>(fn: string): Promise<T>;
}): Promise<StealthChecks> {
  const raw = (await page.evaluate(STEALTH_EVAL)) as Record<string, unknown>;
  const checks = {} as StealthChecks;
  for (const key of STEALTH_CHECKS) {
    const v = raw[key];
    // permissions_consistent resolves to a Promise in-page; unwrap it.
    checks[key] = v === true || (v !== null && typeof v === "object" && "then" in (v as object)
      ? await (v as Promise<boolean>)
      : v === true);
  }
  return checks;
}
