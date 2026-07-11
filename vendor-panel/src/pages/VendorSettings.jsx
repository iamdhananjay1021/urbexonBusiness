import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import { FaSave, FaSpinner, FaMapMarkerAlt, FaTimes } from "react-icons/fa";

const SettingsCard = ({ title, children }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">{children}</div>
);

const TagInput = ({ tags, setTags }) => {
    const [input, setInput] = useState("");

    const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const newTag = input.trim();
            if (newTag && /^\d{6}$/.test(newTag) && !tags.includes(newTag) && tags.length < 50) {
                setTags([...tags, newTag]);
                setInput("");
            }
        }
    };

    const removeTag = (tagToRemove) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    return (
        <div>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a 6-digit pincode and press Enter"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            />
            <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded-full">
                        {tag}
                        <button onClick={() => removeTag(tag)} className="text-blue-600 hover:text-blue-800">
                            <FaTimes size={12} />
                        </button>
                    </span>
                ))}
            </div>
        </div>
    );
};

const VendorSettings = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: "", text: "" });
    const [formData, setFormData] = useState({
        shopName: "",
        shopDescription: "",
        isOpen: true,
        deliveryRadius: 5,
        servicePincodes: [],
        lat: null,
        lng: null,
    });

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: "", text: "" }), 4000);
    };

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get("/vendor/settings");
            setFormData({
                shopName: data.shopName || "",
                shopDescription: data.shopDescription || "",
                isOpen: data.isOpen !== false,
                deliveryRadius: data.deliveryRadius || 5,
                servicePincodes: data.servicePincodes || [],
                lat: data.shopLat || null,
                lng: data.shopLng || null,
            });
        } catch (error) {
            showMessage("error", "Failed to load settings.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "checkbox" ? checked : value,
        }));
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await api.put("/vendor/settings", formData);
            showMessage("success", "Settings saved successfully!");
        } catch (error) {
            showMessage("error", error.response?.data?.message || "Failed to save settings.");
        } finally {
            setSaving(false);
        }
    };

    const handleDetectLocation = () => {
        if (!navigator.geolocation) {
            showMessage("error", "Geolocation is not supported by your browser.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData(prev => ({
                    ...prev,
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                }));
                showMessage("success", "Location detected! Click Save to apply.");
            },
            () => {
                showMessage("error", "Unable to retrieve your location. Please grant permission.");
            }
        );
    };

    if (loading) {
        return <div className="p-6 text-center"><FaSpinner className="animate-spin inline-block" /> Loading settings...</div>;
    }

    return (
        <div className="p-6 bg-gray-50 min-h-screen space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Vendor Settings</h1>

            {message.text && (
                <div className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {message.text}
                </div>
            )}

            <SettingsCard>
                <h2 className="text-lg font-semibold mb-4">Shop Information</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Shop Name</label>
                        <input type="text" name="shopName" value={formData.shopName} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Shop Description</label>
                        <textarea name="shopDescription" value={formData.shopDescription} onChange={handleChange} rows="3" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"></textarea>
                    </div>
                    <div className="flex items-center">
                        <input type="checkbox" name="isOpen" checked={formData.isOpen} onChange={handleChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded" />
                        <label className="ml-2 block text-sm text-gray-900">Open for Business</label>
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard>
                <h2 className="text-lg font-semibold mb-4">Delivery Zone</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Delivery Radius ({formData.deliveryRadius} km)</label>
                        <input type="range" name="deliveryRadius" min="1" max="10" value={formData.deliveryRadius} onChange={handleChange} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Serviceable Pincodes</label>
                        <TagInput tags={formData.servicePincodes} setTags={(tags) => setFormData(prev => ({ ...prev, servicePincodes: tags }))} />
                    </div>
                </div>
            </SettingsCard>

            <SettingsCard>
                <h2 className="text-lg font-semibold mb-4">Shop Location</h2>
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <button onClick={handleDetectLocation} className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">
                            <FaMapMarkerAlt /> Use my current location
                        </button>
                        {formData.lat && formData.lng && (
                            <p className="text-sm text-gray-600">
                                Location set: {formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Latitude</label>
                            <input type="number" name="lat" value={formData.lat || ""} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Longitude</label>
                            <input type="number" name="lng" value={formData.lng || ""} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                        </div>
                    </div>
                </div>
            </SettingsCard>

            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
                    Save All Settings
                </button>
            </div>
        </div>
    );
};

export default VendorSettings;