import { useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

/*
 * PageTransition — 3 stage flow:
 *   "enter"  → page visible, fade-up animation
 *   "exit"   → page fades out
 *   "idle"   → screen blank, content swaps here (no blink)
 */

const EXIT_MS = 120;
const IDLE_MS = 10;
const ENTER_MS = 240;

const PageTransition = ({ children }) => {
    const location = useLocation();

    const [stage, setStage] = useState("enter");
    const [displayed, setDisplayed] = useState(children);

    const pendingRef = useRef(children);
    const prevPath = useRef(location.pathname);
    const timerRef = useRef(null);

    useEffect(() => {
        pendingRef.current = children;
        if (location.pathname === prevPath.current) {
            setDisplayed(children);
        }
    }, [children, location.pathname]);

    useEffect(() => {
        if (location.pathname === prevPath.current) return;
        prevPath.current = location.pathname;

        if (timerRef.current) clearTimeout(timerRef.current);

        setStage("exit");

        timerRef.current = setTimeout(() => {
            setStage("idle");

            timerRef.current = setTimeout(() => {
                setDisplayed(pendingRef.current);
                window.scrollTo({ top: 0, left: 0, behavior: "instant" });
                setStage("enter");
            }, IDLE_MS);
        }, EXIT_MS);

        return () => clearTimeout(timerRef.current);
    }, [location.pathname]);

    /* Tailwind doesn't support dynamic animation-duration, so we use
       data attributes + CSS custom props via a thin style tag.
       The <style> here is minimal — only animation keyframes & durations,
       NOT layout/design CSS. All layout is Tailwind below. */
    return (
        <>
            <style>{`
        @keyframes pt-in  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pt-out { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(-6px); } }
        .pt-enter { animation: pt-in  ${ENTER_MS}ms cubic-bezier(0.22,1,0.36,1) both; }
        .pt-exit  { animation: pt-out ${EXIT_MS}ms ease-in both; pointer-events:none; }
        .pt-idle  { opacity:0; pointer-events:none; }
      `}</style>

            <div
                className={`will-change-[opacity,transform] ${stage === "enter"
                        ? "pt-enter"
                        : stage === "exit"
                            ? "pt-exit"
                            : "pt-idle"
                    }`}
            >
                {displayed}
            </div>
        </>
    );
};

export default PageTransition;