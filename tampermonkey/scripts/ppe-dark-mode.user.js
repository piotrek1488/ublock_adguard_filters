// ==UserScript==
// @name         PPE.pl - wymuś tryb ciemny
// @namespace    https://github.com/piotrek1488/ublock_adguard_filters
// @version      1.0.0
// @description  Włącza wbudowany tryb ciemny ppe.pl (body.theme--dark) i utrzymuje go po przeładowaniu, bez potrzeby klikania przełącznika.
// @author       piotrek1488
// @match        https://www.ppe.pl/*
// @match        https://ppe.pl/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  // PPE stores the theme on <body>: "theme--light" or "theme--dark".
  // The sun/moon toggle (.theme-switch__sun / .theme-switch__moon) just mirrors it.
  // We do not reinvent colors: the site ships a full dark theme, we only enable it.

  const LIGHT = "theme--light";
  const DARK = "theme--dark";

  function enableDark(root) {
    if (!root) return;
    if (root.classList.contains(LIGHT) || !root.classList.contains(DARK)) {
      root.classList.remove(LIGHT);
      root.classList.add(DARK);
    }
    // Keep the toggle icons in sync so the switch shows the moon as active.
    const sun = document.getElementById("light") || document.querySelector(".theme-switch__sun");
    const moon = document.getElementById("dark") || document.querySelector(".theme-switch__moon");
    if (sun) sun.classList.remove("active");
    if (moon) moon.classList.add("active");
  }

  // 1) As early as possible: <body> may not exist yet at document-start,
  //    so also pre-mark <html> and retry on DOMContentLoaded.
  function tryNow() {
    if (document.body) enableDark(document.body);
  }
  tryNow();
  document.addEventListener("DOMContentLoaded", tryNow, { once: true });

  // 2) The site's own JS can re-apply theme--light after it boots (Stimulus
  //    "theme" controller reads a cookie/default). Observe <body> and re-force
  //    dark whenever it flips back to light. Self-triggered changes are ignored
  //    because enableDark is a no-op once the class is already theme--dark.
  const start = () => {
    if (!document.body) {
      requestAnimationFrame(start);
      return;
    }
    enableDark(document.body);
    const mo = new MutationObserver(() => enableDark(document.body));
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    // Stop forcing if the user deliberately clicks the toggle to go back to light.
    const sw = document.querySelector(".theme-switch__switch");
    if (sw) {
      sw.addEventListener(
        "click",
        () => {
          // Let the site handle the click first, then honor whatever it set.
          setTimeout(() => mo.disconnect(), 0);
        },
        { once: true }
      );
    }
  };
  start();
})();
