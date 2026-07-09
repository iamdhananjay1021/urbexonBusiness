/**
 * useWishlist.js — Wishlist hook for components
 */
import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import { useAuth } from "../contexts/AuthContext";

const wishlistCache = new Map();
const wishlistFetchPromises = new Map();

const getCacheKey = (userId, productId) => `${userId || "guest"}:${productId}`;

export const useWishlist = (productId) => {
  const { user } = useAuth();
  const [inWishlist, setInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !productId) return;
    const cacheKey = getCacheKey(user._id, productId);
    let cancelled = false;

    const cachedValue = wishlistCache.get(cacheKey);
    if (typeof cachedValue === "boolean") {
      setInWishlist(cachedValue);
    }

    const fetchWishlistStatus = async () => {
      if (wishlistFetchPromises.has(cacheKey)) {
        try {
          const value = await wishlistFetchPromises.get(cacheKey);
          if (!cancelled) setInWishlist(value);
        } catch { /* ignore */ }
        return;
      }

      const promise = api.get(`/wishlist/check/${productId}`)
        .then(({ data }) => {
          const value = Boolean(data?.inWishlist);
          wishlistCache.set(cacheKey, value);
          return value;
        })
        .finally(() => wishlistFetchPromises.delete(cacheKey));

      wishlistFetchPromises.set(cacheKey, promise);

      try {
        const value = await promise;
        if (!cancelled) setInWishlist(value);
      } catch { /* ignore */ }
    };

    fetchWishlistStatus();
    return () => { cancelled = true; };
  }, [user, productId]);

  const toggle = useCallback(async () => {
    if (!user || !productId) return false;
    setLoading(true);
    const cacheKey = getCacheKey(user._id, productId);

    try {
      if (inWishlist) {
        await api.delete(`/wishlist/${productId}`);
        wishlistCache.set(cacheKey, false);
        setInWishlist(false);
      } else {
        await api.post(`/wishlist/${productId}`);
        wishlistCache.set(cacheKey, true);
        setInWishlist(true);
      }
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [user, productId, inWishlist]);

  return { inWishlist, toggle, loading };
};
