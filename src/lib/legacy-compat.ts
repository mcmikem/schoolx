/**
 * ES5 polyfills injected with `beforeInteractive` in the root layout.
 *
 * Some of the phones this app is deployed to run an old Android System
 * WebView (Chrome 6x–8x) that Play Store never updated. Next.js and our own
 * bundles assume newer built-ins (`crypto.randomUUID`, `AbortSignal.timeout`,
 * `String.prototype.replaceAll`, `Array.prototype.at`, …). When one is missing
 * the very first render throws and the user only sees the app error screen —
 * on a device that has never cached a previous working build, so the usual
 * "clear the cache" advice does nothing.
 *
 * This script runs synchronously before any module bundle. Everything here is
 * feature-detected and written in ES5 so it cannot itself fail to parse.
 */
export const LEGACY_COMPAT_SCRIPT = `(function () {
  "use strict";
  function define(obj, name, value) {
    try {
      if (!obj || typeof obj[name] === "function") return;
      Object.defineProperty(obj, name, { value: value, configurable: true, writable: true });
    } catch (e) {
      try { obj[name] = value; } catch (e2) {}
    }
  }
  try {
    if (typeof globalThis === "undefined") { window.globalThis = window; }
  } catch (e) {}

  try {
    define(Array.prototype, "at", function (n) {
      var len = this.length >>> 0;
      var k = Math.trunc(n) || 0;
      if (k < 0) k += len;
      return k < 0 || k >= len ? undefined : this[k];
    });
    define(String.prototype, "at", function (n) {
      var s = String(this);
      var k = Math.trunc(n) || 0;
      if (k < 0) k += s.length;
      return k < 0 || k >= s.length ? undefined : s.charAt(k);
    });
    define(Array.prototype, "flat", function (depth) {
      var d = depth === undefined ? 1 : Math.trunc(depth) || 0;
      var out = [];
      (function walk(arr, level) {
        for (var i = 0; i < arr.length; i++) {
          if (Array.isArray(arr[i]) && level > 0) walk(arr[i], level - 1);
          else out.push(arr[i]);
        }
      })(this, d);
      return out;
    });
    define(Array.prototype, "flatMap", function (fn, thisArg) {
      return Array.prototype.flat.call(Array.prototype.map.call(this, fn, thisArg), 1);
    });
    define(String.prototype, "replaceAll", function (search, replacement) {
      var str = String(this);
      if (search instanceof RegExp) {
        if (!search.global) throw new TypeError("replaceAll must be called with a global RegExp");
        return str.replace(search, replacement);
      }
      return str.split(String(search)).join(String(replacement));
    });
    define(String.prototype, "trimStart", function () { return String(this).replace(/^\\s+/, ""); });
    define(String.prototype, "trimEnd", function () { return String(this).replace(/\\s+$/, ""); });
    define(String.prototype, "padStart", function (len, pad) {
      var s = String(this); pad = pad === undefined ? " " : String(pad);
      while (s.length < len) s = pad + s;
      return s.slice(0, Math.max(len, String(this).length));
    });
  } catch (e) {}

  try {
    define(Object, "hasOwn", function (obj, prop) {
      return Object.prototype.hasOwnProperty.call(Object(obj), prop);
    });
    define(Object, "fromEntries", function (entries) {
      var out = {};
      for (var i = 0; i < entries.length; i++) out[entries[i][0]] = entries[i][1];
      return out;
    });
    define(Object, "entries", function (obj) { return Object.keys(obj).map(function (k) { return [k, obj[k]]; }); });
    define(Object, "values", function (obj) { return Object.keys(obj).map(function (k) { return obj[k]; }); });
  } catch (e) {}

  try {
    if (typeof Promise !== "undefined") {
      define(Promise, "allSettled", function (iterable) {
        return Promise.all(Array.prototype.map.call(iterable, function (p) {
          return Promise.resolve(p).then(
            function (value) { return { status: "fulfilled", value: value }; },
            function (reason) { return { status: "rejected", reason: reason }; }
          );
        }));
      });
      define(Promise, "any", function (iterable) {
        return new Promise(function (resolve, reject) {
          var items = Array.prototype.slice.call(iterable);
          var errors = [];
          var done = false;
          if (!items.length) return reject(new Error("All promises were rejected"));
          items.forEach(function (p, i) {
            Promise.resolve(p).then(function (v) { if (!done) { done = true; resolve(v); } },
              function (err) { errors[i] = err; if (errors.filter(Boolean).length === items.length && !done) { done = true; reject(new Error("All promises were rejected")); } });
          });
        });
      });
    }
  } catch (e) {}

  try {
    define(window, "queueMicrotask", function (fn) {
      Promise.resolve().then(fn);
    });
    define(window, "requestIdleCallback", function (fn) {
      return setTimeout(function () { fn({ didTimeout: false, timeRemaining: function () { return 50; } }); }, 1);
    });
    define(window, "cancelIdleCallback", function (id) { clearTimeout(id); });
  } catch (e) {}

  try {
    if (typeof AbortSignal !== "undefined" && typeof AbortController !== "undefined") {
      define(AbortSignal, "timeout", function (ms) {
        var controller = new AbortController();
        setTimeout(function () {
          try {
            controller.abort(new DOMException("signal timed out", "TimeoutError"));
          } catch (e) {
            try { controller.abort(); } catch (e2) {}
          }
        }, ms);
        return controller.signal;
      });
      define(AbortSignal, "any", function (signals) {
        var controller = new AbortController();
        var list = Array.prototype.slice.call(signals);
        for (var i = 0; i < list.length; i++) {
          (function (sig) {
            if (sig.aborted) { try { controller.abort(sig.reason); } catch (e) {} return; }
            sig.addEventListener("abort", function () { try { controller.abort(sig.reason); } catch (e) {} });
          })(list[i]);
        }
        return controller.signal;
      });
    }
  } catch (e) {}

  try {
    define(Element.prototype, "replaceChildren", function () {
      while (this.firstChild) this.removeChild(this.firstChild);
      for (var i = 0; i < arguments.length; i++) {
        this.appendChild(arguments[i] && arguments[i].nodeType ? arguments[i] : document.createTextNode(String(arguments[i])));
      }
    });
  } catch (e) {}

  try {
    var c = window.crypto || window.msCrypto;
    if (c && typeof c.randomUUID !== "function") {
      var randomUUID = function () {
        var bytes = new Uint8Array(16);
        if (typeof c.getRandomValues === "function") c.getRandomValues(bytes);
        else for (var i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        var hex = [];
        for (var j = 0; j < 16; j++) hex.push((bytes[j] + 0x100).toString(16).slice(1));
        return hex.slice(0, 4).join("") + "-" + hex.slice(4, 6).join("") + "-" + hex.slice(6, 8).join("") + "-" + hex.slice(8, 10).join("") + "-" + hex.slice(10, 16).join("");
      };
      define(c, "randomUUID", randomUUID);
    }
  } catch (e) {}

  try {
    if (typeof window.structuredClone !== "function") {
      define(window, "structuredClone", function (value) {
        return JSON.parse(JSON.stringify(value));
      });
    }
  } catch (e) {}

  try {
    if (window.navigator && typeof window.navigator.sendBeacon !== "function" && window.XMLHttpRequest) {
      window.navigator.sendBeacon = function () { return false; };
    }
  } catch (e) {}

  // ---------------------------------------------------------------------
  // Unsupported browser notice.
  //
  // Next.js 16 only supports Chrome/Edge 111+, Firefox 111+ and Safari 16.4+,
  // and its own client chunks use ES2022 class static blocks (Chrome 94 /
  // Safari 16.4). On an older Android System WebView the bundle cannot even be
  // parsed, so React never runs and the user sees a blank page or the generic
  // error card. No polyfill can fix a parser-level failure, but we can replace
  // the dead screen with instructions the person can act on.
  // ---------------------------------------------------------------------
  function showUnsupportedBrowser(detail) {
    var ua = navigator.userAgent || "";
    var isIOS = /(iPhone|iPad|iPod)/.test(ua);
    var notice = document.createElement("div");
    notice.id = "unsupported-browser";
    notice.setAttribute("role", "alert");
    notice.setAttribute("dir", "ltr");
    notice.style.cssText =
      "position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483647;display:flex;" +
      "align-items:center;justify-content:center;padding:24px;background:#001F3F;color:#ffffff;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;";

    var card = document.createElement("div");
    card.style.cssText = "max-width:420px;";

    var title = document.createElement("h1");
    title.textContent = "Update your browser to use SkoolMate";
    title.style.cssText = "font-size:22px;line-height:1.25;margin:0 0 14px;font-weight:700;";

    var body = document.createElement("p");
    body.style.cssText = "font-size:15px;line-height:1.6;margin:0 0 18px;color:#d7e3f4;";
    body.textContent = isIOS
      ? "This iPhone or iPad is running an older version of Safari. Update iOS to 16.4 or later in Settings > General > Software Update, then tap Retry."
      : "This phone's browser is too old to run SkoolMate. Open the Play Store, update 'Android System WebView' and Chrome, then tap Retry. If the Play Store says they are already up to date, use Chrome instead of the built-in browser.";

    var version = document.createElement("p");
    version.style.cssText = "font-size:12px;line-height:1.5;margin:0 0 22px;color:#8fa6c4;word-break:break-word;";
    version.textContent = "Detected: " + detail;

    var button = document.createElement("button");
    button.type = "button";
    button.textContent = "Retry";
    button.style.cssText =
      "appearance:none;border:0;border-radius:12px;background:#16a34a;color:#ffffff;" +
      "font-size:15px;font-weight:700;padding:12px 28px;cursor:pointer;";
    button.onclick = function () { window.location.reload(); };

    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(version);
    card.appendChild(button);
    notice.appendChild(card);

    var mount = function () {
      if (document.getElementById("unsupported-browser")) return;
      if (document.body) document.body.appendChild(notice);
    };
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  }

  try {
    var ua = navigator.userAgent || "";
    var chromeMatch = /Chrome\\/(\\d+)/.exec(ua);
    var iosMatch = /OS (\\d+)_(\\d+)/.exec(ua);
    var unsupported = false;
    var detail = "";
    if (/Android/.test(ua) && chromeMatch && parseInt(chromeMatch[1], 10) < 94) {
      unsupported = true;
      detail = "Android WebView / Chrome " + chromeMatch[1];
    } else if (/Android/.test(ua) && !chromeMatch) {
      unsupported = true;
      detail = "Android browser (no Chrome engine)";
    } else if (/(iPhone|iPad|iPod)/.test(ua) && iosMatch) {
      var iosMajor = parseInt(iosMatch[1], 10);
      var iosMinor = parseInt(iosMatch[2], 10);
      if (iosMajor < 16 || (iosMajor === 16 && iosMinor < 4)) {
        unsupported = true;
        detail = "iOS " + iosMajor + "." + iosMinor;
      }
    } else if (/Opera Mini/.test(ua)) {
      unsupported = true;
      detail = "Opera Mini";
    }
    if (unsupported) {
      try { document.documentElement.setAttribute("data-unsupported-browser", "1"); } catch (e) {}
      showUnsupportedBrowser(detail);
    }
  } catch (e) {}
})();`;
