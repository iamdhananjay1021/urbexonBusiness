/**
 * imageCache.js — session-lifetime "have we shown this URL before" registry.
 *
 * Root cause this exists for: every image component tracked its own
 * `imgLoaded` boolean starting at `false`, so navigating away and back to a
 * page (which unmounts/remounts the component) always painted the shimmer
 * skeleton again and re-ran the fade-in transition — even though the browser
 * already has the bytes cached and decodes instantly. That read as "images
 * reloading" even when no network request happened.
 *
 * This is the same "module-level cache outlives the component" pattern
 * already used by useCategories.js (category list cache) and Home.jsx
 * (_homeCache) — extended to individual image URLs so a component can ask
 * "has this exact URL already finished loading once this session?" and, if
 * so, skip the skeleton/fade entirely on mount.
 */
const loadedUrls = new Set();

export const markImageLoaded = (url) => {
    if (url) loadedUrls.add(url);
};

export const isImageLoaded = (url) => !!url && loadedUrls.has(url);
