// ==UserScript==
// @name         Allegro - zawsze pełny opis
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatycznie rozwija "Pokaż pełny opis" na każdej ofercie Allegro
// @author       CactusPie
// @match        https://allegro.pl/*
// @run-at       document-idle
// @license      MIT
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=allegro.pl
// @downloadURL https://update.greasyfork.org/scripts/599608/Allegro%20-%20zawsze%20pe%C5%82ny%20opis.user.js
// @updateURL https://update.greasyfork.org/scripts/599608/Allegro%20-%20zawsze%20pe%C5%82ny%20opis.meta.js
// ==/UserScript==

(function() {
    'use strict';

    // Button: <button data-show-label="POKAŻ PEŁNY OPIS" data-hide-label="ZWIŃ PEŁNY OPIS" aria-expanded="false" aria-controls="...">
    const BUTTON_SELECTOR = 'button[data-show-label][data-hide-label][aria-controls]';
    const RETRY_INTERVAL_MS = 1000;
    const RETRY_TIMEOUT_MS = 5000;

    // Buttons already expanded; skipped so a stale button from the previous route doesn't count as success
    // and a description collapsed manually by the user stays collapsed.
    const done = new WeakSet();

    function findButton() {
        return [...document.querySelectorAll(BUTTON_SELECTOR)]
            .find(button => !done.has(button) && /pełny opis/i.test(button.dataset.showLabel));
    }

    // Returns true when the description is expanded.
    function tryExpand() {
        const button = findButton();
        if (!button) return false;

        if (button.getAttribute('aria-expanded') === 'true') {
            done.add(button);
            return true;
        }

        // Click may be ignored before React hydrates; the next attempt verifies it.
        button.click();
        return false;
    }

    let timer = null;
    function startExpanding() {
        clearInterval(timer);
        if (tryExpand()) return;

        const startedAt = Date.now();
        timer = setInterval(() => {
            if (tryExpand() || Date.now() - startedAt >= RETRY_TIMEOUT_MS) {
                clearInterval(timer);
            }
        }, RETRY_INTERVAL_MS);
    }

    // Route changes (SPA navigation). Hash changes are ignored.
    let lastUrl = location.origin + location.pathname + location.search;
    function onRouteChange() {
        const url = location.origin + location.pathname + location.search;
        if (url === lastUrl) return;
        lastUrl = url;
        startExpanding();
    }

    for (const method of ['pushState', 'replaceState']) {
        const original = history[method];
        history[method] = function(...args) {
            const result = original.apply(this, args);
            onRouteChange();
            return result;
        };
    }
    window.addEventListener('popstate', onRouteChange);

    startExpanding();
})();
