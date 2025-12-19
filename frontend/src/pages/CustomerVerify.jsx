import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { requestOtp, setSession, verifyOtpCode } from '../services/api.js';

const CustomerVerify = () => {
  const navigate = useNavigate();
  // We can get the email passed from the previous page to show it here
  const location = useLocation();
  const email = location.state?.email || "your email";

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Handle typing in the 6 boxes
  const handleChange = (element, index) => {
    if (isNaN(element.value)) return false;

    const newOtp = [...otp];
    newOtp[index] = element.value;
    setOtp(newOtp);

    // Auto-focus next input
    if (element.nextSibling && element.value) {
      element.nextSibling.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter a valid 6-digit code.");
      return;
    }
    if (!email) {
      setError("Missing email. Go back to sign up and try again.");
      return;
    }

    setLoading(true);
    setError('');
    setInfo('');

    try {
      const { data } = await verifyOtpCode({ email, role: 'customer', code });
      setSession({ token: data.token, role: data.role });
      setInfo('Email verified! Redirecting...');
      navigate('/customer-dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Missing email. Go back to sign up and try again.');
      return;
    }
    setResending(true);
    setError('');
    setInfo('');
    try {
      await requestOtp({ email, role: 'customer' });
      setInfo('New code sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 via-white to-green-50 min-h-screen flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="w-full max-w-[420px]">
        
        <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200/60 p-8 md:p-10 border border-slate-100 relative overflow-hidden text-center">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-green-300"></div>

          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
            <i className="fas fa-shield-alt"></i>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2">Verify your Email</h2>
          <p className="text-slate-500 text-sm mb-4">
            We sent a code to <span className="font-bold text-slate-700">{email}</span>.
          </p>
          {error && <div className="text-sm text-red-600 mb-4">{error}</div>}
          {info && <div className="text-sm text-emerald-700 mb-4">{info}</div>}

          <form onSubmit={handleVerify}>
            <div className="flex justify-center gap-2 mb-8">
              {otp.map((data, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength="1"
                  className="w-10 h-12 border-2 border-slate-200 rounded-lg text-center text-xl font-bold focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition-all bg-slate-50"
                  value={data}
                  onChange={(e) => handleChange(e.target, index)}
                  onFocus={(e) => e.target.select()}
                />
              ))}
            </div>

            <button type="submit" disabled={loading} className="w-full py-4 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-60">
              {loading ? 'Verifying...' : 'Verify Account'}
            </button>
          </form>

          <div className="mt-8 text-sm text-slate-500">
            Didn't receive code? <br />
            <button type="button" onClick={handleResend} disabled={resending} className="font-bold text-emerald-600 hover:underline mt-2 disabled:opacity-60">
              {resending ? 'Sending...' : 'Resend Code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerVerify;