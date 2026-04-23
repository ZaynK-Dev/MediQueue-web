import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import emailjs from '@emailjs/browser';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut, Users, CheckCircle, SkipForward, Play,
  Activity, Bell, Clock, AlertCircle, Stethoscope, ChevronRight
} from 'lucide-react';

const API = 'http://localhost:5001';

function StatCard({ icon: Icon, color, bg, border, title, value, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 280, damping: 24 }}
      className="glass-card stat-card"
    >
      <div className="stat-icon" style={{ background: bg, border: `1px solid ${border}` }}>
        <Icon size={26} color={color} />
      </div>
      <div>
        <div className="stat-value" style={{ color }}>{value ?? '–'}</div>
        <div className="stat-label">{title}</div>
      </div>
    </motion.div>
  );
}

function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export default function DoctorDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [queue, setQueue] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [now, setNow] = useState(new Date());
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Elapsed timer
  const inProgress = queue.find((q) => q.status === 'IN_PROGRESS');
  useEffect(() => {
    if (!inProgress) { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => clearInterval(t);
  }, [inProgress?.id]);

  const fetchQueue = useCallback(async (doctorId) => {
    const res = await axios.get(`${API}/api/appointments/queue/${doctorId}`);
    setQueue(res.data);
  }, []);

  const fetchAnalytics = useCallback(async (doctorId, token) => {
    const res = await axios.get(`${API}/api/appointments/analytics/${doctorId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setAnalytics(res.data);
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!userData || !token || JSON.parse(userData).role !== 'DOCTOR') {
      navigate('/login?role=DOCTOR');
      return;
    }
    const u = JSON.parse(userData);
    setUser(u);
    fetchQueue(u.doctorId);
    fetchAnalytics(u.doctorId, token);

    const socket = io(API);
    socket.on(`queue_update_${u.doctorId}`, () => {
      fetchQueue(u.doctorId);
      fetchAnalytics(u.doctorId, token);
    });
    return () => socket.disconnect();
  }, [navigate, fetchQueue, fetchAnalytics]);

  const updateStatus = async (id, status, skipReason = null) => {
    const token = localStorage.getItem('token');
    await axios.put(`${API}/api/appointments/${id}/status`, { status, skipReason }, {
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  const handleCallNext = (id) => { setElapsed(0); updateStatus(id, 'IN_PROGRESS'); };
  const handleComplete = (id) => { updateStatus(id, 'COMPLETED'); addToast('Consultation completed!', 'success'); };
  const handleSkip = (id) => {
    const reason = prompt('Reason for skipping (or press OK for No Show):');
    if (reason !== null) updateStatus(id, 'SKIPPED', reason || 'No Show');
  };
  const handleNotify = () => {
    if (!inProgress) return;

    // Setup EmailJS params
    const templateParams = {
      patient_name: inProgress.patient.name,
      patient_email: inProgress.patient.email,
      doctor_name: user.name,
      message: "Please proceed to the doctor's cabin for your consultation.",
    };

    emailjs.send(
      'service_l7qpl3y',
      'template_9oldfid',
      templateParams,
      { publicKey: '8RFSppL7cFygujseu' }
    ).then(() => {
      addToast('Email notification sent to patient.', 'success');
    }).catch((err) => {
      console.error('EmailJS error:', err);
      addToast('Failed to send email notification.', 'danger');
    });
  };
  const logout = () => { localStorage.clear(); navigate('/login?role=DOCTOR'); };

  const waiting = queue.filter((q) => q.status === 'PENDING');

  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="skeleton" style={{ width: 220, height: 32, marginBottom: 16 }} />
          <div className="skeleton" style={{ width: 160, height: 20 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 1700 }}>
      <div className="bg-orb" />

      {/* Toast Container */}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 60 }}
              className={`toast ${t.type}`}
            >
              <Bell size={20} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.95rem', fontWeight: 500 }}>{t.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── TOP BAR ── */}
      <motion.div
        initial={{ opacity: 0, y: -22 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-panel"
        style={{ padding: '1.25rem 2.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
          {/* Logo */}
          <div style={{
            width: 48, height: 48, borderRadius: '14px',
            background: 'linear-gradient(135deg,#2563eb,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(139,92,246,0.4)',
          }}>
            <Stethoscope size={24} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.6rem' }}>
              Dr. <span className="text-gradient">{user.name}</span>
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>MediQueue Health Portal</p>
          </div>
          {/* Status badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.65rem',
            background: inProgress ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
            padding: '0.45rem 1.1rem', borderRadius: '99px',
            border: `1px solid ${inProgress ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.35)'}`,
          }}>
            <span className={`status-dot ${inProgress ? 'busy' : 'online'}`} />
            <span style={{
              fontSize: '0.8rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
              color: inProgress ? 'var(--warning)' : 'var(--success)',
            }}>
              {inProgress ? 'In Consultation' : 'Online & Ready'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'Outfit', letterSpacing: '-0.02em' }}>
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            className="btn btn-secondary"
            onClick={logout}
            style={{ padding: '0.75rem', borderRadius: '50%' }}
            title="Logout"
          >
            <LogOut size={19} />
          </motion.button>
        </div>
      </motion.div>

      {/* ── STATS ROW ── */}
      {analytics && (
        <div className="grid grid-cols-4" style={{ marginBottom: '2.5rem' }}>
          <StatCard icon={Users} color="#60a5fa" bg="rgba(37,99,235,0.14)" border="rgba(37,99,235,0.28)" title="Total Patients Today" value={analytics.totalPatientsToday} delay={0} />
          <StatCard icon={CheckCircle} color="#34d399" bg="rgba(16,185,129,0.12)" border="rgba(16,185,129,0.28)" title="Completed Consultations" value={analytics.completedToday} delay={0.07} />
          <StatCard icon={Clock} color="#fbbf24" bg="rgba(245,158,11,0.12)" border="rgba(245,158,11,0.28)" title="Avg Consultation Time" value={analytics.averageConsultationTime} delay={0.14} />
          <StatCard icon={Activity} color="#a78bfa" bg="rgba(139,92,246,0.14)" border="rgba(139,92,246,0.28)" title="Current Queue Length" value={waiting.length} delay={0.21} />
        </div>
      )}

      {/* ── MAIN SPLIT ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '2.5rem', alignItems: 'start' }}>
        {/* LEFT – Current Patient */}
        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Activity size={22} style={{ color: 'var(--accent-purple)' }} />
            <h3 style={{ margin: 0, fontSize: '1.35rem' }}>Current Patient Consultation</h3>
          </div>

          <AnimatePresence mode="wait">
            {inProgress ? (
              <motion.div
                key="in-progress"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className="glass-panel"
                style={{
                  padding: '3rem',
                  border: '1px solid rgba(139,92,246,0.4)',
                  boxShadow: '0 0 50px rgba(139,92,246,0.18), inset 0 0 30px rgba(139,92,246,0.04)',
                }}
              >
                {/* Purple side strip */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: 5, height: '100%', background: 'linear-gradient(180deg,#2563eb,#8b5cf6)', borderRadius: '24px 0 0 24px' }} />
                {/* Ambient glow */}
                <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '100%', background: 'radial-gradient(circle at 85% 15%, rgba(139,92,246,0.08), transparent 55%)', pointerEvents: 'none' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', position: 'relative', zIndex: 2 }}>
                  <div style={{ flex: 1 }}>
                    {/* Badge + Timer row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                      <span className="badge badge-primary glowing-element">Active Consultation</span>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: 'rgba(255,255,255,0.06)', padding: '0.4rem 1rem',
                        borderRadius: '99px', border: '1px solid var(--glass-border)',
                      }}>
                        <Clock size={15} color="var(--text-secondary)" />
                        <span style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.05rem', color: 'var(--warning)' }}>
                          {formatTime(elapsed)}
                        </span>
                      </div>
                    </div>

                    {/* Patient name */}
                    <h1 style={{ fontSize: '3.5rem', marginBottom: '1.25rem', lineHeight: 1.05 }}>
                      {inProgress.patient.name}
                    </h1>

                    {/* Issue */}
                    <div style={{
                      background: 'rgba(0,0,0,0.35)', padding: '1.25rem 1.5rem',
                      borderRadius: '16px', border: '1px solid var(--glass-border)',
                      display: 'inline-block', maxWidth: '100%',
                    }}>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Chief Complaint</p>
                      <p style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>{inProgress.issueDescription}</p>
                    </div>
                  </div>

                  {/* Token */}
                  <div style={{
                    textAlign: 'center', padding: '2rem 2.5rem',
                    background: 'rgba(0,0,0,0.45)', borderRadius: '22px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 0 30px rgba(0,0,0,0.5)',
                    marginLeft: '2rem', flexShrink: 0,
                  }}>
                    <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>TOKEN</p>
                    <div className={`token-display ${inProgress.tokenNumber === 0 ? 'glowing-danger' : 'glowing-element'}`}
                      style={{ fontSize: '5.5rem', color: inProgress.tokenNumber === 0 ? 'var(--danger)' : undefined }}>
                      {inProgress.tokenNumber === 0 ? 'EMG' : inProgress.tokenNumber}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '1rem', position: 'relative', zIndex: 2 }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    className="btn btn-gradient" onClick={() => handleComplete(inProgress.id)}
                    style={{ flex: 2, padding: '1.25rem', fontSize: '1.05rem', borderRadius: '14px' }}>
                    <CheckCircle size={22} style={{ marginRight: 10 }} /> Complete
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    className="btn btn-secondary" onClick={handleNotify}
                    style={{ flex: 1, borderRadius: '14px' }}>
                    <Bell size={20} style={{ marginRight: 8 }} /> Notify
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    className="btn btn-secondary" onClick={() => handleSkip(inProgress.id)}
                    style={{ flex: 1, borderRadius: '14px', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>
                    <SkipForward size={20} style={{ marginRight: 8 }} /> Skip
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-panel"
                style={{ padding: '6rem 3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}
              >
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2.5rem', borderRadius: '50%', marginBottom: '2rem', border: '1px solid var(--glass-border)' }}>
                  <Users size={72} color="var(--text-muted)" />
                </div>
                <h2 style={{ fontSize: '1.8rem', marginBottom: '0.75rem' }}>Ready for Next Patient</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: 420, marginBottom: '2.5rem', lineHeight: 1.65 }}>
                  No active consultation. Call the next patient from the queue when ready.
                </p>
                {waiting.length > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn btn-primary glowing-element"
                    onClick={() => handleCallNext(waiting[0].id)}
                    style={{ padding: '1.1rem 2.5rem', fontSize: '1.1rem', borderRadius: '100px' }}
                  >
                    <Play size={22} style={{ marginRight: 10 }} fill="currentColor" />
                    Call Token {waiting[0].tokenNumber === 0 ? 'EMG' : waiting[0].tokenNumber}
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* RIGHT – Live Queue */}
        <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.22 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.35rem' }}>Live Queue</h3>
            <span className="badge badge-warning">{waiting.length} waiting</span>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 620, overflowY: 'auto' }}>
            {waiting.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <CheckCircle size={44} opacity={0.4} />
                <span style={{ fontSize: '1rem' }}>Queue is empty</span>
              </div>
            ) : (
              <AnimatePresence>
                {waiting.map((appt, idx) => {
                  const isNext = idx === 0 && !inProgress;
                  const isEmg = appt.tokenNumber === 0;
                  return (
                    <motion.div
                      key={appt.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 50, scale: 0.9 }}
                      transition={{ delay: idx * 0.04 }}
                      className={`queue-row ${isNext ? 'next-patient' : ''} ${isEmg ? 'emergency' : ''}`}
                    >
                      {/* Token bubble */}
                      <div className={isEmg ? 'glowing-danger' : ''} style={{
                        width: 52, height: 52, borderRadius: '14px', flexShrink: 0,
                        background: isEmg ? 'var(--danger-bg)' : 'rgba(255,255,255,0.05)',
                        color: isEmg ? 'var(--danger)' : 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 800, fontSize: '1.4rem', fontFamily: 'Outfit',
                        border: `1px solid ${isEmg ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.09)'}`,
                      }}>
                        {isEmg ? <AlertCircle size={24} /> : appt.tokenNumber}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '1rem' }}>{appt.patient.name}</span>
                          {isNext && <span className="badge badge-primary" style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem' }}>NEXT</span>}
                          {isEmg && <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem' }}>URGENT</span>}
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>{appt.issueDescription}</p>
                      </div>

                      {isNext && !inProgress ? (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.92 }}
                          className="btn btn-primary"
                          onClick={() => handleCallNext(appt.id)}
                          style={{ padding: '0.65rem', borderRadius: '12px' }}
                          title="Call patient"
                        >
                          <Play size={18} fill="currentColor" />
                        </motion.button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleSkip(appt.id)}
                          style={{ padding: '0.65rem', borderRadius: '12px' }}
                          title="Skip"
                        >
                          <ChevronRight size={18} />
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
