/**
 * ShareModal.jsx
 * Extracted from ProductDetails.jsx so it can be code-split via React.lazy()
 * — it only needs to load when the user actually clicks "Share".
 */
import { useState } from "react";
import { FaTimes, FaCheckCircle, FaLink, FaWhatsapp, FaFacebook, FaInstagram, FaTwitter } from "react-icons/fa";
import { imgUrl } from "../utils/imageUrl";

const ShareModal = ({ product, onClose }) => {
    const [copied, setCopied] = useState(false);
    const url = window.location.href;
    const text = encodeURIComponent(`${product.name} — ₹${Number(product.price).toLocaleString("en-IN")}`);
    const enc = encodeURIComponent(url);
    const links = [
        { icon: <FaWhatsapp size={22} />, label: "WhatsApp", color: "#25D366", bg: "bg-green-50", href: `https://wa.me/?text=${text}%20${enc}` },
        { icon: <FaFacebook size={22} />, label: "Facebook", color: "#1877F2", bg: "bg-blue-50", href: `https://www.facebook.com/sharer/sharer.php?u=${enc}` },
        { icon: <FaTwitter size={22} />, label: "Twitter", color: "#000", bg: "bg-neutral-100", href: `https://twitter.com/intent/tweet?text=${text}&url=${enc}` },
        { icon: <FaInstagram size={22} />, label: "Instagram", color: "#E1306C", bg: "bg-pink-50", href: `https://www.instagram.com/` },
    ];
    return (
        <div onClick={onClose}
            className="fixed inset-0 z-[99999] bg-black/55 backdrop-blur-sm
                       flex items-start justify-center pt-[8vh] px-4">
            <div onClick={e => e.stopPropagation()}
                className="bg-white w-full max-w-sm rounded-2xl shadow-2xl max-h-[82vh] overflow-y-auto
                           animate-[slideDown_.22s_ease]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
                    <span className="font-bold text-[15px] text-neutral-900">Share Product</span>
                    <button onClick={onClose} aria-label="Close share dialog"
                        className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center
                                   hover:bg-neutral-200 transition-colors">
                        <FaTimes size={11} className="text-neutral-500" />
                    </button>
                </div>
                {/* Product preview */}
                <div className="mx-5 my-3 bg-neutral-50 rounded-xl p-3 flex items-center gap-3 border border-neutral-100">
                    <div className="w-12 h-12 rounded-lg bg-white border border-neutral-100 overflow-hidden shrink-0 flex items-center justify-center">
                        {product.images?.[0]?.url
                            ? <img src={imgUrl.detail(product.images[0].url)} alt={product.name}
                                className="w-full h-full object-contain p-1" loading="lazy" />
                            : <span className="text-xl">🎁</span>}
                    </div>
                    <div className="min-w-0">
                        <p className="font-semibold text-[13px] text-neutral-900 truncate">{product.name}</p>
                        <p className="font-bold text-[13px] text-green-600 mt-0.5">
                            ₹{Number(product.price).toLocaleString("en-IN")}
                        </p>
                    </div>
                </div>
                {/* Social links */}
                <div className="grid grid-cols-4 gap-2 px-5 pb-4">
                    {links.map(({ icon, label, color, bg, href }) => (
                        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                            aria-label={`Share on ${label}`}
                            className="flex flex-col items-center gap-1.5 no-underline">
                            <div className={`w-[52px] h-[52px] rounded-[14px] ${bg} flex items-center justify-center`}
                                style={{ color }}>
                                {icon}
                            </div>
                            <span className="text-[10px] font-semibold text-neutral-500 text-center">{label}</span>
                        </a>
                    ))}
                </div>
                {/* Copy link */}
                <div className="mx-5 mb-5 flex items-center gap-2 bg-neutral-50 rounded-xl px-3 py-2.5 border border-neutral-100">
                    <span className="text-xs text-neutral-400 flex-1 truncate">{url}</span>
                    <button
                        onClick={async () => {
                            try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard write denied/unsupported — intentionally silent */ }
                        }}
                        aria-label="Copy product link"
                        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                                    ${copied ? "bg-green-100 text-green-700" : "bg-orange-500 text-white hover:bg-orange-600"}`}>
                        {copied ? <><FaCheckCircle size={9} /> Copied!</> : <><FaLink size={9} /> Copy</>}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;