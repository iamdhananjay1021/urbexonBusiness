/**
 * BecomeVendor.jsx — Vendor Application Page
 * Route: /become-vendor
 * ✅ Full form with GST, PAN, Bank Details
 * ✅ Document upload
 * ✅ Pincode selection
 * ✅ Status check karta hai — agar apply ho chuka toh redirect
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as vendorApi from "../api/vendorApi";
import { fetchActiveCategories } from "../api/categoryApi";
import { FiUpload, FiArrowRight, FiCheckCircle } from "react-icons/fi";
import { FaStore, FaUser, FaUniversity, FaMapMarkerAlt } from "react-icons/fa";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Textarea from "../design-system/Textarea";
import Select from "../design-system/Select";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";
import Loader from "../design-system/Loader";
import { cn } from "../design-system/utils/cn";

const Field = ({ label, children, full }) => (
  <div className={full ? "sm:col-span-2" : ""}>
    <label className="block text-[13px] font-semibold text-primary mb-1.5">{label}</label>
    {children}
  </div>
);

const BecomeVendor = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null); // null=loading, false=not-applied, {status}=applied
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState({});
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    shopName: "", shopDescription: "", shopCategory: "",
    ownerName: user?.name || "", email: user?.email || "", phone: user?.phone || "",
    gstNumber: "", panNumber: "", businessType: "individual",
    addressLine1: "", addressLine2: "", city: "", state: "", pincode: "",
    bankHolder: "", bankAccount: "", bankIFSC: "", bankName: "",
  });

  // ✅ Fetch categories independently on mount to ensure dropdown always populates
  useEffect(() => {
    fetchActiveCategories({ params: { type: "ecommerce" } })
      .then(({ data }) => {
        const cats = Array.isArray(data) ? data : data.categories || data.data || [];
        setCategories(cats.filter(c => c.isActive !== false));
      })
      .catch((err) => console.error("Failed to fetch categories:", err));
  }, []);

  // ✅ Authentication guard - check FIRST before anything else
  useEffect(() => {
    if (authLoading) return; // Wait for auth to load
    if (!user) {
      navigate("/login", { state: { from: "/become-vendor" } });
      return;
    }

    // ✅ Only check vendor status if user is authenticated
    vendorApi.getVendorStatus()
      .then(({ data }) => {
        if (data.registered) setStatus(data);
        else setStatus(false);
      })
      .catch(() => setStatus(false))
      .finally(() => setLoading(false));
  }, [user, authLoading, navigate]);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }));
  const setFile = (k) => (e) => {
    const f = e.target.files[0];
    if (f) setFiles(p => ({ ...p, [k]: f }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.shopName || !form.ownerName || !form.phone || !form.email)
      return setError("Shop name, owner name, phone, and email are required");
    if (!form.pincode || !/^\d{6}$/.test(form.pincode))
      return setError("Enter a valid 6-digit pincode");
    if (!/^[6-9]\d{9}$/.test(form.phone.trim()))
      return setError("Enter a valid 10-digit mobile number");
    if (!form.shopCategory)
      return setError("Please select a shop category");

    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("address", JSON.stringify({
        line1: form.addressLine1, line2: form.addressLine2,
        city: form.city, state: form.state, pincode: form.pincode,
      }));
      fd.append("bankDetails", JSON.stringify({
        accountHolder: form.bankHolder, accountNumber: form.bankAccount,
        ifsc: form.bankIFSC, bankName: form.bankName,
      }));
      fd.append("servicePincodes", JSON.stringify([form.pincode]));
      Object.entries(files).forEach(([k, f]) => fd.append(k, f));

      await vendorApi.registerVendor(fd);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit application");
    } finally { setSubmitting(false); }
  };

  // ✅ Show loading during auth check
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <Loader size="lg" />
    </div>
  );

  // ✅ If not authenticated, don't render anything (redirect handled in effect)
  if (!user) return null;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <Loader size="lg" />
    </div>
  );

  // Already applied
  if (status) {
    const cfg = {
      pending: { variant: "warning", border: "border-[var(--color-warning-500)]", icon: "⏳", title: "Application Under Review", msg: "Your application is under review. You will receive an update within 24-48 hours." },
      approved: { variant: "success", border: "border-[var(--color-success-500)]", icon: "✅", title: "You are an Approved Vendor!", msg: "Congratulations! You can now access your vendor dashboard." },
      rejected: { variant: "error", border: "border-[var(--color-error-500)]", icon: "❌", title: "Application Rejected", msg: `Reason: ${status.rejectionReason || "Please contact support."}` },
    };
    const c = cfg[status.status] || cfg.pending;
    return (
      <div className="min-h-screen bg-canvas">
        <SEO title="Become a Vendor" noindex />
        <div className="py-16 px-5">
          <Card padding="lg" className={cn("border-2 text-center max-w-[500px] mx-auto", c.border)}>
            <div className="text-5xl mb-3">{c.icon}</div>
            <h2 className="text-xl font-bold text-primary mb-2 font-display">{c.title}</h2>
            <p className="text-sm text-secondary mb-6 leading-relaxed">{c.msg}</p>

            <div className="flex gap-3 justify-center flex-wrap">
              {status.status === "approved" && (
                <a
                  href={(import.meta.env.VITE_VENDOR_URL || "http://localhost:5175") + "/dashboard"}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-md)] bg-[var(--color-graphite-900)] text-accent font-bold text-[13px] no-underline"
                >
                  Vendor Dashboard <FiArrowRight size={11} aria-hidden="true" />
                </a>
              )}
              {status.status === "rejected" && (
                <Button variant="primary" onClick={() => setStatus(false)}>Reapply</Button>
              )}
              <Button variant="secondary" onClick={() => navigate("/")}>Go to Home</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (success) return (
    <div className="min-h-screen bg-canvas">
      <SEO title="Become a Vendor" noindex />
      <div className="py-16 px-5">
        <Card padding="lg" className="border-2 border-[var(--color-success-500)] text-center max-w-[500px] mx-auto">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-xl font-bold text-primary mb-2 font-display">Application Submitted!</h2>
          <p className="text-sm text-secondary leading-relaxed">
            We will review your application within 24-48 hours.<br />You will receive an update via email.
          </p>
          <Button variant="primary" className="mt-5" onClick={() => navigate("/")}>Go to Home</Button>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <SEO title="Become a Vendor" description="Start selling on Urbexon. Register as a vendor partner and reach lakhs of customers across India." path="/become-vendor" />

      <div className="bg-[var(--color-graphite-900)] text-white text-center px-[clamp(20px,6vw,80px)] py-14">
        <div className="inline-flex items-center gap-1.5 bg-accent-tint border border-[var(--accent-primary)]/40 text-accent px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide uppercase mb-5">
          <FaStore size={11} aria-hidden="true" />Vendor Partner Program
        </div>
        <h1 className="font-display text-[clamp(26px,5vw,44px)] font-bold mb-3">
          Start Your Business on <span className="text-accent">Urbexon</span>
        </h1>
        <p className="text-sm text-white/65 max-w-[500px] mx-auto mb-8 leading-relaxed">
          Reach millions of customers. List your products and grow your business.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-[700px] mx-auto">
          {[["🚀", "Quick Setup"], ["💰", "Fast Payouts"], ["📊", "Live Analytics"], ["🛡️", "Secure Platform"]].map(([i, l]) => (
            <div key={l} className="bg-white/[.06] border border-white/10 rounded-[var(--radius-md)] p-4 text-center">
              <div className="text-2xl mb-2">{i}</div>
              <div className="text-xs font-bold text-white/85">{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[760px] mx-auto px-[clamp(16px,4vw,40px)] pt-10 pb-16">
        {error && <Alert variant="error" className="mb-5">{error}</Alert>}

        <form onSubmit={submit} className="space-y-5">
          {/* Shop Info */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FaStore className="text-accent" size={16} aria-hidden="true" />Shop Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Shop Name *"><Input value={form.shopName} onChange={set("shopName")} placeholder="Your shop name" /></Field>
              <Field label="Shop Category *">
                <Select
                  value={form.shopCategory}
                  onChange={set("shopCategory")}
                  required
                  placeholder="-- Select Category --"
                  options={[
                    ...categories.map((cat) => ({
                      value: cat.slug || cat.name,
                      label: `${cat.emoji ? cat.emoji + " " : ""}${cat.name}`,
                    })),
                    { value: "other", label: "Other" },
                  ]}
                />
              </Field>
              <Field label="Shop Description" full><Textarea rows={3} value={form.shopDescription} onChange={set("shopDescription")} placeholder="Tell us about your shop..." /></Field>
            </div>
          </Card>

          {/* Owner Info */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FaUser className="text-accent" size={16} aria-hidden="true" />Owner / Contact Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Owner Name *"><Input value={form.ownerName} onChange={set("ownerName")} /></Field>
              <Field label="Email *"><Input type="email" value={form.email} onChange={set("email")} /></Field>
              <Field label="Phone *"><Input value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" /></Field>
              <Field label="Business Type">
                <Select
                  value={form.businessType}
                  onChange={set("businessType")}
                  options={[
                    { value: "individual", label: "Individual" },
                    { value: "proprietorship", label: "Proprietorship" },
                    { value: "partnership", label: "Partnership" },
                    { value: "pvtltd", label: "Pvt. Ltd." },
                  ]}
                />
              </Field>
              <Field label="GST Number"><Input value={form.gstNumber} onChange={set("gstNumber")} placeholder="15-digit GST" /></Field>
              <Field label="PAN Number"><Input value={form.panNumber} onChange={set("panNumber")} placeholder="AAAAA0000A" /></Field>
            </div>
          </Card>

          {/* Address */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FaMapMarkerAlt className="text-accent" size={16} aria-hidden="true" />Shop Address & Service Area
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Address Line 1 *" full><Input value={form.addressLine1} onChange={set("addressLine1")} placeholder="Shop no., Street" /></Field>
              <Field label="Address Line 2"><Input value={form.addressLine2} onChange={set("addressLine2")} /></Field>
              <Field label="City *"><Input value={form.city} onChange={set("city")} /></Field>
              <Field label="State *"><Input value={form.state} onChange={set("state")} /></Field>
              <Field label="Pincode *"><Input value={form.pincode} onChange={set("pincode")} placeholder="6-digit pincode" maxLength={6} /></Field>
            </div>
          </Card>

          {/* Bank Details */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FaUniversity className="text-accent" size={16} aria-hidden="true" />Bank Account Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account Holder Name"><Input value={form.bankHolder} onChange={set("bankHolder")} /></Field>
              <Field label="Account Number"><Input value={form.bankAccount} onChange={set("bankAccount")} /></Field>
              <Field label="IFSC Code"><Input value={form.bankIFSC} onChange={set("bankIFSC")} placeholder="SBIN0001234" /></Field>
              <Field label="Bank Name"><Input value={form.bankName} onChange={set("bankName")} /></Field>
            </div>
          </Card>

          {/* Documents */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FiUpload className="text-accent" size={16} aria-hidden="true" />Documents Upload
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                ["shopLogo", "Shop Logo (Image)"],
                ["gstCertificate", "GST Certificate (PDF/Image)"],
                ["panCard", "PAN Card"],
                ["cancelledCheque", "Cancelled Cheque"],
              ].map(([k, label]) => (
                <Field key={k} label={label}>
                  <label
                    className={cn(
                      "flex flex-col items-center justify-center border-2 border-dashed rounded-[var(--radius-sm)] p-5 text-center cursor-pointer transition-colors duration-150",
                      files[k] ? "border-[var(--accent-primary)] bg-accent-tint" : "border-default hover:border-strong"
                    )}
                  >
                    <FiUpload size={16} className={files[k] ? "text-accent" : "text-muted"} aria-hidden="true" />
                    <div className={cn("text-xs mt-1.5", files[k] ? "text-accent" : "text-muted")}>
                      {files[k] ? files[k].name : "Choose file"}
                    </div>
                    <input type="file" accept="image/*,.pdf" onChange={setFile(k)} className="hidden" />
                  </label>
                </Field>
              ))}
            </div>
          </Card>

          <Button type="submit" variant="primary" className="w-full" loading={submitting} icon={submitting ? undefined : FiCheckCircle}>
            Submit Application
          </Button>
        </form>
      </div>
    </div>
  );
};

export default BecomeVendor;
