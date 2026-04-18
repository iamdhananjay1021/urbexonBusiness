import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

/*
 * PageTransition — 3 stage flow:
 *
 *   "enter"  →  page visible, fade-up animation
 *   "exit"   →  page fades out (opacity 0)
 *   "idle"   →  screen is blank, content swaps HERE (no blink)
 *
 * Blink ka reason: pehle content swap aur animation ek saath
 * hote the — new content flash karta tha. Ab content sirf
 * "idle" stage mein swap hota hai jab screen already blank hai.
 */

const EXIT_MS = 120; // exit animation duration  — CSS se match karna
const IDLE_MS = 10;  // content swap ke liye ek tick ka gap
const ENTER_MS = 240; // enter animation duration — CSS se match karna

const PageTransition = ({ children }) => {
    const location = useLocation();

    const [stage, setStage] = useState("enter");
    const [displayed, setDisplayed] = useState(children);

    const pendingRef = useRef(children);
    const prevPath = useRef(location.pathname);
    const timerRef = useRef(null);

    // ── Children update karo ref mein hamesha ──────────────
    useEffect(() => {
        pendingRef.current = children;

        // Same route pe children change — seedha update karo
        if (location.pathname === prevPath.current) {
            setDisplayed(children);
        }
    }, [children, location.pathname]);

    // ── Route change pe 3-stage flow ───────────────────────
    useEffect(() => {
        if (location.pathname === prevPath.current) return;
        prevPath.current = location.pathname;

        // Cancel any in-flight transition
        if (timerRef.current) clearTimeout(timerRef.current);

        // Stage 1: EXIT — current page fade out
        setStage("exit");

        // Stage 2: IDLE — screen blank, swap content (no blink)
        timerRef.current = setTimeout(() => {
            setStage("idle");

            timerRef.current = setTimeout(() => {
                setDisplayed(pendingRef.current); // ← swap yahan hota hai
                window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                setStage("enter");                // Stage 3: ENTER
            }, IDLE_MS);

        }, EXIT_MS);

        return () => clearTimeout(timerRef.current);
    }, [location.pathname]);

    return (
        <>
            <style>{`
                .pt-wrap {
                    will-change: opacity, transform;
                }

                /* Stage: enter — smooth fade up */
                .pt-enter {
                    animation: pt-in ${ENTER_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }

                /* Stage: exit — quick fade down */
                .pt-exit {
                    animation: pt-out ${EXIT_MS}ms ease-in both;
                    pointer-events: none;
                }

                /* Stage: idle — completely invisible, no animation */
                .pt-idle {
                    opacity: 0;
                    pointer-events: none;
                }

                @keyframes pt-in {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                @keyframes pt-out {
                    from { opacity: 1; transform: translateY(0); }
                    to   { opacity: 0; transform: translateY(-6px); }
                }
            `}</style>

            <div className={`pt-wrap pt-${stage}`}>
                {displayed}
            </div>
        </>
    );
};

export default PageTransition;