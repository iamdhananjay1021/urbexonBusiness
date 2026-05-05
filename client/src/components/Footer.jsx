/**
 * Footer.jsx — Production v2.0
 * ✅ No Tailwind — pure CSS-in-JS
 * ✅ Links updated (become-vendor, become-delivery)
 * ✅ Responsive
 */
import { Link } from "react-router-dom";
import { FaInstagram, FaWhatsapp, FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaBolt, FaFacebookF } from "react-icons/fa";

const CSS = `
.ft-root{background:#0a0812;color:rgba(255,255,255,0.55);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.ft-top{max-width:1200px;margin:0 auto;padding:60px clamp(16px,5vw,60px) 48px;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px}
@media(max-width:900px){.ft-top{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.ft-top{grid-template-columns:1fr}}
.ft-brand-name{font-size:22px;font-weight:800;color:#c9a84c;letter-spacing:4px;text-transform:uppercase;margin-bottom:6px}
.ft-brand-sub{font-size:10px;color:rgba(255,255,255,.3);letter-spacing:3px;text-transform:uppercase;margin-bottom:16px}
.ft-tagline{font-size:13px;line-height:1.7;color:rgba(255,255,255,.45);max-width:280px;margin-bottom:20px}
.ft-social{display:flex;gap:10px}
.ft-soc-btn{width:36px;height:36px;border-radius:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.5);transition:all .2s;text-decoration:none;cursor:pointer}
.ft-soc-btn:hover{background:rgba(201,168,76,.15);border-color:rgba(201,168,76,.3);color:#c9a84c}
.ft-col-title{font-size:11px;font-weight:700;color:#fff;letter-spacing:2px;text-transform:uppercase;margin-bottom:18px}
.ft-link{display:block;font-size:13px;color:rgba(255,255,255,.45);text-decoration:none;margin-bottom:10px;transition:color .2s}
.ft-link:hover{color:#c9a84c}
.ft-contact-item{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px;font-size:13px;color:rgba(255,255,255,.45);text-decoration:none;transition:color .2s}
.ft-contact-item:hover{color:#c9a84c}
.ft-contact-item svg{margin-top:2px;flex-shrink:0;color:rgba(201,168,76,.7)}
.ft-uh-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(201,168,76,.1);border:1px solid rgba(201,168,76,.25);color:#c9a84c;padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:12px;cursor:pointer;text-decoration:none;transition:all .2s}
.ft-uh-badge:hover{background:rgba(201,168,76,.2)}
.ft-bottom{border-top:1px solid rgba(255,255,255,.06);padding:20px clamp(16px,5vw,60px)}
@media(max-width:767px){.ft-bottom{padding-bottom:80px}}
.ft-bottom-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.ft-copy{font-size:12px;color:rgba(255,255,255,.3)}
.ft-legal{display:flex;gap:20px;flex-wrap:wrap}
.ft-legal a{font-size:12px;color:rgba(255,255,255,.3);text-decoration:none;transition:color .2s}
.ft-legal a:hover{color:rgba(201,168,76,.7)}
`;

const Footer = () => (
    <footer className="ft-root">
        <style>{CSS}</style>
        <div className="ft-top">
            {/* Brand */}
            <div>
                <div className="ft-brand-name">Urbexon</div>
                <div className="ft-brand-sub">Premium Commerce</div>
                <p className="ft-tagline">
                    India ka premium multi-vendor marketplace. Fashion, lifestyle, aur local express delivery — sab ek jagah.
                </p>
                <Link to="/urbexon-hour" className="ft-uh-badge">
                    <FaBolt size={10} />Urbexon Hour — Express Delivery
                </Link>
                <div className="ft-social">
                    <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="ft-soc-btn"><FaInstagram size={15} /></a>
                    <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="ft-soc-btn"><FaFacebookF size={14} /></a>
                    <a href="https://wa.me/918808485840" target="_blank" rel="noopener noreferrer" className="ft-soc-btn"><FaWhatsapp size={15} /></a>
                </div>
            </div>

            {/* Quick Links */}
            <div>
                <div className="ft-col-title">Shop</div>
                <Link to="/" className="ft-link">Home</Link>
                <Link to="/products" className="ft-link">All Products</Link>
                <Link to="/deals" className="ft-link">Today's Deals</Link>
                <Link to="/urbexon-hour" className="ft-link">⚡ Urbexon Hour</Link>
                <Link to="/category/mens-fashion" className="ft-link">Men's Fashion</Link>
                <Link to="/category/womens-fashion" className="ft-link">Women's Fashion</Link>
            </div>

            {/* Business */}
            <div>
                <div className="ft-col-title">Quick Links</div>
                <Link to="/profile" className="ft-link">My Account</Link>
                <Link to="/orders" className="ft-link">Track Order</Link>
                <Link to="/become-vendor" className="ft-link">Become a Vendor</Link>
                <Link to="/become-delivery" className="ft-link">Delivery Partner</Link>
                <Link to="/verify-invoice" className="ft-link">Verify Invoice</Link>
                <Link to="/about" className="ft-link">About Us</Link>
            </div>

            {/* Contact */}
            <div>
                <div className="ft-col-title">Contact</div>
                <Link to="/contact" className="ft-link" style={{ marginBottom: 12 }}>Help Center & Contact</Link>
                <a href="https://maps.google.com/?q=Sector+62,+Noida,+Uttar+Pradesh,+India" target="_blank" rel="noopener noreferrer" className="ft-contact-item"><FaMapMarkerAlt size={12} /><span>Sector 62, Noida, UP, India</span></a>
                <a href="tel:+918808485840" className="ft-contact-item"><FaPhoneAlt size={12} /><span>+91 88084 85840</span></a>
                <a href="mailto:support@urbexon.in" className="ft-contact-item"><FaEnvelope size={12} /><span>support@urbexon.in</span></a>
            </div>
        </div>

        <div className="ft-bottom">
            <div className="ft-bottom-inner">
                <div className="ft-copy">© {new Date().getFullYear()} Urbexon. All rights reserved.</div>
                <div className="ft-legal">
                    <Link to="/privacy-policy">Privacy Policy</Link>
                    <Link to="/terms-conditions">Terms & Conditions</Link>
                    <Link to="/refund-policy">Refund Policy</Link>
                </div>
            </div>
        </div>
    </footer>
);

export default Footer;
