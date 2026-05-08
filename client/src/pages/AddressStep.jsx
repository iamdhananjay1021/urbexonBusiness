import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../hooks/useCart";

const AddressStep = () => {
    const navigate = useNavigate();
    const { cartItems, totalPrice } = useCart();

    const [form, setForm] = useState({
        pincode: "",
        city: "",
        state: "",
    });

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSaveAndContinue = () => {
        const { pincode, city, state } = form;

        if (!/^\d{6}$/.test(pincode)) {
            alert("Enter valid 6-digit pincode");
            return;
        }
        if (!city.trim() || !state.trim()) {
            alert("City and State are required");
            return;
        }

        // ✅ Save address
        localStorage.setItem(
            "delivery_address",
            JSON.stringify(form)
        );

        // ✅ Build WhatsApp message
        let message = `🛒 *New Order*\n\n`;

        cartItems.forEach((item, i) => {
            message += `${i + 1}. ${item.name} x ${item.quantity || 1
                } = ₹${item.price}\n`;
        });

        message += `\n📍 *Delivery Address*\n`;
        message += `${city}, ${state} - ${pincode}\n\n`;
        message += `💰 *Total:* ₹${totalPrice}\n`;
        message += `🚚 *Payment:* Cash on Delivery`;

        const whatsappNumber = "918808485840"; // 👈 Add your number here
        const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
            message
        )}`;

        // ✅ REDIRECT TO WHATSAPP
        window.location.href = whatsappUrl;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0b0f1a] px-4">
            <div className="w-full max-w-md bg-[#0f172a] rounded-3xl p-8 shadow-2xl">
                <h2 className="text-2xl font-bold text-emerald-400 text-center mb-6">
                    Delivery Address
                </h2>

                <input
                    name="pincode"
                    placeholder="Pincode"
                    value={form.pincode}
                    onChange={handleChange}
                    className="w-full mb-4 p-3 rounded-xl bg-[#020617] text-white border border-slate-700"
                />

                <input
                    name="city"
                    placeholder="City"
                    value={form.city}
                    onChange={handleChange}
                    className="w-full mb-4 p-3 rounded-xl bg-[#020617] text-white border border-slate-700"
                />

                <input
                    name="state"
                    placeholder="State"
                    value={form.state}
                    onChange={handleChange}
                    className="w-full mb-6 p-3 rounded-xl bg-[#020617] text-white border border-slate-700"
                />

                {/* ✅ REAL BUTTON */}
                <button
                    type="button"
                    onClick={handleSaveAndContinue}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-lg"
                >
                    Save & Continue
                </button>

                <p className="text-xs text-slate-400 text-center mt-4">
                    Address will be used for delivery
                </p>
            </div>
        </div>
    );
};

export default AddressStep;