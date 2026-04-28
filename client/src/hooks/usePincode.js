/**
 * usePincode.js — Urbexon Hour Pincode Management Hook
 * 
 * - Manages the currently selected UH pincode in localStorage.
 * - Provides `checkAndSetPincode` to validate against the backend.
 * - Exposes a simple `isServiceable` boolean for UI to react to.
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const STORAGE_KEY = 'uh_pincode_v2';

const getStoredPincode = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
};

export const usePincode = () => {
    const [pincodeData, setPincodeData] = useState(getStoredPincode);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Sync across tabs
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === STORAGE_KEY) {
                setPincodeData(getStoredPincode());
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    const checkAndSetPincode = useCallback(async (code) => {
        if (!code || !/^\d{6}$/.test(code)) {
            setError('Please enter a valid 6-digit pincode.');
            return false;
        }
        setLoading(true);
        setError('');
        try {
            const { data } = await api.get(`/pincode/check/${code}`);
            if (data.available) {
                const newData = { code, area: data.area, city: data.city, vendorCount: data.vendorCount };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
                setPincodeData(newData);
                return true;
            } else {
                setError(data.message || "Sorry, Urbexon Hour is not yet available in your area.");
                return false;
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to check pincode. Please try again.');
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const clearPincode = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setPincodeData(null);
    }, []);

    return { pincode: pincodeData?.code, pincodeData, isServiceable: !!pincodeData, loading, error, checkAndSetPincode, clearPincode };
};