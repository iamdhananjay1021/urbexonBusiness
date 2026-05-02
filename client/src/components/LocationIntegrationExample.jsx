import { useEffect, useState } from "react";
import { useLocation } from "../contexts/LocationContext";
import {
    LocationModal,
    LocationMap,
    LocationCard,
    LocationLoading,
} from "./LocationDetector";

/**
 * Example Implementation: App Component with Location Integration
 * 
 * This demonstrates how to:
 * 1. Use the LocationProvider
 * 2. Handle location detection
 * 3. Display location on map
 * 4. Handle errors gracefully
 * 5. Implement location-based features
 */

export const LocationIntegrationExample = () => {
    const {
        locationData,
        loading,
        error,
        status,
        modalOpen,
        setModalOpen,
        detectLocation,
    } = useLocation();

    const [showMap, setShowMap] = useState(false);

    // Auto-detect location on mount (optional)
    useEffect(() => {
        // Uncomment to auto-detect on page load
        // if (!locationData && !loading) {
        //     detectLocation();
        // }
    }, []);

    // Handle location change
    const handleChangeLocation = () => {
        setModalOpen(true);
    };

    // Render loading state
    if (loading && status === "detecting") {
        return <LocationLoading />;
    }

    return (
        <div className="w-full max-w-2xl mx-auto p-4">
            {/* Page Title */}
            <h1 className="text-2xl font-bold mb-6">Delivery Location</h1>

            {/* Location Card */}
            {locationData && status === "success" && (
                <>
                    <LocationCard onChangeLocation={handleChangeLocation} />

                    {/* Map Toggle & Display */}
                    <div className="mt-6">
                        <button
                            onClick={() => setShowMap(!showMap)}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                            {showMap ? "Hide Map" : "Show Map"}
                        </button>

                        {showMap && (
                            <div className="mt-4">
                                <LocationMap showMarker={true} className="h-96" />
                            </div>
                        )}
                    </div>

                    {/* Location Details */}
                    <div className="mt-6 bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-semibold mb-2">Location Details</h3>
                        <dl className="grid grid-cols-2 gap-2 text-sm">
                            <dt className="text-gray-600">City:</dt>
                            <dd className="font-medium">{locationData.city}</dd>

                            <dt className="text-gray-600">Pincode:</dt>
                            <dd className="font-medium">{locationData.pincode || "N/A"}</dd>

                            <dt className="text-gray-600">Latitude:</dt>
                            <dd className="font-medium">{locationData.lat?.toFixed(4)}</dd>

                            <dt className="text-gray-600">Longitude:</dt>
                            <dd className="font-medium">{locationData.lng?.toFixed(4)}</dd>

                            {locationData.accuracy && (
                                <>
                                    <dt className="text-gray-600">Accuracy:</dt>
                                    <dd className="font-medium">{locationData.accuracy}m</dd>
                                </>
                            )}

                            <dt className="text-gray-600">Source:</dt>
                            <dd className="font-medium capitalize">
                                {locationData.source || "Unknown"}
                            </dd>
                        </dl>
                    </div>
                </>
            )}

            {/* No Location State */}
            {!locationData && status !== "detecting" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <p className="text-gray-700 mb-4">No location detected</p>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                        Detect Location
                    </button>
                </div>
            )}

            {/* Error State */}
            {error && status === "failed" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700 text-sm">{error}</p>
                    <button
                        onClick={() => setModalOpen(true)}
                        className="mt-3 text-red-600 hover:text-red-700 font-medium text-sm"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Location Detection Modal */}
            <LocationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
        </div>
    );
};

export default LocationIntegrationExample;