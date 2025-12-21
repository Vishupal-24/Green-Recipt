import React from 'react';
import { User, Mail, Phone, MapPin, Shield, LogOut, ChevronRight } from 'lucide-react';

const CustomerProfile = () => {
  
  // 🚪 LOGOUT FUNCTION
  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      // Clear any session data if needed
      // localStorage.removeItem('userToken'); 
      window.location.href = '/customer-login'; // 👈 Redirect to Home/Login
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
        <div>
            <h3 className="text-lg font-bold text-slate-800">John Doe</h3>
            <p className="text-sm text-slate-500">Consumer Account</p>
        </div>
      </div>

      {/* Settings List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {[
            { icon: Mail, label: "Email Address", val: "john@example.com" },
            { icon: Phone, label: "Phone Number", val: "+91 98765 43210" },
            { icon: MapPin, label: "Saved Addresses", val: "2 saved" },
            { icon: Shield, label: "Privacy & Security", val: "" },
        ].map((item, i) => (
            <div key={i} className="p-4 border-b border-slate-50 last:border-0 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-50 text-slate-600 rounded-lg"><item.icon size={18}/></div>
                    <span className="font-medium text-slate-700">{item.label}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-sm">{item.val}</span>
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