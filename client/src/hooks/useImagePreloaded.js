import { useState, useCallback } from "react";
import { isImageLoaded, markImageLoaded } from "../utils/imageCache";

/**
 * Tracks whether a given image URL has already finished loading once this
 * session, so a remounted component (e.g. a product card revisited after
 * navigating away and back) can skip the skeleton/fade-in and paint the
 * image immediately instead of re-running the "first load" animation for a
 * resource the browser already has decoded and cached.
 *
 * The `loaded` flag is only ever checked at mount (via the lazy useState
 * initializer) — callers of this hook are remounted per-item (keyed by
 * product/url), so a mounted instance's url is stable for its lifetime.
 *
 * @param {string} url
 * @returns {[boolean, () => void]} [loaded, markLoaded] — call markLoaded
 *   from the <img>'s onLoad so this URL is instant on every future mount.
 */
export function useImagePreloaded(url) {
    const [loaded, setLoaded] = useState(() => isImageLoaded(url));

    const markLoaded = useCallback(() => {
        markImageLoaded(url);
        setLoaded(true);
    }, [url]);

    return [loaded, markLoaded];
}
