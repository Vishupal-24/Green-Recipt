import React, { useEffect, useState } from "react";
import { fetchCustomerReceipts, fetchCustomerAnalytics, clearSession } from "../services/api.js";
import { useNavigate } from "react-router-dom";

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [receipts, setReceipts] = useState([]);
  const [analytics, setAnalytics] = useState({ totalSpent: 0, categories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const [rRes, aRes] = await Promise.all([
          fetchCustomerReceipts(),
          fetchCustomerAnalytics(),
        ]);
        setReceipts(rRes.data || []);
        setAnalytics(aRes.data || { totalSpent: 0, categories: [] });
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleLogout = () => {
    clearSession();
    navigate("/customer-login");
  };

  if (loading) return <div className="p-6">Loading dashboard...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Customer Dashboard</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold"
        >
          Logout
        </button>
      </div>

      <section className="p-4 border rounded-lg bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Spending Summary</h2>
        <p className="text-sm text-slate-600">Total Spent: ₹{analytics.totalSpent.toFixed(2)}</p>
        <div className="mt-3 space-y-1">
          {analytics.categories.map((c) => (
            <div key={c.category} className="flex justify-between text-sm">
              <span>{c.category}</span>
              <span>
                ₹{c.totalSpent.toFixed(2)} ({c.count} receipts)
              </span>
            </div>
          ))}
          {!analytics.categories.length && <p className="text-sm text-slate-500">No receipts yet.</p>}
        </div>
      </section>

      <section className="p-4 border rounded-lg bg-white shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Recent Receipts</h2>
        <div className="space-y-2">
          {receipts.map((r) => (
            <div key={r._id} className="flex justify-between text-sm border-b pb-2">
              <div>
                <div className="font-semibold">{r.category}</div>
                <div className="text-slate-500 text-xs">{new Date(r.createdAt).toLocaleString()}</div>
              </div>
              <div className="font-bold">₹{r.total.toFixed(2)}</div>
            </div>
          ))}
          {!receipts.length && <p className="text-sm text-slate-500">No receipts found.</p>}
        </div>
      </section>
    </div>
  );
};

export default CustomerDashboard;
