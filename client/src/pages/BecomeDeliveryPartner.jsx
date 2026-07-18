/**
 * BecomeDeliveryPartner.jsx — Delivery Partner Application Page
 * Route: /become-delivery
 * Mirrors BecomeVendor.jsx's structure/flow, wired to the LIVE
 * POST /api/delivery/register + GET /api/delivery/status endpoints
 * (same DeliveryBoy record delivery-panel's own apply wizard and
 * the admin /api/admin/delivery-boys approval screens use).
 * Field set matches deliveryRoutes.js's validateBody exactly.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as deliveryApi from "../api/deliveryApi";
import { FiUpload, FiArrowRight, FiCheckCircle, FiMapPin } from "react-icons/fi";
import { FaMotorcycle, FaUser, FaUniversity, FaMapMarkerAlt, FaPhoneAlt } from "react-icons/fa";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
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

const REQUIRED_DOCS = ["aadhaarPhoto", "selfie"];
const OPTIONAL_DOCS = ["licensePhoto", "vehicleRc"];
const DOC_LABELS = {
  aadhaarPhoto: "Aadhaar Card *",
  selfie: "Live Selfie *",
  licensePhoto: "Driving License",
  vehicleRc: "Vehicle RC",
};

const BecomeDeliveryPartner = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null); // null=loading, false=not-applied, {status}=applied
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState({});
  const [locating, setLocating] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || "", phone: user?.phone || "", email: user?.email || "",
    dateOfBirth: "", gender: "",
    vehicleType: "", vehicleNumber: "", vehicleModel: "",
    houseNumber: "", landmark: "", area: "", city: "", district: "", state: "", pincode: "",
    latitude: "", longitude: "",
    emergencyContactName: "", emergencyContactPhone: "",
    accountHolder: "", bankName: "", accountNumber: "", ifsc: "", upiId: "",
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/login", { state: { from: "/become-delivery" } });
      return;
    }

    deliveryApi.getDeliveryStatus()
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

  const captureLocation = () => {
    if (!navigator.geolocation) {
      setError("Location access isn't supported on this device/browser");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(p => ({
          ...p,
          latitude: String(pos.coords.latitude),
          longitude: String(pos.coords.longitude),
        }));
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location. Please allow location access and try again.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.vehicleType)
      return setError("Name, phone, and vehicle type are required");
    if (!/^[6-9]\d{9}$/.test(form.phone.trim()))
      return setError("Enter a valid 10-digit mobile number");
    if (!form.dateOfBirth || !form.gender)
      return setError("Date of birth and gender are required");
    if (!form.houseNumber || !form.area || !form.city || !form.district || !form.state)
      return setError("Complete address is required");
    if (!/^\d{6}$/.test(form.pincode))
      return setError("Enter a valid 6-digit pincode");
    if (!form.latitude || !form.longitude)
      return setError("Please capture your current location");
    if (!form.emergencyContactName || !/^[6-9]\d{9}$/.test(form.emergencyContactPhone.trim()))
      return setError("A valid emergency contact name and phone are required");
    if (!form.accountHolder || !form.bankName || !/^\d{9,18}$/.test(form.accountNumber))
      return setError("Valid bank account details are required");
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifsc.trim().toUpperCase()))
      return setError("Enter a valid IFSC code");
    if (!form.upiId)
      return setError("UPI ID is required for payouts");
    for (const doc of REQUIRED_DOCS) {
      if (!files[doc]) return setError(`${DOC_LABELS[doc].replace(" *", "")} is required`);
    }

    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append("ifsc", form.ifsc.trim().toUpperCase());
      Object.entries(files).forEach(([k, f]) => fd.append(k, f));

      await deliveryApi.registerDelivery(fd);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit application");
    } finally { setSubmitting(false); }
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <Loader size="lg" />
    </div>
  );

  if (!user) return null;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <Loader size="lg" />
    </div>
  );

  if (status) {
    const cfg = {
      pending: { border: "border-[var(--color-warning-500)]", icon: "⏳", title: "Application Under Review", msg: "Your application is under review. You will receive an update within 24-48 hours." },
      approved: { border: "border-[var(--color-success-500)]", icon: "✅", title: "You are an Approved Delivery Partner!", msg: "Congratulations! You can now go online and start accepting deliveries." },
      rejected: { border: "border-[var(--color-error-500)]", icon: "❌", title: "Application Rejected", msg: `Reason: ${status.rider?.rejectionReason || "Please contact support."}` },
      suspended: { border: "border-[var(--color-error-500)]", icon: "⛔", title: "Account Suspended", msg: "Your delivery partner account is currently suspended. Please contact support." },
    };
    const c = cfg[status.status] || cfg.pending;
    return (
      <div className="min-h-screen bg-canvas">
        <SEO title="Become a Delivery Partner" noindex />
        <div className="py-16 px-5">
          <Card padding="lg" className={cn("border-2 text-center max-w-[500px] mx-auto", c.border)}>
            <div className="text-5xl mb-3">{c.icon}</div>
            <h2 className="text-xl font-bold text-primary mb-2 font-display">{c.title}</h2>
            <p className="text-sm text-secondary mb-6 leading-relaxed">{c.msg}</p>

            <div className="flex gap-3 justify-center flex-wrap">
              {status.status === "approved" && (
                <a
                  href={(import.meta.env.VITE_DELIVERY_URL || "http://localhost:5176") + "/dashboard"}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-md)] bg-[var(--color-graphite-900)] text-accent font-bold text-[13px] no-underline"
                >
                  Delivery Dashboard <FiArrowRight size={11} aria-hidden="true" />
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
      <SEO title="Become a Delivery Partner" noindex />
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
      <SEO title="Become a Delivery Partner" description="Ride with Urbexon. Earn on your own schedule as a delivery partner and get paid weekly." path="/become-delivery" />

      <div className="bg-[var(--color-graphite-900)] text-white text-center px-[clamp(20px,6vw,80px)] py-14">
        <div className="inline-flex items-center gap-1.5 bg-accent-tint border border-[var(--accent-primary)]/40 text-accent px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wide uppercase mb-5">
          <FaMotorcycle size={11} aria-hidden="true" />Delivery Partner Program
        </div>
        <h1 className="font-display text-[clamp(26px,5vw,44px)] font-bold mb-3">
          Earn On Your Own Time with <span className="text-accent">Urbexon</span>
        </h1>
        <p className="text-sm text-white/65 max-w-[500px] mx-auto mb-8 leading-relaxed">
          Flexible hours, weekly payouts. Deliver near you and grow your earnings.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 max-w-[700px] mx-auto">
          {[["🕒", "Flexible Hours"], ["💰", "Weekly Payouts"], ["📍", "Deliver Near You"], ["🛡️", "Rider Support"]].map(([i, l]) => (
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
          {/* Personal Info */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FaUser className="text-accent" size={16} aria-hidden="true" />Personal Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name *"><Input value={form.name} onChange={set("name")} placeholder="Your full name" /></Field>
              <Field label="Phone *"><Input value={form.phone} onChange={set("phone")} placeholder="10-digit mobile number" /></Field>
              <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} /></Field>
              <Field label="Date of Birth *"><Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} /></Field>
              <Field label="Gender *">
                <Select
                  value={form.gender}
                  onChange={set("gender")}
                  placeholder="-- Select Gender --"
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </Field>
            </div>
          </Card>

          {/* Vehicle Info */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FaMotorcycle className="text-accent" size={16} aria-hidden="true" />Vehicle Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Vehicle Type *">
                <Select
                  value={form.vehicleType}
                  onChange={set("vehicleType")}
                  placeholder="-- Select Vehicle --"
                  options={[
                    { value: "bicycle", label: "Bicycle" },
                    { value: "scooter", label: "Scooter" },
                    { value: "motorcycle", label: "Motorcycle" },
                    { value: "car", label: "Car" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </Field>
              <Field label="Vehicle Number"><Input value={form.vehicleNumber} onChange={set("vehicleNumber")} placeholder="e.g. DL01AB1234" /></Field>
              <Field label="Vehicle Model"><Input value={form.vehicleModel} onChange={set("vehicleModel")} /></Field>
            </div>
          </Card>

          {/* Address & Location */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FaMapMarkerAlt className="text-accent" size={16} aria-hidden="true" />Address & Service Location
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="House / Building No. *"><Input value={form.houseNumber} onChange={set("houseNumber")} /></Field>
              <Field label="Landmark"><Input value={form.landmark} onChange={set("landmark")} /></Field>
              <Field label="Area *"><Input value={form.area} onChange={set("area")} /></Field>
              <Field label="City *"><Input value={form.city} onChange={set("city")} /></Field>
              <Field label="District *"><Input value={form.district} onChange={set("district")} /></Field>
              <Field label="State *"><Input value={form.state} onChange={set("state")} /></Field>
              <Field label="Pincode *"><Input value={form.pincode} onChange={set("pincode")} placeholder="6-digit pincode" maxLength={6} /></Field>
              <Field label="Current Location *">
                <Button type="button" variant="secondary" onClick={captureLocation} loading={locating} icon={FiMapPin} className="w-full">
                  {form.latitude ? "Location Captured ✓" : "Capture My Location"}
                </Button>
              </Field>
            </div>
          </Card>

          {/* Emergency Contact */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FaPhoneAlt className="text-accent" size={16} aria-hidden="true" />Emergency Contact
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Name *"><Input value={form.emergencyContactName} onChange={set("emergencyContactName")} /></Field>
              <Field label="Contact Phone *"><Input value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} placeholder="10-digit mobile number" /></Field>
            </div>
          </Card>

          {/* Bank Details */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FaUniversity className="text-accent" size={16} aria-hidden="true" />Bank Account Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account Holder Name *"><Input value={form.accountHolder} onChange={set("accountHolder")} /></Field>
              <Field label="Account Number *"><Input value={form.accountNumber} onChange={set("accountNumber")} /></Field>
              <Field label="IFSC Code *"><Input value={form.ifsc} onChange={set("ifsc")} placeholder="SBIN0001234" /></Field>
              <Field label="Bank Name *"><Input value={form.bankName} onChange={set("bankName")} /></Field>
              <Field label="UPI ID *" full><Input value={form.upiId} onChange={set("upiId")} placeholder="yourname@upi" /></Field>
            </div>
          </Card>

          {/* Documents */}
          <Card padding="lg">
            <div className="flex items-center gap-2.5 text-base font-extrabold text-primary mb-5">
              <FiUpload className="text-accent" size={16} aria-hidden="true" />Documents Upload
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...REQUIRED_DOCS, ...OPTIONAL_DOCS].map((k) => (
                <Field key={k} label={DOC_LABELS[k]}>
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

export default BecomeDeliveryPartner;
