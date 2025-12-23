import React, { useState } from 'react';
import { QrCode, Image, X, Calendar, Receipt, Trash2, CreditCard, Smartphone, EyeOff, CheckCircle, Check, Banknote, Loader2, ChevronRight, Clock, Store, ShoppingBag } from 'lucide-react';
import { updateReceipt, deleteReceipt as deleteReceiptApi } from '../../services/api';

const ReceiptCard = ({ data, onDelete, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(
    data.status === 'completed' ? (data.paymentMethod === 'cash' ? 'Cash' : data.paymentMethod === 'upi' ? 'UPI' : 'Paid') : null
  );

  const isQR = data.type === 'qr';
  const isPaid = data.status === 'completed';

  // Process payment - update backend and reflect locally
  const handlePayment = async (method) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      const paymentMethod = method === 'UPI' ? 'upi' : 'cash';
      const { data: updatedReceipt } = await updateReceipt(data.id, {
        paymentMethod,
        status: 'completed'
      });
      
      onUpdate(updatedReceipt);
      setPaymentStatus(method);
    } catch (error) {
      console.error('Payment update failed:', error);
      alert('Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete receipt from backend
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this receipt?")) return;
    
    setIsProcessing(true);
    try {
      await deleteReceiptApi(data.id);
      onDelete(data.id);
      setIsOpen(false);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete receipt. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Get payment method display info
  const getPaymentInfo = () => {
    const method = data.paymentMethod?.toLowerCase();
    if (method === 'upi') return { label: 'UPI', icon: Smartphone, color: 'text-emerald-600', bg: 'bg-emerald-50' };
    if (method === 'cash') return { label: 'Cash', icon: Banknote, color: 'text-amber-600', bg: 'bg-amber-50' };
    if (method === 'card') return { label: 'Card', icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' };
    return { label: 'Pending', icon: Clock, color: 'text-slate-500', bg: 'bg-slate-100' };
  };

  const paymentInfo = getPaymentInfo();

  return (
    <>
      {/* ========== CARD VIEW ========== */}
      <div 
        onClick={() => setIsOpen(true)}
        className={`bg-white p-3 md:p-4 rounded-xl md:rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]
          ${data.excludeFromStats ? 'border-slate-200 opacity-70' : 'border-slate-100'}
        `}
      >
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 ${
            isQR ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'
          }`}>
            {isQR ? <QrCode size={18} className="md:w-5 md:h-5" /> : <Image size={18} className="md:w-5 md:h-5" />}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-800 text-sm md:text-base truncate">{data.merchant}</h3>
              {data.excludeFromStats && <EyeOff size={12} className="text-slate-400 shrink-0" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] md:text-xs text-slate-400 flex items-center gap-1">
                <Calendar size={10} className="md:w-3 md:h-3" />
                {data.date} • {data.time}
              </p>
              {isPaid && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${paymentInfo.bg} ${paymentInfo.color}`}>
                  <paymentInfo.icon size={10} />
                  {paymentInfo.label}
                </span>
              )}
            </div>
          </div>
          
          {/* Amount & Type */}
          <div className="text-right shrink-0">
            <p className="font-bold text-slate-800 text-base md:text-lg">₹{data.amount}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
              isQR ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
            }`}>
              {isQR ? 'Digital' : 'Upload'}
            </span>
          </div>
          
          {/* Arrow */}
          <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors hidden md:block" />
        </div>
      </div>

      {/* ========== DETAIL MODAL ========== */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)}>
          <div 
            className="bg-white w-full md:w-[420px] md:max-w-[90vw] rounded-t-3xl md:rounded-3xl shadow-2xl animate-slide-up md:animate-pop-in flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className={`p-4 md:p-5 flex justify-between items-center shrink-0 rounded-t-3xl ${isQR ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'} text-white`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  {isQR ? <QrCode size={20} /> : <Image size={20} />}
                </div>
                <div>
                  <span className="text-xs font-medium opacity-80">{isQR ? 'Digital Receipt' : 'Uploaded Receipt'}</span>
                  <h3 className="font-bold text-lg">{data.merchant}</h3>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
              >
                <X size={18}/>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6 overflow-y-auto flex-1">
              
              {/* Date & Status */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-dashed border-slate-200">
                <div className="flex items-center gap-2 text-slate-500">
                  <Calendar size={16} />
                  <span className="text-sm font-medium">{data.date} at {data.time}</span>
                </div>
                {isQR && (
                  <span className="text-[10px] font-bold uppercase px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full flex items-center gap-1">
                    <CheckCircle size={10} /> Verified
                  </span>
                )}
              </div>

              {/* Items or Image */}
              {isQR && data.items?.length > 0 ? (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <ShoppingBag size={14} /> Items
                  </h4>
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2">
                    {data.items.map((item, i) => {
                      const qty = item.qty || item.quantity || 1;
                      const price = item.price || item.unitPrice || 0;
                      return (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-xs font-bold text-slate-500 shadow-sm">{qty}x</span>
                            <span className="text-slate-700">{item.name}</span>
                          </div>
                          <span className="font-bold text-slate-800">₹{price * qty}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : data.image && (
                <div className="mb-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Image size={14} /> Receipt Image
                  </h4>
                  <div className="aspect-[4/3] bg-slate-100 rounded-xl overflow-hidden border border-slate-200">
                    <img src={data.image} alt="Receipt" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}

              {/* Excluded Notice */}
              {data.excludeFromStats && (
                <div className="mb-4 p-3 bg-slate-50 rounded-xl flex items-center gap-3 text-slate-500">
                  <EyeOff size={16} />
                  <span className="text-xs font-medium">Excluded from analytics</span>
                </div>
              )}

              {/* Amount */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-500 uppercase">Total Amount</span>
                  <span className="text-3xl font-bold text-slate-800">₹{data.amount}</span>
                </div>
                {isPaid && (
                  <div className={`mt-3 pt-3 border-t border-slate-200 flex items-center gap-2 ${paymentInfo.color}`}>
                    <paymentInfo.icon size={16} />
                    <span className="text-sm font-bold">Paid via {paymentInfo.label}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3 rounded-b-3xl md:rounded-b-3xl">
              <button 
                onClick={handleDelete} 
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-all disabled:opacity-50 shadow-sm"
              >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} 
                <span className="hidden sm:inline">Delete</span>
              </button>
              
              {isPaid ? (
                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold ${paymentInfo.bg} ${paymentInfo.color}`}>
                  <Check size={16} /> Paid via {paymentInfo.label}
                </div>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handlePayment('UPI')} 
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/25"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />} 
                    <span>UPI</span>
                  </button>
                  <button 
                    onClick={() => handlePayment('Cash')} 
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-all disabled:opacity-50 shadow-lg shadow-amber-500/25"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Banknote size={16} />} 
                    <span>Cash</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Animations */}
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pop-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .animate-pop-in { animation: pop-in 0.2s ease-out; }
      `}</style>
    </>
  );
};

export default ReceiptCard;