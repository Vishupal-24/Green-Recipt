// import React, { useState, useEffect } from 'react';
// import { Menu } from 'lucide-react';
// import api from '../services/api';

// // Import Components
// import MerchantSidebar from '../components/merchant/MerchantSidebar'; 
// import MerchantOverview from '../components/merchant/MerchantOverview';
// import MerchantCalendar from '../components/merchant/MerchantCalendar';
// import MerchantBilling from '../components/merchant/MerchantBilling';
// import MerchantItems from '../components/merchant/MerchantItems';
// import MerchantInsights from '../components/merchant/MerchantInsights';
// import MerchantProfile from '../components/merchant/MerchantProfile';
// import BottomNav from '../merchant/BottomNav';

// const MerchantDashboard = () => {
//   // 🧭 State
//   const [activeTab, setActiveTab] = useState('overview');
//   const [isSidebarOpen, setSidebarOpen] = useState(false);
  
//   // 🏷️ Categories from merchant profile
//   const [categories, setCategories] = useState(["Drinks", "Snacks", "Food", "Other"]);

//   // 📦 Shared Inventory State
//   const [inventory, setInventory] = useState(() => {
//     const saved = localStorage.getItem('merchantInventory');
//     return saved ? JSON.parse(saved) : [
//        { id: 1, name: "Masala Chai", price: 15, category: "Drinks" },
//         { id: 2, name: "Veg Sandwich", price: 45, category: "Snacks" },
//         { id: 3, name: "Cold Coffee", price: 60, category: "Drinks" },
//         { id: 4, name: "Maggi", price: 30, category: "Snacks" },
//         { id: 5, name: "Water Bottle", price: 20, category: "Drinks" },
//     ];
//   });

//   // Load categories from merchant profile
//   useEffect(() => {
//     const loadCategories = async () => {
//       try {
//         const { data } = await api.get('/auth/me');
//         if (data.categories && data.categories.length > 0) {
//           setCategories(data.categories);
//         }
//       } catch (err) {
//         console.error('Failed to load categories:', err);
//       }
//     };
//     loadCategories();
//   }, []);

//   useEffect(() => {
//     localStorage.setItem('merchantInventory', JSON.stringify(inventory));
//   }, [inventory]);

//   return (
//     <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
//       {/* 🔹 NEW SIDEBAR COMPONENT */}
//       <MerchantSidebar 
//         activeTab={activeTab} 
//         onNavigate={setActiveTab} 
//         isOpen={isSidebarOpen} 
//         onClose={() => setSidebarOpen(false)} 
//       />

//       {/* ⚪ MAIN CONTENT AREA */}
//       <div className="flex-1 flex flex-col min-w-0 h-full">
        
//         {/* Mobile Top Header (Hamburger) */}
//         <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 md:hidden shrink-0">
//             <button 
//               onClick={() => setSidebarOpen(true)} 
//               className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg active:scale-95 transition-transform"
//             >
//                 <Menu size={24} />
//             </button>
//             <span className="font-bold text-slate-700 capitalize">{activeTab}</span>
//             <div className="w-8" /> {/* Spacer to center the title */}
//         </header>
        
//         {/* Scrollable Content */}
//         <main className="flex-1 overflow-y-auto p-4 md:p-8">
//             <div className="max-w-6xl mx-auto">
//                 {activeTab === 'overview' && <MerchantOverview onNavigate={setActiveTab} />}
//                 {activeTab === 'calendar' && <MerchantCalendar />}
//                 {activeTab === 'billing' && <MerchantBilling inventory={inventory} />}
//                 {activeTab === 'items' && <MerchantItems inventory={inventory} setInventory={setInventory} categories={categories} setCategories={setCategories} />}
//                 {activeTab === 'insights' && <MerchantInsights />}
//                 {activeTab === 'profile' && <MerchantProfile />}
//             </div>
//         </main>
//       </div>

//     </div>
//   );
// };

// export default MerchantDashboard;
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import api from '../services/api';

// Import Components
import MerchantSidebar from '../components/merchant/MerchantSidebar'; 
import BottomNav from '../components/merchant/BottomNav'; // 👈 Import the new BottomNav

// Import Pages
import MerchantOverview from '../components/merchant/MerchantOverview';
import MerchantCalendar from '../components/merchant/MerchantCalendar';
import MerchantBilling from '../components/merchant/MerchantBilling';
import MerchantItems from '../components/merchant/MerchantItems';
import MerchantInsights from '../components/merchant/MerchantInsights';
import MerchantProfile from '../components/merchant/MerchantProfile';

const MerchantDashboard = () => {
  const location = useLocation();

  // 🏷️ Categories State
  const [categories, setCategories] = useState(["Drinks", "Snacks", "Food", "Other"]);

  // 📦 Inventory State
  const [inventory, setInventory] = useState(() => {
    const saved = localStorage.getItem('merchantInventory');
    return saved ? JSON.parse(saved) : [
       { id: 1, name: "Masala Chai", price: 15, category: "Drinks" },
       { id: 2, name: "Veg Sandwich", price: 45, category: "Snacks" },
       { id: 3, name: "Cold Coffee", price: 60, category: "Drinks" },
    ];
  });

  // Load Data
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const { data } = await api.get('/auth/me');
        if (data.categories?.length > 0) setCategories(data.categories);
      } catch (err) { console.error('Failed to load categories:', err); }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    localStorage.setItem('merchantInventory', JSON.stringify(inventory));
  }, [inventory]);

  // 🛑 LOGIC: Hide Bottom Bar when on the Billing Page
  const isBillingPage = location.pathname.includes('billing');

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* 🖥️ DESKTOP: Sidebar (Hidden on Mobile) */}
      <div className="hidden md:flex h-full">
         <MerchantSidebar />
      </div>

      {/* ⚪ MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        
        {/* Scrollable Content */}
        {/* We add 'pb-24' only if the bottom bar is visible, so content isn't hidden behind it */}
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 ${!isBillingPage ? 'pb-24 md:pb-8' : ''}`}>
            <div className="max-w-6xl mx-auto">
                
                {/* 👇 THIS IS THE ROUTER SWITCHER */}
                <Routes>
                  {/* Redirect root to overview */}
                  <Route path="/" element={<Navigate to="overview" replace />} />
                  
                  <Route path="overview" element={<MerchantOverview />} />
                  <Route path="calendar" element={<MerchantCalendar />} />
                  <Route path="billing" element={<MerchantBilling inventory={inventory} />} />
                  
                  <Route path="items" element={
                    <MerchantItems 
                      inventory={inventory} 
                      setInventory={setInventory} 
                      categories={categories} 
                      setCategories={setCategories} 
                    />
                  } />
                  
                  <Route path="insights" element={<MerchantInsights />} />
                  <Route path="profile" element={<MerchantProfile />} />
                </Routes>

            </div>
        </main>

        {/* 📱 MOBILE: Bottom Nav */}
        {/* Only show if NOT on desktop (md:hidden) AND NOT on billing page */}
        {!isBillingPage && (
           <div className="md:hidden">
              <BottomNav />
           </div>
        )}

      </div>

    </div>
  );
};

export default MerchantDashboard;