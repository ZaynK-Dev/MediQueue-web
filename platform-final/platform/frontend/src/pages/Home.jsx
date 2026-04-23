import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Activity, Stethoscope, User, Shield, Zap, Clock } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();

  const features = [
    { icon: Zap, color: '#60a5fa', label: 'Real-time Queue', desc: 'Live updates via WebSocket' },
    { icon: Clock, color: '#a78bfa', label: 'Smart Tokens', desc: 'Auto FIFO generation' },
    { icon: Shield, color: '#34d399', label: 'Push Alerts', desc: 'FCM + SMS notifications' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="bg-orb" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        style={{ textAlign: 'center', maxWidth: 700, width: '100%' }}
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          style={{
            width: 88, height: 88, borderRadius: '28px',
            background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 2.5rem',
            boxShadow: '0 0 50px rgba(139,92,246,0.5), inset 0 1px 1px rgba(255,255,255,0.25)',
          }}
        >
          <Activity size={44} color="white" />
        </motion.div>

        <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', marginBottom: '1rem', lineHeight: 1.05 }}>
          <span className="text-gradient">MediQueue</span>
          <br />
          <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>Hospital Portal</span>
        </h1>

        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 3.5rem', lineHeight: 1.7 }}>
          AI-powered appointment & queue management. Zero wait confusion, maximum care.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4rem' }}>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-primary"
            onClick={() => navigate('/login?role=PATIENT')}
            style={{ padding: '1.1rem 2.5rem', fontSize: '1.1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <User size={22} /> Patient Login
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-gradient glowing-element"
            onClick={() => navigate('/login?role=DOCTOR')}
            style={{ padding: '1.1rem 2.5rem', fontSize: '1.1rem', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          >
            <Stethoscope size={22} /> Doctor Portal
          </motion.button>
        </div>

        {/* Feature Pills */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              className="glass-card"
              style={{ padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 180 }}
            >
              <div style={{ background: `${f.color}20`, padding: '0.6rem', borderRadius: '12px', border: `1px solid ${f.color}40` }}>
                <f.icon size={22} color={f.color} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.95rem' }}>{f.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{f.desc}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
