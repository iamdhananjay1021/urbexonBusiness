# Production-Grade Location Detection System Setup Guide

## Overview

This guide provides step-by-step instructions to implement a production-ready location detection system using:
- **Browser Geolocation API** (high accuracy)
- **Leaflet Maps** (visualization)
- **React Context API** (state management)
- **Fallback pincode input** (user fallback)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│          LocationProvider (Context)                 │
│  ├─ locationData: { lat, lng, city, pincode, ... } │
│  ├─ status: idle | detecting | success | failed     │
│  ├─ loading, error, modalOpen                       │
│  ├─ Methods:                                        │
│  │  ├─ detectLocation() - GPS detection             │
│  │  ├─ setPincode() - Fallback                      │
│  │  ├─ setLocation() - Manual set                   │
│  │  └─ clearLocation() - Clear all                  │
│  └─ Utilities:                                      │
│     ├─ isMobileDevice()                             │
│     └─ isValidPincode()                             │
└─────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    Components        Hooks            Utils
    ├─ LocationModal  useLocation()  ├─ reverseGeocode
    ├─ LocationMap                   ├─ lookupPincode
    ├─ LocationCard                  ├─ isMobileDevice
    └─ LocationLoading               └─ cleanLabel
```

## Installation Steps

### 1. Dependencies Required

Ensure these packages are installed:

```bash
npm install leaflet react-leaflet lucide-react
```

Dependencies already in your package.json:
- ✅ react, react-dom
- ✅ axios
- ✅ lucide-react (icons)

### 2. Files to Copy/Create

```
src/
├── contexts/
│   └── LocationContext.jsx          ← MAIN LOGIC (production-ready)
├── components/
│   ├── LocationDetector.jsx         ← UI Components
│   └── LocationIntegrationExample.jsx ← Usage Example
└── config/
    └── location.config.js           ← Configuration (create new)
```

### 3. Environment Setup

Create `.env.local` in your `client/` folder:

```env
# Optional: Google Maps API Key (for better reverse geocoding)
# Get from: https://console.cloud.google.com
VITE_GOOGLE_MAPS_API_KEY=your_api_key_here

# Location settings
VITE_LOCATION_PROVIDER=google  # or "nominatim" (free)
VITE_LOCATION_ACCURACY_MOBILE=150    # meters
VITE_LOCATION_ACCURACY_DESKTOP=200   # meters
```

### 4. Wrap Your App with LocationProvider

**`src/main.jsx` or `src/App.jsx`:**

```jsx
import { LocationProvider } from "./contexts/LocationContext";

export function App() {
  return (
    <LocationProvider>
      {/* Rest of your app */}
      <YourComponent />
    </LocationProvider>
  );
}
```

### 5. Use Location Hook in Components

```jsx
import { useLocation } from "../contexts/LocationContext";

function MyComponent() {
  const {
    locationData,      // { lat, lng, city, pincode, label, fullLabel, accuracy, ... }
    loading,          // boolean
    error,            // string or null
    status,           // 'idle' | 'detecting' | 'success' | 'failed'
    deviceType,       // 'mobile' | 'desktop'
    modalOpen,        // boolean
    setModalOpen,     // function
    detectLocation,   // async function
    setPincode,       // async function
    setLocation,      // function
    clearLocation,    // function
  } = useLocation();

  return <div>{locationData?.label}</div>;
}
```

## Usage Patterns

### Pattern 1: Auto-detect on Component Mount

```jsx
import { useEffect } from "react";
import { useLocation } from "../contexts/LocationContext";

function CheckoutPage() {
  const { locationData, detectLocation } = useLocation();

  useEffect(() => {
    if (!locationData) {
      detectLocation(); // Try to detect automatically
    }
  }, []);

  return <div>{locationData?.label || "Loading..."}</div>;
}
```

### Pattern 2: Manual Location Request Button

```jsx
function HeaderComponent() {
  const { locationData, detectLocation } = useLocation();

  return (
    <div>
      <button onClick={detectLocation}>
        📍 Detect Location
      </button>
      <p>{locationData?.label}</p>
    </div>
  );
}
```

### Pattern 3: Show Location Modal

```jsx
import { LocationModal } from "../components/LocationDetector";

function App() {
  const { modalOpen, setModalOpen } = useLocation();

  return <LocationModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />;
}
```

### Pattern 4: Display Location on Map

```jsx
import { LocationMap } from "../components/LocationDetector";

function MapView() {
  return <LocationMap showMarker={true} className="h-96" />;
}
```

## Configuration

### Accuracy Thresholds

**Mobile (GPS-enabled devices):**
- Default: 150 meters
- Use GPS data directly from phone

**Desktop (no GPS):**
- Default: 200 meters
- Typically browser geolocation based on WiFi/IP
- Often less accurate

Change thresholds in `LocationContext.jsx`:

```javascript
const CONFIG = {
    ACCURACY_THRESHOLD: {
        mobile: 150,  // Change this
        desktop: 200, // Or this
    },
};
```

### Reverse Geocoding Provider

**Option 1: Google Maps (Recommended for Production)**

```env
VITE_GOOGLE_MAPS_API_KEY=AIza...
```

Pros:
- ✅ Highly accurate
- ✅ Supports multiple address formats
- ✅ Official support

Cons:
- ❌ Costs money at scale
- ❌ Requires API key

**Option 2: Nominatim (Free, OpenStreetMap)**

Leave `VITE_GOOGLE_MAPS_API_KEY` empty.

Pros:
- ✅ Completely free
- ✅ No API key needed

Cons:
- ❌ Less accurate than Google
- ⚠️ Rate limited (1 req/sec)
- ❌ Not recommended for production at scale

**Recommendation:** Use Google Maps for production, Nominatim for development.

## API Reference

### `useLocation()` Hook

Returns location context object:

```typescript
{
  // ──── State ────
  locationData: {
    lat: number;
    lng: number;
    accuracy: number | null;      // meters (null for pincode-only)
    city: string;
    state: string;
    locality: string;
    pincode: string;
    label: string;                // Formatted address (e.g., "Delhi, India")
    fullLabel: string;            // Full address with pincode
    timestamp: string;            // ISO string
    source: 'gps' | 'pincode' | 'manual';
  } | null;
  
  loading: boolean;
  error: string;
  status: 'idle' | 'detecting' | 'success' | 'failed';
  modalOpen: boolean;
  deviceType: 'mobile' | 'desktop';

  // ──── Actions ────
  detectLocation(): Promise<void>;
  setPincode(pincode: string): Promise<boolean>;
  setLocation(data: LocationData): void;
  clearLocation(): void;
  setModalOpen(open: boolean): void;

  // ──── Utilities ────
  isValidPincode(pincode: string): boolean;
  isMobileDevice(): boolean;
}
```

## Error Handling

### Graceful Degradation

```jsx
const { locationData, error, status } = useLocation();

if (status === 'detecting') return <LoadingSpinner />;
if (status === 'failed' && !locationData) return <PincodeForm />;
if (error) return <ErrorMessage msg={error} />;

return <LocationDisplay location={locationData} />;
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Location requires HTTPS" | HTTP not allowed | Use HTTPS |
| "Permission denied" | User blocked location | Show pincode input |
| "Timeout" | GPS slow | Retry or fallback |
| "Position unavailable" | No GPS signal | Use pincode |

## Performance Optimization

### 1. Prevent Multiple Detection Calls

✅ Already handled in `LocationContext.jsx` via `isDetectingRef`

```javascript
if (isDetectingRef.current) {
    console.warn("Detection already in progress");
    return;
}
```

### 2. Cache Location in localStorage

✅ Already implemented

```javascript
saveToStorage(locationData);   // Persists location
const saved = loadFromStorage(); // Loads on app start
```

### 3. Debounce Location Changes

Optional enhancement:

```jsx
const [locationChanges, setLocationChanges] = useState([]);

const debouncedLocationUpdate = useCallback(
    debounce((location) => {
        // Update delivery available products, etc.
    }, 1000),
    []
);
```

## Security & Privacy

✅ **HTTPS Required** - Browser enforces this automatically
✅ **User Consent** - Browser permission prompt required
✅ **No IP Tracking** - Uses GPS only (if available)
✅ **Local Storage Only** - No server tracking of location history

## Testing

### Test Cases

```javascript
// 1. Mobile: GPS detection successful
// 2. Desktop: GPS unavailable, pincode fallback
// 3. User denies permission
// 4. Location accuracy too low (retry)
// 5. Network timeout
// 6. Invalid pincode
// 7. Permission revoked mid-detection
```

### Manual Testing Checklist

- [ ] Test on mobile (Android/iOS)
- [ ] Test on desktop browser
- [ ] Test with location denied
- [ ] Test with low accuracy (indoor)
- [ ] Test with no network
- [ ] Test pincode lookup
- [ ] Test map display
- [ ] Test localStorage persistence
- [ ] Test HTTPS enforcement
- [ ] Test error messages

## Troubleshooting

### Issue: "Location Detection Not Working"

1. Check HTTPS is enabled
2. Verify browser supports geolocation (modern browsers)
3. Check browser location permission settings
4. Try on a different browser
5. Check browser console for errors

### Issue: "Wrong Location Detected"

1. Indoor location accuracy is poor (GPS needs clear sky)
2. Try outdoor with clear sky view
3. Increase accuracy threshold temporarily for testing
4. Use pincode fallback instead

### Issue: "Pincode Not Found"

1. Verify pincode is valid Indian format (6 digits)
2. Try another pincode
3. Switch reverse geocoding provider (Google vs Nominatim)

### Issue: "Map Not Displaying"

1. Ensure Leaflet CSS is imported:
   ```jsx
   import 'leaflet/dist/leaflet.css';
   ```
2. Ensure MapContainer has valid dimensions
3. Check browser console for errors

## Future Enhancements

### 1. Map Pin Picker

Allow users to drag marker on map to select custom location:

```jsx
const [editMode, setEditMode] = useState(false);

<MapContainer
    center={[lat, lng]}
    draggableMarker={editMode}
    onMarkerMove={(newLat, newLng) => {
        setLocation({ lat: newLat, lng: newLng });
    }}
/>
```

### 2. Delivery Availability Check

Check if location is serviceable:

```jsx
const checkServiceability = async (pincode) => {
    const response = await fetch(`/api/delivery/check/${pincode}`);
    return response.json();
};
```

### 3. Address Prediction (Google Places)

Auto-complete address input:

```jsx
import { Autocomplete } from "@react-google-maps/api";

<Autocomplete>
    <input type="text" />
</Autocomplete>
```

### 4. Location History

Remember recent locations:

```jsx
const [locationHistory, setLocationHistory] = useState([]);

const saveToHistory = (location) => {
    setLocationHistory([location, ...locationHistory.slice(0, 4)]);
};
```

## Support & Feedback

For issues or improvements:
- Check console logs for detailed error messages
- Review React DevTools (Profiler tab)
- Test in different browsers
- Report bugs with reproduction steps

---

**Last Updated:** May 2, 2026
**Status:** Production Ready ✅
