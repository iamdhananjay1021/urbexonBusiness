// src/hooks/useUserLocation.js
import { useEffect, useState } from "react";

const STORAGE_KEY = "user_location_v1";

const useUserLocation = () => {
    const [location, setLocation] = useState(null);
    const [label, setLabel] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Load saved location
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            setLocation(data.location);
            setLabel(data.label);
        }
    }, []);

    const detectLocation = () => {
        // 🔒 Browser security check
        if (!window.isSecureContext) {
            setError("Location works only on HTTPS or localhost");
            return;
        }

        if (!navigator.geolocation) {
            setError("Geolocation not supported");
            return;
        }

        setLoading(true);
        setError("");

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;

                let place = "Your location";
                try {
                    const res = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                    );
                    const data = await res.json();
                    place =
                        data.address?.city ||
                        data.address?.town ||
                        data.address?.village ||
                        place;
                } catch { /* reverse-geocode lookup failed — place stays at its "Your location" default above */ }

                const payload = {
                    location: { latitude, longitude },
                    label: place,
                };

                localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
                setLocation(payload.location);
                setLabel(place);
                setLoading(false);
            },
            () => {
                setError("Location permission denied");
                setLoading(false);
            }
        );
    };

    return {
        location,
        label,
        loading,
        error,
        detectLocation,
    };
};

export default useUserLocation;