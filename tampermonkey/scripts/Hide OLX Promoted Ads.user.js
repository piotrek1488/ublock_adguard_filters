// ==UserScript==

// @name         Hide OLX Promoted Ads
// @name:ro      Ascunde Anunțuri De Tip PROMOVAT Pe OLX
// @name:bg      Скриване На Реклами Тип ПРОМОТИРАНА ОБЯВА На OLX
// @name:ua      Приховати Оголошення Типу ТОП На OLX
// @name:pt      Ocultar Anúncios Do Tipo TOP No OLX
// @name:pl      Ukryj Ogłoszenia Typu WYRÓŻNIONE Na OLX

// @description  It hides all promoted ads on OLX
// @description:ro Ascunde toate anunțurile de tip PROMOVAT de pe OLX
// @description:bg Скрива всички реклами тип ПРОМОТИРАНА ОБЯВА на OLX
// @description:ua Сховує всі оголошення типу ТОП на OLX
// @description:pt Oculta todos os anúncios do tipo TOP no OLX
// @description:pl Ukrywa wszystkie ogłoszenia typu WYRÓŻNIONE na OLX

// @author       NWP
// @namespace    https://greasyfork.org/users/877912
// @version      1.0.0
// @license      MIT
// @match        *://www.olx.ro/*
// @match        *://www.olx.bg/*
// @match        *://www.olx.ua/*
// @match        *://www.olx.pt/*
// @match        *://www.olx.pl/*
// @grant        none
// @run-at       document-idle

// @downloadURL https://update.greasyfork.org/scripts/542859/Hide%20OLX%20Promoted%20Ads.user.js
// @updateURL https://update.greasyfork.org/scripts/542859/Hide%20OLX%20Promoted%20Ads.meta.js
// ==/UserScript==

(function () {
  "use strict";

  const DEBUG = false;

  const CARD_SELECTOR = '[data-cy="l-card"][data-testid="l-card"]';
  const HIDE_CLASS = "nwp-hide-promoted";

  // Patterns that indicate a promoted listing
  const PROMOTED_PATTERNS = [
    "promoted",   // search_reason=search|promoted
    "featured",   // possible alternative wording
  ];

  const processed = new WeakSet();

  function log(...args) {
    if (DEBUG) console.log("[OLX hide promoted]", ...args);
  }

  function injectCSS() {
    if (document.getElementById("nwp-promoted-hide-style")) return;
    const style = document.createElement("style");
    style.id = "nwp-promoted-hide-style";
    style.textContent = `
      .${HIDE_CLASS} { display: none !important; }
      .olx-rating-rowwrap:has(.${HIDE_CLASS}) { display: none !important; }
    `;
    document.documentElement.appendChild(style);
  }

  function isPromoted(card) {
    // Method 1: Check links for "promoted" in search_reason parameter
    const links = card.querySelectorAll("a[href]");
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      for (const pattern of PROMOTED_PATTERNS) {
        if (href.includes(pattern)) {
          log("Promoted link found:", href);
          return true;
        }
      }
    }

    // Method 2 (fallback): Check if canvas has painted pixels (old method)
    const canvas = card.querySelector("canvas");
    if (canvas) {
      try {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] !== 0) {
              log("Painted canvas found");
              return true;
            }
          }
        }
      } catch (e) {
        // Tainted canvas — skip this check
      }
    }

    return false;
  }

  function processCard(card) {
    if (processed.has(card)) return;
    processed.add(card);

    if (isPromoted(card)) {
      card.classList.add(HIDE_CLASS);
      // Also add the class the rating script's CSS looks for
      card.classList.add("nwp-hide-painted-canvas");
      log("Hidden:", card.id || "(no-id)");

      // Hide the rating wrapper if it already exists
      const wrapper = card.closest(".olx-rating-rowwrap");
      if (wrapper) {
        wrapper.classList.add(HIDE_CLASS);
      }
    }
  }

  function processAll() {
    document.querySelectorAll(CARD_SELECTOR).forEach(processCard);
  }

  function setupObserver() {
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof Element)) continue;

          // New card added directly
          if (node.matches?.(CARD_SELECTOR)) {
            processCard(node);
          } else {
            // Card nested inside added subtree (e.g. rating script wrapping)
            node.querySelectorAll?.(CARD_SELECTOR).forEach((card) => {
              // If the card was already marked promoted but got reparented
              // by the rating script, ensure the new wrapper is also hidden.
              if (card.classList.contains(HIDE_CLASS)) {
                const wrapper = card.closest(".olx-rating-rowwrap");
                if (wrapper && !wrapper.classList.contains(HIDE_CLASS)) {
                  wrapper.classList.add(HIDE_CLASS);
                }
              } else {
                processCard(card);
              }
            });
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  function start() {
    injectCSS();
    processAll();
    setupObserver();
    log("Started");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();