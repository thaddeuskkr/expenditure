import { normalizeTheme, type ThemePreference } from "../../pocketbase/pb_hooks/theme-core.cjs";
import { themeVariables } from "./theme.ts";

export const THEME_CACHE_KEY = "expenditure.confirmed-theme.v1";
type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function cacheTheme(storage: ThemeStorage, user: string, server: string, theme: ThemePreference) {
    try {
        const confirmed = normalizeTheme(theme);
        storage.setItem(THEME_CACHE_KEY, JSON.stringify({ user, server, theme: confirmed, variables: themeVariables(confirmed) }));
    } catch {
        // Storage restrictions must never prevent a confirmed preference from applying.
    }
}

export function readCachedTheme(storage: ThemeStorage, user: string, server: string): ThemePreference | null {
    try {
        const cached = JSON.parse(storage.getItem(THEME_CACHE_KEY) || "null");
        return user && cached?.user === user && cached.server === server ? normalizeTheme(cached.theme) : null;
    } catch {
        return null;
    }
}

// Only fixed code and the public backend URL enter this script. Cached strings
// are read at runtime, validated, then assigned as individual CSS properties.
export function themeBootstrap(server: string): string {
    return `(function(){try{
        var server=${JSON.stringify(server).replaceAll("<", "\\u003c")};
        var auth=JSON.parse(localStorage.getItem("pocketbase_auth")||"null");
        var cached=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_CACHE_KEY)})||"null");
        if(!auth||!auth.record||!auth.token||!cached||cached.user!==auth.record.id||cached.server!==server)return;
        var payload=JSON.parse(atob(auth.token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
        if(!(payload.exp>Date.now()/1000))return;
        var v=cached.variables;
        var keys=["--background","--foreground","--card","--popover","--popover-foreground","--primary","--primary-foreground","--secondary","--muted-foreground","--border","--ring","--destructive"];
        if(!v||keys.some(function(k){return typeof v[k]!=="string"||!(k==="--border"?/^#[a-fA-F0-9]{8}$/:/^#[a-fA-F0-9]{6}$/).test(v[k]);})||!["dark","light"].includes(v.colorScheme))return;
        function l(h){var c=[1,3,5].map(function(i){var n=parseInt(h.slice(i,i+2),16)/255;return n<=0.04045?n/12.92:Math.pow((n+0.055)/1.055,2.4);});return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;}
        if(["--background","--card","--secondary"].some(function(s){return ["--foreground","--muted-foreground","--primary"].some(function(k){var a=l(v[s]),b=l(v[k]);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)<4.5;});}))return;
        var root=document.documentElement;
        keys.forEach(function(k){root.style.setProperty(k,v[k]);});
        root.style.setProperty("color-scheme",v.colorScheme);
        root.classList.toggle("dark",v.colorScheme==="dark");
        var meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=v["--background"];
    }catch(e){}})();`;
}
