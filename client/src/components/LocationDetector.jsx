import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { Icon } from "leaflet";
import { MapPin, Loader, AlertCircle, CheckCircle } from "lucide-react";
import { useLocation } from "../contexts/LocationContext";

/**
 * LocationDetector Component
 * 
 * Production-ready component for geolocation detection with:
 * - Browser geolocation API integration
 * - Leaflet map display
 * - Pincode fallback
 * - Permission handling
 * - Device-aware UX
 */

// Custom marker icon for user location
const userLocationIcon = new Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

/**
 * Modal for location detection
 * Shows when user needs to provide location
 */
export const LocationModal = ({ isOpen, onClose }) => {
    const {
        locationData,
        loading,
        error,
        status,
        deviceType,
        detectLocation,
        setPincode,
        isValidPincode,
    } = useLocation();

    const [pincode, setPincodeInput] = useState("");
    const [showPincodeInput, setShowPincodeInput] = useState(false);

    if (!isOpen) return null;

    const handleDetectLocation = () => {
        detectLocation();
    };

    const handlePincodeSubmit = async (e) => {
        e.preventDefault();
        const success = await setPincode(pincode);
        if (success) {
            setPincodeInput("");
            setShowPincodeInput(false);
            onClose();
        }
    };

    const renderStatusMessage = () => {
        if (status === "detecting") {
            return (
                <div className="flex items-center justify-center gap-2 text-blue-600">
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Detecting location...</span>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{error}</span>
                </div>
            );
        }

        if (status === "success" && locationData) {
            return (
                <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm">Location detected: {locationData.label}</span>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                    <MapPin className="w-6 h-6 text-blue-600" />
                    <h2 className="text-lg font-semibold">Detect Location</h2>
                </div>

                {/* Status Message */}
                {renderStatusMessage()}

                {/* Location Detection Section */}
                {!showPincodeInput && (
                    <div className="mt-4">
                        <p className="text-gray-600 text-sm mb-4">
                            {deviceType === "mobile"
                                ? "Enable location for accurate delivery"
                                : "We need your location for delivery. Enter pincode below."}
                        </p>

                        {deviceType === "mobile" && (
                            <button
                                onClick={handleDetectLocation}
                                disabled={loading}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <Loader className="w-4 h-4 animate-spin" />
                                        Detecting...
                                    </>
                                ) : (
                                    <>
                                        <MapPin className="w-4 h-4" />
                                        Detect My Location
                                    </>
                                )}
                            </button>
                        )}

                        <button
                            onClick={() => setShowPincodeInput(true)}
                            className="w-full mt-3 bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition"
                        >
                            Enter Pincode Instead
                        </button>
                    </div>
                )}

                {/* Pincode Input Section */}
                {showPincodeInput && (
                    <form onSubmit={handlePincodeSubmit} className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Enter 6-digit Pincode
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={pincode}
                                onChange={(e) => setPincodeInput(e.target.value.slice(0, 6))}
                                placeholder="e.g., 110001"
                                maxLength="6"
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                            />
                            <button
                                type="submit"
                                disabled={!isValidPincode(pincode) || loading}
                                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                {loading ? <Loader className="w-4 h-4 animate-spin" /> : "Go"}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setShowPincodeInput(false);
                                setPincodeInput("");
                            }}
                            className="w-full mt-2 text-gray-600 text-sm hover:text-gray-700"
                        >
                            Back
                        </button>
                    </form>
                )}

                {/* Footer Info */}
                {!showPincodeInput && (
                    <p className="text-xs text-gray-500 mt-4 text-center">
                        📍 HTTPS Required • Privacy Protected • No tracking
                    </p>
                )}
            </div>
        </div>
    );
};

/**
 * Map Display Component with marker at user location
 */
export const LocationMap = ({ showMarker = true, className = "" }) => {
    const { locationData } = useLocation();

    if (!locationData?.lat || !locationData?.lng) {
        return (
            <div className={`bg-gray-100 flex items-center justify-center rounded-lg ${className}`}>
                <p className="text-gray-600">No location detected</p>
            </div>
        );
    }

    return (
        <MapContainer
            center={[locationData.lat, locationData.lng]}
            zoom={15}
            className={`rounded-lg z-10 ${className}`}
            style={{ height: "300px", width: "100%" }}
        >
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap contributors'
            />
            {showMarker && (
                <Marker position={[locationData.lat, locationData.lng]} icon={userLocationIcon}>
                    <Popup>
                        <div className="text-center">
                            <p className="font-semibold">📍 You are here</p>
                            <p className="text-sm text-gray-600">{locationData.label}</p>
                            <p className="text-xs text-gray-400">
                                Accuracy: {locationData.accuracy ? `${locationData.accuracy}m` : "Pincode"}
                            </p>
                        </div>
                    </Popup>
                </Marker>
            )}
        </MapContainer>
    );
};

/**
 * Location Display Card
 * Shows current location with quick actions
 */
export const LocationCard = ({ onChangeLocation }) => {
    const { locationData, loading } = useLocation();

    if (!locationData) {
        return null;
    }

    return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-gray-600">📍 Delivery Location</p>
                    <p className="font-semibold text-gray-900">{locationData.fullLabel}</p>
                    {locationData.accuracy && (
                        <p className="text-xs text-gray-500 mt-1">
                            Accuracy: {locationData.accuracy}m {locationData.accuracy > 100 && "⚠️"}
                        </p>
                    )}
                </div>
                <button
                    onClick={onChangeLocation}
                    disabled={loading}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium disabled:opacity-50"
                >
                    Change
                </button>
            </div>
        </div>
    );
};

/**
 * Loading State Component
 */
export const LocationLoading = () => {
    return (
        <div className="flex items-center justify-center gap-2 py-4">
            <Loader className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-600">Detecting location...</span>
        </div>
    );
};

export default LocationModal;