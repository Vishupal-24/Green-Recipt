import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Store,
  MapPin,
  Phone,
  Mail,
  LogOut,
  Edit2,
  Save,
  X,
//                         <div className="relative">
//                             <User className="absolute left-3 top-3 text-slate-400" size={18} />
//                             <input 
//                                 disabled={!isEditing}
//                                 type="text" 
//                                 value={isEditing ? tempProfile.ownerName : (profile?.ownerName || '')}
//                                 onChange={(e) => setTempProfile({...tempProfile, ownerName: e.target.value})}
//                                 className={`w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none font-medium transition-all ${isEditing ? 'bg-white border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-600'}`}
//                             />
//                         </div>
//                     </div>

//                     {/* Phone */}
//                     <div>
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Store,
  MapPin,
  Phone,
  Mail,
  LogOut,
  Edit2,
  Save,
  X,
  Receipt,
  ShieldCheck,
  Leaf,
  Trophy,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ImageIcon,
  Upload,
  Camera,
  Palette,
  Globe,
} from 'lucide-react';
import { fetchProfile, updateProfile, fetchMerchantAnalytics, clearSession } from '../../services/api';
import { formatISTDisplay } from '../../utils/timezone';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeToggle from '../common/ThemeToggle';

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-500' : 'bg-amber-500';
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? X : AlertTriangle;

  return (
    <div className={`fixed top-4 right-4 z-50 ${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-slide-in-right max-w-sm`}>
      <Icon size={18} />
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-auto p-1 hover:bg-white/20 rounded-full">
        <X size={14} />
      </button>
    </div>
  );
};

const ProfileSkeleton = () => {
  const { isDark } = useTheme();
  return (
    <div className="space-y-6 animate-pulse max-w-4xl mx-auto pb-10">
      <div className={`${isDark ? 'bg-slate-800' : 'bg-slate-200'} rounded-2xl h-48`} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 ${isDark ? 'bg-slate-800' : 'bg-slate-200'} rounded-2xl h-80`} />
        <div className="space-y-6">
          <div className={`${isDark ? 'bg-slate-800' : 'bg-slate-200'} rounded-2xl h-64`} />
          <div className={`${isDark ? 'bg-slate-800' : 'bg-slate-200'} rounded-2xl h-48`} />
        </div>
      </div>
    </div>
  );
};

const MerchantProfile = () => {
  const { isDark } = useTheme();
  const { t, i18n } = useTranslation();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [tempProfile, setTempProfile] = useState({});
  const [stats, setStats] = useState({ totalReceipts: 0, paperSaved: 0 });

  const logoInputRef = useRef(null);

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('greenreceipt-lang', lang);
  };

  const loadProfile = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const [profileRes, analyticsRes] = await Promise.allSettled([
        fetchProfile(),
        fetchMerchantAnalytics(),
      ]);

      if (profileRes.status === 'fulfilled') {
        const data = profileRes.value.data;
        setProfile(data);
        setTempProfile({
          shopName: data.shopName || '',
          ownerName: data.ownerName || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          receiptFooter: data.receiptFooter || '',
          receiptHeader: data.receiptHeader || '',
          brandColor: data.brandColor || '#10b981',
          logoUrl: data.logoUrl || '',
        });
      }

      if (analyticsRes.status === 'fulfilled') {
        const analytics = analyticsRes.value.data;
        const totalReceipts = analytics.summary?.thisYear?.count || analytics.summary?.thisMonth?.count || 0;
        const paperSaved = ((totalReceipts * 2.5) / 1000).toFixed(1);
        setStats({ totalReceipts, paperSaved });
      }
    } catch (e) {
      setToast({ message: t('profile.messages.loadFailed'), type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const memberSince = useMemo(() => {
    if (!profile?.createdAt) return null;
    return formatISTDisplay(profile.createdAt, { month: 'short', day: 'numeric', year: 'numeric' });
  }, [profile?.createdAt]);

  const handleEdit = () => {
    if (!profile) return;
    setTempProfile({
      shopName: profile.shopName || '',
      ownerName: profile.ownerName || '',
      phone: profile.phone || '',
      email: profile.email || '',
      address: profile.address || '',
      receiptFooter: profile.receiptFooter || '',
      receiptHeader: profile.receiptHeader || '',
      brandColor: profile.brandColor || '#10b981',
      logoUrl: profile.logoUrl || '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (profile) {
      setTempProfile({
        shopName: profile.shopName || '',
        ownerName: profile.ownerName || '',
        phone: profile.phone || '',
        email: profile.email || '',
        address: profile.address || '',
        receiptFooter: profile.receiptFooter || '',
        receiptHeader: profile.receiptHeader || '',
        brandColor: profile.brandColor || '#10b981',
        logoUrl: profile.logoUrl || '',
      });
    } else {
      setTempProfile({});
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setToast({ message: t('merchant.profile.imageTooLarge'), type: 'error' });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setTempProfile((prev) => ({ ...prev, logoUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!tempProfile.shopName?.trim()) {
      setToast({ message: t('merchant.profile.shopNameRequired'), type: 'error' });
      return;
    }

    setSaving(true);
    try {
      const { data } = await updateProfile(tempProfile);
      const updatedProfile = { ...profile, ...tempProfile, ...data };
      setProfile(updatedProfile);
      setIsEditing(false);
      setToast({ message: t('profile.messages.profileUpdated'), type: 'success' });
    } catch (e) {
      setToast({ message: e.response?.data?.message || t('merchant.profile.failedToSave'), type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm(t('merchant.profile.logoutConfirm'))) {
      clearSession();
      window.location.href = '/merchant-login';
    }
  };

  const handleRefresh = () => loadProfile(true);

  if (loading) return <ProfileSkeleton />;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto pb-10">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-2xl p-6 md:p-8 text-white shadow-lg relative overflow-hidden group/header">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative z-10">
          <div className="relative group">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-md border-4 border-white/20 overflow-hidden relative">
              {(isEditing ? tempProfile.logoUrl : profile?.logoUrl) ? (
                <img src={isEditing ? tempProfile.logoUrl : profile.logoUrl} alt="Shop Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-emerald-600 font-bold text-3xl uppercase">
                  {(profile?.shopName || 'S').charAt(0)}
                </span>
              )}
              {isEditing && (
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera size={24} className="text-white" />
                </div>
              )}
            </div>
          </div>

          <div className="text-center md:text-left flex-1">
            <div className="flex items-center gap-2 justify-center md:justify-start">
              <h1 className="text-2xl md:text-3xl font-bold">{profile?.shopName || t('merchant.profile.yourShop')}</h1>
              <button onClick={handleRefresh} disabled={refreshing} className="p-1.5 hover:bg-white/20 rounded-full transition-colors">
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
            <p className="text-emerald-100 font-medium mt-1 flex items-center justify-center md:justify-start gap-2">
              <Store size={16} /> {profile?.businessCategory || 'General Store'} • {t('merchant.profile.merchant')}
            </p>
            <div className="mt-4 flex flex-wrap justify-center md:justify-start gap-3">
              {profile?.isVerified && (
                <span className="px-3 py-1 bg-emerald-800/30 rounded-full text-xs font-bold backdrop-blur-sm border border-white/10 flex items-center gap-1">
                  <ShieldCheck size={12} /> {t('profile.verified')}
                </span>
              )}
              {memberSince && (
                <span className="px-3 py-1 bg-white/10 rounded-full text-xs backdrop-blur-sm border border-white/10">
                  {t('profile.since', { date: memberSince })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`lg:col-span-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-2xl border shadow-sm overflow-hidden`}>
          <div className={`p-6 border-b ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-slate-50/50'} flex justify-between items-center`}>
            <div>
              <h2 className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'} text-lg`}>{t('merchant.profile.businessDetails')}</h2>
              <p className="text-slate-400 text-xs mt-0.5">{t('merchant.profile.contactLocation')}</p>
            </div>
            {!isEditing ? (
              <button onClick={handleEdit} className={`flex items-center gap-2 px-4 py-2 ${isDark ? 'bg-slate-700 border-slate-600 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50' : 'bg-white border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-200'} border rounded-xl text-sm font-bold transition-all shadow-sm`}>
                <Edit2 size={14} /> {t('common.edit')}
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={handleCancel} disabled={saving} className={`p-2 ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-slate-400 hover:bg-slate-100'} rounded-lg transition-colors disabled:opacity-50`}>
                  <X size={20} />
                </button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            )}
          </div>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">{t('merchant.profile.shopName')}</label>
                <div className="relative">
                  <Store className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input disabled={!isEditing} type="text" value={isEditing ? tempProfile.shopName : profile?.shopName || ''} onChange={(e) => setTempProfile({ ...tempProfile, shopName: e.target.value })} className={`w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none font-medium transition-all ${isEditing ? (isDark ? 'bg-slate-700 border-emerald-500 ring-1 ring-emerald-500 text-white' : 'bg-white border-emerald-500 ring-1 ring-emerald-500') : isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">{t('merchant.profile.ownerName')}</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input disabled={!isEditing} type="text" value={isEditing ? tempProfile.ownerName : profile?.ownerName || ''} onChange={(e) => setTempProfile({ ...tempProfile, ownerName: e.target.value })} className={`w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none font-medium transition-all ${isEditing ? (isDark ? 'bg-slate-700 border-emerald-500 ring-1 ring-emerald-500 text-white' : 'bg-white border-emerald-500 ring-1 ring-emerald-500') : isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}/>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">{t('merchant.profile.phoneNumber')}</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input disabled={!isEditing} type="text" value={isEditing ? tempProfile.phone : profile?.phone || ''} onChange={(e) => setTempProfile({ ...tempProfile, phone: e.target.value })} className={`w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none font-medium transition-all ${isEditing ? (isDark ? 'bg-slate-700 border-emerald-500 ring-1 ring-emerald-500 text-white' : 'bg-white border-emerald-500 ring-1 ring-emerald-500') : isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}/>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">{t('merchant.profile.emailAddress')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input disabled={!isEditing} type="email" value={isEditing ? tempProfile.email : profile?.email || ''} onChange={(e) => setTempProfile({ ...tempProfile, email: e.target.value })} className={`w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none font-medium transition-all ${isEditing ? (isDark ? 'bg-slate-700 border-emerald-500 ring-1 ring-emerald-500 text-white' : 'bg-white border-emerald-500 ring-1 ring-emerald-500') : isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}/>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">{t('merchant.profile.shopAddress')}</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                  <textarea disabled={!isEditing} rows="2" value={isEditing ? tempProfile.address : profile?.address || ''} onChange={(e) => setTempProfile({ ...tempProfile, address: e.target.value })} className={`w-full pl-10 pr-4 py-2.5 rounded-xl border outline-none font-medium transition-all resize-none ${isEditing ? (isDark ? 'bg-slate-700 border-emerald-500 ring-1 ring-emerald-500 text-white' : 'bg-white border-emerald-500 ring-1 ring-emerald-500') : isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}/>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-2xl border shadow-sm p-6`}>
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'} mb-4 flex items-center gap-2`}>
              <Receipt size={18} className="text-emerald-600" /> {t('merchant.profile.receiptBranding')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                  <ImageIcon size={12} /> {t('merchant.profile.storeLogo')}
                </label>
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-lg border ${isDark ? 'border-slate-600 bg-slate-700' : 'border-slate-200 bg-slate-50'} flex items-center justify-center overflow-hidden relative`}>
                    {(isEditing ? tempProfile.logoUrl : profile?.logoUrl) ? (
                      <img src={isEditing ? tempProfile.logoUrl : profile?.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="text-slate-300" size={24} />
                    )}
                  </div>
                  {isEditing && (
                    <div className="flex-1">
                      <label className="cursor-pointer bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition-all inline-flex items-center gap-2">
                        <Upload size={14} /> <span>{t('merchant.profile.uploadLogo')}</span>
                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                      </label>
                      <p className="text-[10px] text-slate-400 mt-1">{t('merchant.profile.logoSizeHint')}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">{t('merchant.profile.footerMessage')}</label>
                <input disabled={!isEditing} type="text" value={isEditing ? tempProfile.receiptFooter : profile?.receiptFooter || ''} onChange={(e) => setTempProfile({ ...tempProfile, receiptFooter: e.target.value })} placeholder={t('merchant.profile.footerPlaceholder')} className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${isEditing ? (isDark ? 'bg-slate-700 border-emerald-500 text-white' : 'border-emerald-500') : isDark ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-slate-50 border-slate-200'}`}/>
              </div>

              <div className={`${isDark ? 'bg-slate-900' : 'bg-slate-100'} p-4 rounded-xl`}>
                <p className="text-[10px] text-slate-400 font-bold uppercase text-center mb-2">{t('merchant.profile.livePreview')}</p>
                <div className="bg-white p-4 shadow-sm border border-slate-200 mx-auto max-w-[220px] text-center font-mono text-[10px] leading-tight relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: isEditing ? tempProfile.brandColor : profile?.brandColor || '#10b981' }} />
                  <div className="pt-2">
                    {(isEditing ? tempProfile.logoUrl : profile?.logoUrl) && (
                      <img src={isEditing ? tempProfile.logoUrl : profile?.logoUrl} alt="Logo" className="w-10 h-10 object-contain mx-auto mb-1 rounded" onError={(e) => (e.target.style.display = 'none')} />
                    )}
                    <div className="font-bold text-xs mb-0.5" style={{ color: isEditing ? tempProfile.brandColor : profile?.brandColor || '#10b981' }}>
                      {isEditing ? tempProfile.shopName : profile?.shopName || t('merchant.profile.yourShop')}
                    </div>
                    <div className="text-slate-400 text-[8px] mb-2">{isEditing ? tempProfile.address : profile?.address || t('merchant.profile.yourAddress')}</div>
                    <div className="border-b border-dashed border-slate-300 my-2" />
                    <div className="flex justify-between my-1"><span>Masala Chai</span><span>15.00</span></div>
                    <div className="flex justify-between font-bold" style={{ color: isEditing ? tempProfile.brandColor : profile?.brandColor || '#10b981' }}><span>TOTAL</span><span>₹15.00</span></div>
                    <div className="mt-3 text-slate-500 italic text-[9px]">"{isEditing ? tempProfile.receiptFooter : profile?.receiptFooter || t('merchant.profile.thankYou')}"</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'} rounded-2xl border p-6 shadow-sm`}>
            <h3 className="font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Palette size={18} className="text-purple-500" /> {t('profile.appearance.title') || 'Appearance'}
            </h3>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-200">{t('profile.appearance.darkMode')}</p>
                <p className="text-xs text-slate-400">{t('profile.appearance.switchTheme')}</p>
              </div>
              <ThemeToggle />
            </div>
            <div className={`pt-4 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
              <div className="flex items-center gap-2 mb-3">
                <Globe size={18} className="text-blue-500" />
                <span className={`font-medium ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('profile.language.title')}</span>
              </div>
              <p className={`text-xs mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('profile.language.selectLanguage')}</p>
              <div className="flex gap-2">
                <button onClick={() => handleLanguageChange('en')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${i18n.language === 'en' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {t('profile.language.english')}
                </button>
                <button onClick={() => handleLanguageChange('hi')} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${i18n.language === 'hi' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {t('profile.language.hindi')}
                </button>
              </div>
            </div>
          </div>

          <div className={`${isDark ? 'bg-emerald-900/10 border-emerald-900/30' : 'bg-emerald-50 border-emerald-100'} rounded-2xl border p-6 relative overflow-hidden`}>
            <div className="relative z-10">
              <h3 className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-900'} mb-1 flex items-center gap-2`}>
                <Leaf size={18} className="text-emerald-600" /> {t('merchant.profile.greenImpact')}
              </h3>
              <p className={`text-xs ${isDark ? 'text-emerald-500' : 'text-emerald-700'} mb-6`}>{t('merchant.profile.sinceJoining')}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className={`${isDark ? 'bg-slate-800/60 border-emerald-900/30' : 'bg-white/60 border-emerald-100/50'} p-3 rounded-xl border`}>
                  <p className={`text-2xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>
                    {stats.paperSaved} <span className="text-xs font-normal text-emerald-600">kg</span>
                  </p>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase">{t('merchant.profile.paperSaved')}</p>
                </div>
                <div className={`${isDark ? 'bg-slate-800/60 border-emerald-900/30' : 'bg-white/60 border-emerald-100/50'} p-3 rounded-xl border`}>
                  <p className={`text-2xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}>{stats.totalReceipts.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase">{t('merchant.profile.digitalBills')}</p>
                </div>
              </div>
            </div>
          </div>

          <button onClick={handleLogout} className={`w-full flex items-center justify-center gap-2 px-4 py-3 ${isDark ? 'bg-slate-800 border-red-900/30 text-red-400 hover:bg-red-900/20' : 'bg-red-50 text-red-600 hover:bg-red-100 border-red-100'} rounded-xl font-bold transition-colors border`}>
            <LogOut size={16} /> {t('merchant.profile.logoutAccount')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MerchantProfile;
