/**
 * Delivery Panel AuthContext — Production v2.0
 */
import { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);
const STORAGE_KEY = "deliveryAuth";

export const AuthProvider = ({ children }) => {
  const [rider, setRider] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token) {
          setRider(parsed.rider || parsed.user || null);
          api.defaults.headers.common["Authorization"] = `Bearer ${parsed.token}`;
        }
      }
    } catch { localStorage.removeItem(STORAGE_KEY); }
    finally { setLoading(false); }
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (!["delivery_boy"].includes(data.role)) throw new Error("Not a delivery partner account");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: data.token, rider: { _id: data._id, name: data.name, email: data.email, phone: data.phone, role: data.role } }));
    api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
    // Fetch delivery profile
    try {
      const { data: status } = await api.get("/delivery/status");
      setRider(status.rider || { _id: data._id, name: data.name, email: data.email, phone: data.phone, role: data.role });
    } catch { setRider({ _id: data._id, name: data.name, email: data.email, phone: data.phone, role: data.role }); }
    return data;
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    delete api.defaults.headers.common["Authorization"];
    setRider(null);
  };

  return (
    <AuthContext.Provider value={{ rider, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
