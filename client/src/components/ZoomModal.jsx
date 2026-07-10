/**
 * ZoomModal.jsx
 * Extracted from ProductDetails.jsx so it can be code-split via React.lazy()
 * — it only needs to load when the user actually clicks to zoom the hero image.
 */
import { useEffect } from "react";
import { FaTimes } from "react-icons/fa";

const ZoomModal = ({ src, alt, onClose }) => {
    useEffect(() => {
        const h = e => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);
    return (
        <div onClick={onClose}
            className="fixed inset-0 z-[99999] bg-black/95 flex items-center justify-center">
            <button onClick={onClose} aria-label="Close zoomed image"
                className="fixed top-4 right-4 w-10 h-10 bg-white/15 border border-white/25
                           rounded-lg flex items-center justify-center hover:bg-white/25 transition-colors">
                <FaTimes size={16} className="text-white" />
            </button>
            <div onClick={e => e.stopPropagation()} className="w-[90vw] h-[85vh] flex items-center justify-center">
                <img src={src} alt={alt} className="max-w-full max-h-full object-contain" />
            </div>
        </div>
    );
};

export default ZoomModal;