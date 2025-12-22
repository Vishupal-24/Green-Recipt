import React, { useEffect, useMemo, useState } from 'react';
import { TrendingUp, ShoppingBag, Coffee, Target, Wallet, Sparkles, Leaf, AlertTriangle } from 'lucide-react';
import { fetchCustomerAnalytics, fetchCustomerReceipts } from '../../services/api';

const CustomerInsights = () => {
   const [analytics, setAnalytics] = useState({ totalSpent: 0, categories: [] });
   const [receipts, setReceipts] = useState([]);
   const [error, setError] = useState(null);

   useEffect(() => {
      let mounted = true;

      const load = async () => {
         try {
            const [{ data: a }, { data: r }] = await Promise.all([
               fetchCustomerAnalytics(),
               fetchCustomerReceipts(),
            ]);
            if (!mounted) return;
            setAnalytics(a || { totalSpent: 0, categories: [] });
            setReceipts(r || []);
         } catch (e) {
            if (!mounted) return;
            setError('Unable to load live insights right now.');
            // graceful fallback
            setAnalytics({ totalSpent: 0, categories: [] });
            setReceipts([]);
         }
      };

      load();
      return () => {
         mounted = false;
      };
   }, []);

   const now = useMemo(() => new Date(), []);
   const yyyy = now.getFullYear();
   const mm = now.getMonth();
   const prevMonth = mm === 0 ? 11 : mm - 1;
   const prevYear = mm === 0 ? yyyy - 1 : yyyy;

   const monthReceipts = useMemo(() => {
      return receipts.filter((r) => {
         const d = r.date ? new Date(r.date) : r.transactionDate ? new Date(r.transactionDate) : null;
         return d && d.getFullYear() === yyyy && d.getMonth() === mm;
      });
   }, [receipts, yyyy, mm]);

   const prevMonthReceipts = useMemo(() => {
      return receipts.filter((r) => {
         const d = r.date ? new Date(r.date) : r.transactionDate ? new Date(r.transactionDate) : null;
         return d && d.getFullYear() === prevYear && d.getMonth() === prevMonth;
      });
   }, [receipts, prevYear, prevMonth]);

   const monthTotal = monthReceipts.reduce((sum, r) => sum + (r.total ?? r.amount ?? 0), 0);
   const prevMonthTotal = prevMonthReceipts.reduce((sum, r) => sum + (r.total ?? r.amount ?? 0), 0);
   const daysElapsed = Math.max(1, now.getDate());
   const avgPerDay = Math.round(monthTotal / daysElapsed);
   const monthChangePct = prevMonthTotal === 0 ? 0 : Math.round(((monthTotal - prevMonthTotal) / prevMonthTotal) * 100);

   const deriveCategory = (name = '') => {
      const n = name.toLowerCase();
      if (/[\b](chai|tea|coffee|latte|cappuccino|drink|juice|soda|water|shake|cold|hot chocolate|beverage)[\b]/.test(n)) return 'Drinks';
      if (/(snack|puff|sandwich|maggi|noodles|burger|pizza|roll|fries|wrap|bowl|meal|thali|rice|biryani|roti|paratha)/.test(n)) return 'Snacks';
      if (/(grocery|mart|daily|kirana|provision|vegetable|fruit)/.test(n)) return 'Groceries';
      if (/(cloth|apparel|fashion|shoe|bag|accessor)/.test(n)) return 'Shopping';
      return 'Other';
   };

   const categories = useMemo(() => {
      // Prefer backend categories only if they are not all "general"/"uncategorized"
      const base = (analytics.categories || []).filter((c) => {
         const lbl = (c.category || '').toLowerCase();
         return lbl && lbl !== 'general' && lbl !== 'uncategorized';
      });

      if (base.length) {
         const total = analytics.totalSpent || 1;
         return base.map((cat) => {
            const label = cat.category || 'Uncategorized';
            const value = cat.totalSpent || 0;
            const pct = Math.min(100, Math.max(0, Math.round((value / total) * 100)));
            const icon = label.toLowerCase().includes('food') || label.toLowerCase().includes('drink') ? Coffee : label.toLowerCase().includes('shop') ? ShoppingBag : Leaf;
            const color = label.toLowerCase().includes('food') || label.toLowerCase().includes('drink') ? 'text-orange-500' : label.toLowerCase().includes('shop') ? 'text-blue-500' : 'text-emerald-500';
            const bar = color.replace('text', 'bg');
            return { label, value, pct, icon, color, bar };
         });
      }

      // Derive from month receipts using item names
      const sums = {};
      monthReceipts.forEach((r) => {
         (r.items || []).forEach((item) => {
            const label = deriveCategory(item.name || '');
            const lineTotal = (item.price || item.unitPrice || 0) * (item.qty || item.quantity || 1);
            sums[label] = (sums[label] || 0) + lineTotal;
         });
      });
      const total = Object.values(sums).reduce((a, b) => a + b, 0) || 1;
      return Object.entries(sums).map(([label, value]) => {
         const pct = Math.min(100, Math.max(0, Math.round((value / total) * 100)));
         const icon = label === 'Drinks' ? Coffee : label === 'Snacks' ? Leaf : label === 'Shopping' ? ShoppingBag : Leaf;
         const color = label === 'Drinks' ? 'text-orange-500' : label === 'Snacks' ? 'text-emerald-500' : label === 'Shopping' ? 'text-blue-500' : 'text-slate-500';
         const bar = color.replace('text', 'bg');
         return { label, value, pct, icon, color, bar };
      });
   }, [analytics, monthReceipts]);

   const suggestions = useMemo(() => {
      const top = categories[0];
      const list = [
         { icon: Target, title: 'Set a budget cap', desc: 'Apply a monthly cap per category; roll over any underspend to savings.' },
         { icon: Wallet, title: 'Round-up saves', desc: 'Auto-park spare change from every QR payment into savings.' },
         { icon: Sparkles, title: 'Smart reminders', desc: 'Get nudges when your daily spend crosses your 7-day average +20%.' },
         { icon: Leaf, title: 'Sustainable picks', desc: 'Prefer reusable packaging merchants; earn a green badge in your stats.' },
      ];
      if (top) {
         list.unshift({
            icon: top.icon,
            title: `Trim ${top.label}`,
            desc: `Try cutting ${Math.min(10, top.pct)}% from ${top.label} next month for an extra buffer.`,
         });
      }
      return list;
   }, [categories]);

   return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
         <h2 className="text-2xl font-bold text-slate-800">Monthly Insights</h2>

         {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-sm">
               <AlertTriangle size={16} /> {error}
            </div>
         )}

         {/* Top Card */}
         <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-center gap-4">
             <div className="p-3 bg-white rounded-full text-emerald-600 shadow-sm">
                  <TrendingUp size={24} />
             </div>
             <div className="flex-1">
                  <p className="text-xs font-bold text-emerald-600 uppercase">Total Spent</p>
                  <h3 className="text-3xl font-bold text-emerald-900">₹{monthTotal.toLocaleString('en-IN')}</h3>
                  <p className="text-xs text-emerald-700 mt-1">You spent {Math.abs(monthChangePct)}% {monthChangePct < 0 ? 'less' : 'more'} than last month.</p>
             </div>
             <div className="text-right text-sm font-bold text-emerald-700">
                  <p className="text-slate-500 text-[11px] uppercase tracking-wide">Avg / day</p>
                  <p className="text-lg text-slate-800">₹{avgPerDay}</p>
                  <p className="text-[11px] text-slate-500">{monthReceipts.length} receipts</p>
             </div>
         </div>

         {/* Categories */}
         <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
             <h3 className="font-bold text-slate-700">Top Spending Categories</h3>
             <div className="space-y-3">
                  {categories.length === 0 && (
                     <p className="text-sm text-slate-500">No categorized spend yet.</p>
                  )}
                  {categories.map((cat, idx) => {
                     const Icon = cat.icon;
                     return (
                        <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                           <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                 <Icon className={cat.color} size={20} />
                                 <span className="font-bold text-slate-700">{cat.label}</span>
                              </div>
                              <span className="font-bold text-slate-800">₹{cat.value}</span>
                           </div>
                           <div className="mt-2 h-2 rounded-full bg-white border border-slate-200 overflow-hidden">
                              <div className={`h-full ${cat.bar}`} style={{ width: `${cat.pct}%` }}></div>
                           </div>
                           <p className="text-[11px] text-slate-500 mt-1">{cat.pct}% of this month</p>
                        </div>
                     );
                  })}
             </div>
         </div>

         {/* Suggestions */}
         <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-700">Smart Suggestions</h3>
            <div className="grid gap-3">
               {suggestions.map((tip, i) => {
                  const Icon = tip.icon;
                  return (
                     <div key={i} className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex gap-3 items-start">
                        <div className="p-2 rounded-lg bg-white text-emerald-600 shadow-sm">
                           <Icon size={16} />
                        </div>
                        <div>
                           <p className="font-bold text-slate-800 text-sm">{tip.title}</p>
                           <p className="text-xs text-slate-500 mt-0.5 leading-snug">{tip.desc}</p>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>
      </div>
   );
};

export default CustomerInsights;