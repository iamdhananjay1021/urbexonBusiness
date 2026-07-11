import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons missing in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to automatically center the map when location updates
const MapCenterer = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 15); // Zoom level 15 for close street view
    }
  }, [center, map]);
  return null;
};

const AccurateLocationMap = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accuracy, setAccuracy] = useState(null);
  
  // Manual input fallbacks
  const [manualAddress, setManualAddress] = useState('');
  const [useManualInput, setUseManualInput] = useState(false);

  // Use a ref to track retries without triggering re-renders
  const retryCount = useRef(0);
  const MAX_RETRIES = 2;
  const ACCEPTABLE_ACCURACY = 100; // Require accuracy within 100 meters

  // BUG FIX: neither the IP-lookup fetch, the getCurrentPosition callbacks,
  // nor the 1.5s retry setTimeout were ever cancelled/guarded on unmount —
  // navigating away mid-retry let a delayed response call setState on an
  // already-unmounted component.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // 1. IP-Based Fallback Location
  const fetchIPBasedLocation = async () => {
    try {
      setLoading(true);
      // Fetching from ipapi (free, no API key required for low volume)
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      if (!isMountedRef.current) return;

      if (data.latitude && data.longitude) {
        setLocation([data.latitude, data.longitude]);
        setAccuracy(null); // Mark as approximate
        setError('Using approximate IP-based location. Precise location unavailable.');
      } else {
        throw new Error('IP Location failed');
      }
    } catch {
      if (!isMountedRef.current) return;
      setError('Could not fetch IP location. Please enter your address manually.');
      setUseManualInput(true);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  // 2. High-Accuracy Browser Geolocation
  const getAccurateLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      fetchIPBasedLocation();
      return;
    }

    setLoading(true);
    setError(null);

    // NOTE: Geolocation API requires HTTPS or localhost in production
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (!isMountedRef.current) return;
        const { latitude, longitude, accuracy: posAccuracy } = position.coords;

        // 3. Retry logic if accuracy is poor
        if (posAccuracy > ACCEPTABLE_ACCURACY && retryCount.current < MAX_RETRIES) {
          retryCount.current += 1;
          console.warn(`Accuracy too low (${posAccuracy}m). Retrying... ${retryCount.current}/${MAX_RETRIES}`);
          // Add a short delay before trying again to let GPS lock stabilize
          setTimeout(() => { if (isMountedRef.current) getAccurateLocation(); }, 1500);
          return;
        }

        // Check if accuracy is still poor after retries
        if (posAccuracy > ACCEPTABLE_ACCURACY) {
          setError(`Location accuracy is low (${posAccuracy.toFixed(0)}m). You might want to enter it manually.`);
        } else {
          setError(null);
        }

        setLocation([latitude, longitude]);
        setAccuracy(posAccuracy);
        setLoading(false);
      },
      (err) => {
        if (!isMountedRef.current) return;
        setLoading(false);

        // 4. Handle Permissions and Errors
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location permission denied. Please allow access or enter address manually.');
          setUseManualInput(true);
        } else {
          console.warn(`Geolocation failed (Code: ${err.code}). Falling back to IP location.`);
          fetchIPBasedLocation();
        }
      },
      {
        enableHighAccuracy: true, // Forces GPS/Wi-Fi positioning over cell towers
        timeout: 10000,           // 10 seconds timeout
        maximumAge: 0             // Forces a fresh location read instead of cached
      }
    );
  }, []);

  // Initialize fetch on mount
  useEffect(() => {
    getAccurateLocation();
  }, [getAccurateLocation]);

  const handleManualAddressSubmit = (e) => {
    e.preventDefault();
    if (!manualAddress.trim()) return;
    
    // In a production app, integrate a Geocoding service here (Nominatim, Google Maps, Mapbox)
    alert(`Searching for: ${manualAddress} \n(Requires Geocoding API integration to convert to Lat/Lng)`);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4 font-sans">
      <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-sm">
        <h2 className="text-xl font-semibold mb-2 text-gray-800">Your Current Location</h2>
        
        {/* Loading State */}
        {loading && (
          <p className="text-blue-600 flex items-center gap-2 font-medium">
            <span className="animate-spin text-xl">⏳</span> Fetching high-accuracy location...
          </p>
        )}
        
        {/* Error / Fallback Feedback */}
        {error && (
          <div className="text-red-700 mb-4 p-3 bg-red-50 rounded border border-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Success Feedback */}
        {accuracy && accuracy <= ACCEPTABLE_ACCURACY && !loading && (
          <p className="text-emerald-600 font-medium text-sm">
            ✓ High accuracy location secured (within {accuracy.toFixed(0)}m)
          </p>
        )}

        {/* Manual Input Fallback UI */}
        {useManualInput && (
          <form onSubmit={handleManualAddressSubmit} className="flex gap-2 mt-4">
            <input 
              type="text" 
              placeholder="Enter manual address (e.g., street, city)" 
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              className="flex-1 p-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              type="submit" 
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium cursor-pointer"
            >
              Search
            </button>
          </form>
        )}
      </div>

      {/* 5. Leaflet Map Integration */}
      <div className="h-[400px] w-full rounded-lg overflow-hidden border border-gray-300 shadow-md relative z-0">
        {location ? (
          <MapContainer center={location} zoom={15} className="h-full w-full">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapCenterer center={location} />
            <Marker position={location}>
              <Popup>
                <div className="text-center font-sans">
                  <strong>You are here</strong> <br /> 
                  {accuracy ? `Accuracy: ${accuracy.toFixed(0)} meters` : 'Approximate location'}
                </div>
              </Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-100 text-gray-500">
            {loading ? 'Map loading...' : 'Map not available without location.'}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccurateLocationMap;