import React, { useEffect, useState } from 'react';
import { User, Mail, Phone, MapPin, Shield, LogOut, ChevronRight, AlertTriangle } from 'lucide-react';
import { fetchProfile, clearSession } from '../../services/api';

const CustomerProfile = () => {
  
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await fetchProfile();
        if (!mounted) return;
        setProfile(data);
      } catch (e) {
        if (!mounted) return;
        setError('Unable to load profile');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      clearSession();
      window.location.href = '/customer-login';
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-20">
      <h2 className="text-2xl font-bold text-slate-800">My Profile</h2>

      {/* Profile Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
            <User size={32} />
        </div>
        <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-800 truncate">{profile?.name || 'Customer'}</h3>
            <p className="text-sm text-slate-500">{profile?.email || 'Loading...'}</p>
        </div>
        {profile?.isVerified && (
          <span className="ml-auto text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">Verified</span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {loading && (
        <p className="text-sm text-slate-500">Loading profile...</p>
      )}

      {/* Settings List */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {[
          { icon: Mail, label: "Email Address", val: profile?.email || '—' },
          { icon: Phone, label: "Phone Number", val: profile?.phone || 'Add a phone' },
          { icon: MapPin, label: "Saved Addresses", val: 'Add address' },
          { icon: Shield, label: "Privacy & Security", val: 'Manage' },
        ].map((item, i) => (
          <div key={i} className="p-4 border-b border-slate-50 last:border-0 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><item.icon size={18}/></div>
              <span className="font-medium text-slate-700">{item.label}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="text-sm truncate max-w-[160px] text-right">{item.val}</span>
              <ChevronRight size={16} />
            </div>
          </div>
        ))}
        </div>

      {/* 🔴 LOGOUT BUTTON */}
      <button 
        onClick={handleLogout}
        className="w-full bg-white border border-red-100 text-red-600 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
      >
        <LogOut size={20} /> Log Out
      </button>
      
      <p className="text-center text-xs text-slate-400">Version 1.0.0 • GreenReceipt</p>
    </div>
  );
};

export default CustomerProfile;