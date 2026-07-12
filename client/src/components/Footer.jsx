/**
 * Footer.jsx — Production v2.0
 * ✅ No Tailwind — pure CSS-in-JS
 * ✅ Links updated (become-vendor)
 * ✅ Responsive
 */
import { Link } from "react-router-dom";
import { FaInstagram, FaWhatsapp, FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaBolt, FaFacebookF } from "react-icons/fa";

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
.ft-root { background: #0f172a; color: #94a3b8; font-family: 'DM Sans', sans-serif; border-top: 1px solid #1e293b; }
.ft-top { max-width: 1280px; margin: 0 auto; padding: 72px 24px 48px; display: grid; grid-template-columns: 2.5fr 1fr 1fr 1fr; gap: 48px; }
@media (max-width: 1024px) { .ft-top { grid-template-columns: 1fr 1fr 1fr; gap: 40px; } .ft-brand-col { grid-column: 1 / -1; } }
@media (max-width: 640px) { .ft-top { grid-template-columns: 1fr; gap: 40px; padding: 48px 24px 32px; } }
.ft-brand-name { font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin-bottom: 6px; }
.ft-brand-sub { font-size: 12px; color: #3b82f6; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 20px; }
.ft-tagline { font-size: 14px; line-height: 1.7; color: #94a3b8; max-width: 340px; margin-bottom: 24px; }
.ft-social { display: flex; gap: 12px; }
.ft-soc-btn { width: 38px; height: 38px; border-radius: 50%; background: #1e293b; display: flex; align-items: center; justify-content: center; color: #cbd5e1; transition: all 0.2s ease; text-decoration: none; }
.ft-soc-btn:hover { background: #3b82f6; color: #ffffff; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
.ft-col-title { font-size: 15px; font-weight: 700; color: #ffffff; margin-bottom: 20px; letter-spacing: 0.3px; }
.ft-link { display: inline-block; font-size: 14px; color: #94a3b8; text-decoration: none; margin-bottom: 14px; transition: color 0.2s ease; font-weight: 500; }
.ft-link:hover { color: #3b82f6; }
.ft-contact-item { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; font-size: 14px; color: #94a3b8; text-decoration: none; transition: color 0.2s ease; line-height: 1.5; font-weight: 500; }
.ft-contact-item:hover { color: #ffffff; }
.ft-contact-item svg { margin-top: 3px; flex-shrink: 0; color: #64748b; transition: color 0.2s ease; }
.ft-contact-item:hover svg { color: #3b82f6; }
.ft-uh-badge { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155; color: #f59e0b; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 700; margin-bottom: 24px; text-decoration: none; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.ft-uh-badge:hover { border-color: #f59e0b; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(245,158,11,0.15); color: #fbbf24; }
.ft-bottom { border-top: 1px solid #1e293b; padding: 24px; background: #0b1120; }
.ft-bottom-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
.ft-copy { font-size: 13px; color: #64748b; font-weight: 500; }
.ft-legal { display: flex; gap: 24px; flex-wrap: wrap; }
.ft-legal a { font-size: 13px; color: #64748b; text-decoration: none; transition: color 0.2s ease; font-weight: 500; }
.ft-legal a:hover { color: #ffffff; }
@media(max-width: 767px) { 
  .ft-bottom { padding-bottom: 80px; } 
  .ft-bottom-inner { flex-direction: column; text-align: center; justify-content: center; } 
  .ft-legal { justify-content: center; gap: 16px; } 
}
`;

const Footer = () => (
    <footer className="ft-root">
        <style>{CSS}</style>
        <div className="ft-top">
            {/* Brand */}
            <div className="ft-brand-col">
                <div className="ft-brand-name">Urbexon</div>
                <div className="ft-brand-sub">Premium Commerce</div>
                <p className="ft-tagline">
                    India's premium multi-vendor marketplace. Fashion, lifestyle, and local express delivery — all in one place.
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
