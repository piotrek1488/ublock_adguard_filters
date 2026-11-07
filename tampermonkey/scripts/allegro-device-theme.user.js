// ==UserScript==
// @name         Allegro – wymuś "motyw urządzenia"
// @namespace    https://github.com/piotrek1488/ublock_adguard_filters
// @version      4.0.0
// @description  Ustawia w Allegro wygląd na "użyj preferencji systemowych" (motyw urządzenia), aby serwis podążał za jasnym/ciemnym motywem systemu. Allegro nie ma osobnej opcji "ciemny" – jedyny tryb ciemny to DEVICE przy ciemnym motywie systemu. Zapis idzie wprost przez API preferencji (POST edge.allegro.pl/preferences), bo UI wymaga zdarzeń isTrusted, których userscript nie wygeneruje.
// @author       piotrek1488
// @icon         https://www.google.com/s2/favicons?sz=64&domain=allegro.pl
// @match        https://allegro.pl/*
// @match        https://*.allegro.pl/*
// @run-at       document-idle
// @grant        GM_setValue
// @grant        GM_getValue
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  // ---- Konfiguracja -------------------------------------------------------
  // Allegro przechowuje wybór wyglądu w preferencji "displayThemeWebOnly".
  // Dozwolone wartości: "DEVICE" (motyw urządzenia) i "LIGHT" (motyw jasny).
  // Allegro NIE ma osobnej wartości "DARK" – tryb ciemny dostajesz tylko przez
  // DEVICE przy ciemnym motywie systemu.
  const TARGET = "DEVICE"; // "DEVICE" albo "LIGHT"

  // Endpoint + media type ustalone z działającej aplikacji. WAŻNE: Content-Type
  // musi być dokładnie taki (custom media type), inaczej preflight CORS odrzuci
  // żądanie ("Failed to fetch").
  const PREF_URL = "https://edge.allegro.pl/preferences";
  const MEDIA_TYPE = "application/vnd.allegro.internal.v1+json";

  // Gdy raz zapiszemy wybór, Allegro go pamięta, więc nie powtarzamy co wizytę.
  const DONE_KEY = "allegro_theme_set_" + TARGET;

  const log = (...a) => console.info("[allegro-device-theme]", ...a);

  // Czy wygląd jest już docelowy? Allegro ujawnia stan w inline-skrypcie SSR:
  //   "colorScheme":"systemSpecific" dla DEVICE, "light" dla LIGHT.
  function currentScheme() {
    const r = document.getElementById("device-theme-settings");
    if (r && r.checked) return "systemSpecific";
    const rl = document.getElementById("light-theme-settings");
    if (rl && rl.checked) return "light";
    const blob = [...document.querySelectorAll("script:not([src])")].map((s) => s.textContent).join("");
    const m = blob.match(/"colorScheme":"(\w+)"/);
    return m ? m[1] : null;
  }

  function isAlreadyTarget() {
    const s = currentScheme();
    if (!s) return false;
    return TARGET === "DEVICE" ? s === "systemSpecific" : s === "light";
  }

  async function savePreference() {
    const res = await fetch(PREF_URL, {
      method: "POST",
      credentials: "include", // potrzebne – żądanie leci do subdomeny edge.*
      headers: { "Content-Type": MEDIA_TYPE, Accept: MEDIA_TYPE },
      body: JSON.stringify({ name: "displayThemeWebOnly", value: TARGET }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json().catch(() => ({}));
  }

  async function run() {
    if (GM_getValue(DONE_KEY, false)) {
      log("wygl\u0105d ustawiony wcześniej – pomijam");
      return;
    }
    if (isAlreadyTarget()) {
      log("wygl\u0105d ju\u017c = " + TARGET + " – nic do zrobienia");
      GM_setValue(DONE_KEY, true);
      return;
    }

    try {
      await savePreference();
      GM_setValue(DONE_KEY, true);
      log("zapisano wygl\u0105d = " + TARGET + " przez API preferencji");

      // Preferencję czyta render serwerowy, więc odśwież raz, by zobaczyć efekt.
      // Robimy to tylko jeśli strona nie jest już w docelowym trybie.
      if (!isAlreadyTarget()) {
        log("odświe\u017cam stronę, by zastosować nowy wygl\u0105d...");
        location.reload();
      }
    } catch (e) {
      // Nie udało się zapisać przez API (np. wylogowany, zmiana API). Nie blokujemy
      // strony – logujemy i pozwalamy ustawić wygląd ręcznie w stopce.
      log("nie uda\u0142o si\u0119 zapisać przez API:", e && e.message ? e.message : e);
    }
  }

  // Daj stronie chwilę na zbudowanie, potem działaj.
  setTimeout(() => { run().catch((e) => log("b\u0142\u0105d:", e)); }, 1500);
})();
