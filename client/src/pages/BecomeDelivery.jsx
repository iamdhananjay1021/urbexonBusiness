/**
 * BecomeDelivery.jsx — Delivery Partner Application
 * Route: /become-delivery
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import * as deliveryApi from "../api/deliveryApi";
import { FiUpload, FiArrowRight } from "react-icons/fi";
import { FaMotorcycle } from "react-icons/fa";
import SEO from "../components/SEO";
import Card from "../design-system/Card";
import Input from "../design-system/Input";
import Select from "../design-system/Select";
import Button from "../design-system/Button";
import Alert from "../design-system/Alert";
import Loader from "../design-system/Loader";
import Badge from "../design-system/Badge";
import { cn } from "../design-system/utils/cn";

const BecomeDelivery = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState({});
  const [form, setForm] = useState({
    name: user?.name || "", phone: user?.phone || "",
    vehicleType: "motorcycle", vehicleNumber: "", vehicleModel: "", city: "",
  });

  useEffect(() => {
    if (!user) { navigate("/login", { state: { from: "/become-delivery" } }); return; }
    deliveryApi.getDeliveryStatus()
      .then(({ data }) => { if (data.registered) setStatus(data); else setStatus(false); })
      .catch(() => setStatus(false))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const setFile = k => e => { const f = e.target.files[0]; if (f) setFiles(p => ({ ...p, [k]: f })); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.vehicleType) return setError("Name, phone, and vehicle type are required");
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      Object.entries(files).forEach(([k, f]) => fd.append(k, f));
      await deliveryApi.registerDelivery(fd);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally { setSubmitting(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <Loader size="lg" />
    </div>
  );

  if (status) {
    const cfg = {
      pending: { icon: "⏳", title: "Under Review", msg: "You will receive an update within 24-48 hours." },
      approved: { icon: "✅", title: "Approved! Start Delivering", msg: "Login to your dashboard." },
      rejected: { icon: "❌", title: "Rejected", msg: status.rider?.adminNote || "Please contact support." },
    };
    const c = cfg[status.status] || cfg.pending;
    return (
      <div className="min-h-screen bg-canvas">
        <SEO title="Become a Delivery Partner" noindex />
        <div className="py-20 px-5 text-center">
          <div className="text-5xl mb-3">{c.icon}</div>
          <h2 className="text-xl font-bold text-primary mb-2 font-display">{c.title}</h2>
          <p className="text-sm text-secondary mb-5">{c.msg}</p>
          {status.status === "approved" && (
            <a
              href={(import.meta.env.VITE_DELIVERY_URL || "http://localhost:5176") + "/dashboard"}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-[var(--radius-md)] bg-[var(--color-graphite-900)] text-[var(--color-success-500)] font-bold text-[13px] no-underline"
            >
              Delivery Dashboard <FiArrowRight size={11} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    );
  }

  if (success) return (
    <div className="min-h-screen bg-canvas">
      <SEO title="Become a Delivery Partner" noindex />
      <div className="py-20 px-5 text-center">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-xl font-bold text-primary mb-2 font-display">Registration Successful!</h2>
        <p className="text-sm text-secondary mb-6">You will be approved within 24-48 hours. Download the app.</p>
        <Button variant="primary" onClick={() => navigate("/")}>Go to Home</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <SEO title="Become a Delivery Partner" description="Join Urbexon as a delivery partner. Flexible hours, guaranteed earnings, and instant payouts." path="/become-delivery" />

      <div className="bg-[var(--color-graphite-900)] text-white text-center px-[clamp(20px,6vw,80px)] py-14">
        <Badge variant="success" className="mb-5"><FaMotorcycle size={11} className="mr-1" aria-hidden="true" />Delivery Partner</Badge>
        <h1 className="font-display text-[clamp(26px,5vw,40px)] font-bold mb-3">
          Become a Delivery Partner<br />
          <span className="text-[var(--color-success-500)]">Earn on Your Schedule</span>
        </h1>
        <p className="text-sm text-white/65 max-w-[400px] mx-auto">Flexible hours, guaranteed earnings, and instant payouts.</p>
      </div>

      <div className="max-w-[680px] mx-auto px-[clamp(16px,4vw,40px)] pt-10 pb-16">
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}
        <form onSubmit={submit} className="space-y-5">
          <Card padding="lg">
            <div className="font-extrabold text-[15px] text-primary mb-1">Personal Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <Input label="Full Name *" value={form.name} onChange={set("name")} required />
              <Input label="Phone *" value={form.phone} onChange={set("phone")} required />
              <Input label="City *" value={form.city} onChange={set("city")} />
            </div>
          </Card>

          <Card padding="lg">
            <div className="font-extrabold text-[15px] text-primary mb-1">Vehicle Details</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
              <Select
                label="Vehicle Type *"
                value={form.vehicleType}
                onChange={set("vehicleType")}
                options={[
                  { value: "bicycle", label: "Bicycle" },
                  { value: "scooter", label: "Scooter" },
                  { value: "motorcycle", label: "Motorcycle" },
                  { value: "car", label: "Car" },
                ]}
              />
              <Input label="Vehicle Number" value={form.vehicleNumber} onChange={set("vehicleNumber")} placeholder="UP32 AB 1234" />
              <Input label="Vehicle Model" value={form.vehicleModel} onChange={set("vehicleModel")} placeholder="Honda Activa" />
            </div>
          </Card>

          <Card padding="lg">
            <div className="font-extrabold text-[15px] text-primary mb-4">Documents Upload</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[["aadhaarPhoto", "Aadhaar Card *"], ["licensePhoto", "Driving License *"], ["vehicleRc", "Vehicle RC"], ["selfie", "Selfie Photo"]].map(([k, l]) => (
                <div key={k}>
                  <label className="block text-[13px] font-semibold text-primary mb-1.5">{l}</label>
                  <label
                    className={cn(
                      "flex flex-col items-center justify-center border-2 border-dashed rounded-[var(--radius-sm)] p-4 text-center cursor-pointer transition-colors duration-150",
                      files[k] ? "border-[var(--color-success-500)] bg-success-tint" : "border-default hover:border-strong"
                    )}
                  >
                    <FiUpload size={16} className={files[k] ? "text-[var(--color-success-500)]" : "text-muted"} aria-hidden="true" />
                    <div className={cn("text-[11px] mt-1.5", files[k] ? "text-success" : "text-muted")}>
                      {files[k] ? files[k].name : "Choose file"}
                    </div>
                    <input type="file" accept="image/*,.pdf" onChange={setFile(k)} className="hidden" />
                  </label>
                </div>
              ))}
            </div>
          </Card>

          <Button type="submit" variant="primary" className="w-full" loading={submitting}>
            Submit Registration ✓
          </Button>
        </form>
      </div>
    </div>
  );
};

export default BecomeDelivery;
