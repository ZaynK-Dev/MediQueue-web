import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { HeartPulse, User, Stethoscope, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const defaultRole = new URLSearchParams(location.search).get('role') || 'PATIENT';

  const [role, setRole] = useState(defaultRole);
  const [isSignup, setIsSignup] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');

  const set = (k) => (e) => setFormData((p) => ({ ...p, [k]: e.target.value }));

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isSignup) {
        if (role === 'DOCTOR') {
          setError('Doctor registration requires admin approval. Use demo credentials below.');
          setLoading(false);
          return;
        }
        const res = await axios.post('http://localhost:5001/api/auth/signup/patient', {
          name: formData.name, email: formData.email,
          password: formData.password, phone: formData.phone,
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate('/patient');
      } else {
        const res = await axios.post('http://localhost:5001/api/auth/login', {
          email: formData.email, password: formData.password,
        });
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        navigate(res.data.user.role === 'DOCTOR' ? '/doctor' : '/patient');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', position: 'relative'
    }}>
      <div className="bg-orb" />

      {/* Left decorative panel (desktop) */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hide-on-mobile"
        style={{
          width: 420, marginRight: '3rem',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="glass-panel"
        style={{ width: '100%', maxWidth: 460, padding: '3rem 2.5rem' }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: 68, height: 68, borderRadius: '22px',
            background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 0 40px rgba(139,92,246,0.45), inset 0 1px 1px rgba(255,255,255,0.2)',
          }}>
            <HeartPulse size={32} color="white" />
          </div>
          <h2 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>MediQueue</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Next-gen Healthcare Portal</p>
        </div>

        {/* Role Toggle */}
        <div style={{
          display: 'flex', gap: '0.5rem', marginBottom: '2rem',
          background: 'rgba(0,0,0,0.3)', padding: '0.4rem',
          borderRadius: '16px', border: '1px solid var(--glass-border)',
        }}>
          {[
            { r: 'PATIENT', Icon: User, label: 'Patient' },
            { r: 'DOCTOR',  Icon: Stethoscope, label: 'Doctor' },
          ].map(({ r, Icon, label }) => (
            <button
              key={r}
              onClick={() => { setRole(r); setIsSignup(false); setError(''); }}
              style={{
                flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none',
                fontFamily: 'Outfit', fontWeight: 600, fontSize: '0.95rem',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'all 0.25s ease',
                background: role === r
                  ? 'linear-gradient(135deg, #2563eb, #8b5cf6)'
                  : 'transparent',
                color: role === r ? '#fff' : 'var(--text-secondary)',
                boxShadow: role === r ? '0 4px 18px rgba(139,92,246,0.35)' : 'none',
              }}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>

        {/* Mode label */}
        <h3 style={{ fontSize: '1.4rem', marginBottom: '1.75rem', color: 'var(--text-primary)' }}>
          {isSignup ? 'Create Account' : 'Welcome Back'}
        </h3>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '12px', padding: '0.9rem 1.25rem', marginBottom: '1.5rem',
                fontSize: '0.9rem', color: '#fca5a5',
              }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleAuth}>
          <AnimatePresence>
            {isSignup && role === 'PATIENT' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input className="form-control" type="text" required value={formData.name}
                    onChange={set('name')} placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input className="form-control" type="tel" required value={formData.phone}
                    onChange={set('phone')} placeholder="+91 9876543210" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-control" type="email" required value={formData.email}
              onChange={set('email')} placeholder="you@example.com" />
            {role === 'DOCTOR' && !isSignup && (
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                Demo: atul@aiims.com
              </small>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-control"
                type={showPwd ? 'text' : 'password'}
                required value={formData.password}
                onChange={set('password')}
                placeholder="••••••••"
                style={{ paddingRight: '3.5rem' }}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)}
                style={{
                  position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  padding: 0, display: 'flex', alignItems: 'center',
                }}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {role === 'DOCTOR' && !isSignup && (
              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                Demo password: 123456
              </small>
            )}
          </div>

          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-gradient glowing-element"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.75rem', padding: '1.1rem', fontSize: '1.1rem', borderRadius: '16px' }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{
                  width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                  display: 'inline-block',
                }} />
                Please wait…
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {isSignup ? 'Create Account' : 'Sign In'} <ArrowRight size={20} />
              </span>
            )}
          </motion.button>
        </form>

        {role === 'PATIENT' && (
          <p style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {isSignup ? 'Already registered?' : "Don't have an account?"}{' '}
            <span
              onClick={() => { setIsSignup(!isSignup); setError(''); }}
              style={{ color: 'var(--accent-cyan)', cursor: 'pointer', fontWeight: 600 }}
            >
              {isSignup ? 'Sign In' : 'Sign Up'}
            </span>
          </p>
        )}
      </motion.div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
