import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, Calendar, Clock, MapPin, User, AlertCircle, ArrowRight, Activity, Navigation, Bell } from 'lucide-react';
import { requestNotificationPermission, db as firebaseDb } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

const API = 'http://localhost:5001';

function WaveBackground() {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '180px', overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      <svg viewBox="0 0 1440 180" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <motion.path
          fill="rgba(37,99,235,0.07)"
          animate={{ d: [
            "M0,80 C360,140 720,20 1080,80 C1260,110 1380,60 1440,80 L1440,180 L0,180 Z",
            "M0,100 C360,40 720,160 1080,100 C1260,70 1380,120 1440,100 L1440,180 L0,180 Z",
            "M0,80 C360,140 720,20 1080,80 C1260,110 1380,60 1440,80 L1440,180 L0,180 Z",
          ]}}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.path
          fill="rgba(139,92,246,0.07)"
          animate={{ d: [
            "M0,120 C360,60 720,180 1080,120 C1260,90 1380,150 1440,120 L1440,180 L0,180 Z",
            "M0,100 C360,160 720,40 1080,100 C1260,130 1380,70 1440,100 L1440,180 L0,180 Z",
            "M0,120 C360,60 720,180 1080,120 C1260,90 1380,150 1440,120 L1440,180 L0,180 Z",
          ]}}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
      </svg>
    </div>
  );
}

function AnimatedCounter({ target }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = 0;
    const end = parseInt(target);
    if (isNaN(end)) return;
    const step = Math.ceil(end / 30);
    const t = setInterval(() => {
      start += step;
      if (start >= end) { setVal(end); clearInterval(t); }
      else setVal(start);
    }, 40);
    return () => clearInterval(t);
  }, [target]);
  return <span>{val}</span>;
}

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospital, setSelectedHospital] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [problem, setProblem] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [activeAppointment, setActiveAppointment] = useState(null);
  const [queueStatus, setQueueStatus] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [now, setNow] = useState(new Date());
  const [booking, setBooking] = useState(false);

  const addToast = useCallback((msg, type = 'info') => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 8000);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchAppointments = useCallback(async (token) => {
    try {
      const res = await axios.get(`${API}/api/appointments/my-appointments`, { headers: { Authorization: `Bearer ${token}` } });
      setAppointments(res.data);
      const active = res.data.find(a => ['PENDING', 'IN_PROGRESS'].includes(a.status));
      setActiveAppointment(active || null);
      if (active) {
        const q = await axios.get(`${API}/api/appointments/queue/${active.doctorId}`);
        const queue = q.data;
        const current = queue.find(x => x.status === 'IN_PROGRESS');
        const position = queue.filter(x => x.status === 'PENDING' && x.tokenNumber <= active.tokenNumber).length;
        setQueueStatus({ currentPatient: current ? (current.tokenNumber === 0 ? 'EMG' : current.tokenNumber) : 'None', positionInQueue: position });
      } else {
        setQueueStatus(null);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!userData || !token || JSON.parse(userData).role !== 'PATIENT') { navigate('/login'); return; }
    const u = JSON.parse(userData);
    setUser(u);
    axios.get(`${API}/api/hospitals`).then(r => setHospitals(r.data));
    fetchAppointments(token);

    const setupFCM = async () => {
      try {
        const fcmToken = await requestNotificationPermission();
        if (fcmToken && u?.id) {
          await setDoc(doc(firebaseDb, 'Users', u.id.toString()), { fcmToken, mobileNumber: u.phone || '', isAppActive: true }, { merge: true });
        }
      } catch (e) { console.error(e); }
    };
    setupFCM();

    // FCM foreground messages - gracefully skip if not configured
    let unsub = () => {};
    import('../firebase').then(({ onMessageListener }) => {
      unsub = onMessageListener((payload) => {
        addToast(`${payload.notification?.title}: ${payload.notification?.body}`, 'info');
      });
    }).catch(() => {});

    const socket = io(API);
    socket.on(`patient_update_${u.id}`, (data) => {
      if (['STATUS_UPDATE', 'APPOINTMENT_BOOKED'].includes(data.type)) fetchAppointments(token);
      if (['UPCOMING_ALERT', 'NEXT_ALERT'].includes(data.type)) addToast(data.message, 'warning');
    });

    const onUnload = () => {
      if (u?.id) setDoc(doc(firebaseDb, 'Users', u.id.toString()), { isAppActive: false }, { merge: true });
    };
    window.addEventListener('beforeunload', onUnload);
    return () => { socket.disconnect(); unsub && unsub(); window.removeEventListener('beforeunload', onUnload); };
  }, [navigate, fetchAppointments, addToast]);

  useEffect(() => {
    if (!selectedHospital) { setDoctors([]); return; }
    axios.get(`${API}/api/hospitals/${selectedHospital}/doctors`).then(r => setDoctors(r.data));
  }, [selectedHospital]);

  const handleBook = async (e) => {
    e.preventDefault();
    setBooking(true);
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API}/api/appointments/book`, { doctorId: selectedDoctor, hospitalId: selectedHospital, issueDescription: problem }, { headers: { Authorization: `Bearer ${token}` } });
      setProblem(''); setSelectedHospital(''); setSelectedDoctor('');
      addToast('Appointment booked successfully!', 'success');
      fetchAppointments(token);
    } catch (err) {
      addToast(err.response?.data?.error || 'Booking failed', 'danger');
    } finally { setBooking(false); }
  };

  const logout = () => { localStorage.clear(); navigate('/login'); };

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div><div className="skeleton" style={{ width: 220, height: 32, marginBottom: 16 }} /><div className="skeleton" style={{ width: 160, height: 20 }} /></div>
    </div>
  );

  const historyAppts = appointments.filter(a => ['COMPLETED', 'SKIPPED', 'CANCELLED'].includes(a.status));

  return (
    <div className="container" style={{ maxWidth: 1500 }}>
      <div className="bg-orb" />

      {/* Toasts */}
      <div className="toast-container">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div key={t.id} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }} className={`toast ${t.type}`}>
              <Bell size={18} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{t.msg}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── HEADER ── */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="glass-panel"
        style={{ padding: '1.25rem 2.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(139,92,246,0.4)' }}>
            <User size={26} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.6rem' }}>Welcome, <span className="text-gradient">{user.name}</span></h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>How are you feeling today?</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'Outfit' }}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
          </div>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }} className="btn btn-secondary" onClick={logout} style={{ padding: '0.75rem', borderRadius: '50%' }} title="Logout">
            <LogOut size={19} />
          </motion.button>
        </div>
      </motion.div>

      {/* ── MAIN GRID ── */}
      <div className="grid grid-cols-2" style={{ gap: '2.5rem', alignItems: 'start', marginBottom: '3rem' }}>

        {/* LEFT – Book Appointment */}
        <motion.div initial={{ opacity: 0, x: -22 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
          className="glass-panel" style={{ padding: '2.75rem', position: 'relative', overflow: 'hidden' }}>
          <WaveBackground />
          <div style={{ position: 'absolute', top: 0, left: 0, width: 5, height: '100%', background: 'linear-gradient(180deg,#06b6d4,#2563eb)', borderRadius: '24px 0 0 24px' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2.25rem' }}>
              <Calendar size={24} color="var(--accent-cyan)" />
              <h3 style={{ margin: 0, fontSize: '1.5rem' }}>Book Consultation</h3>
            </div>
            <form onSubmit={handleBook}>
              <div className="form-group">
                <label className="form-label">Medical Facility</label>
                <select className="form-control" value={selectedHospital} onChange={e => setSelectedHospital(e.target.value)} required>
                  <option value="">— Choose Hospital / Clinic —</option>
                  {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Specialist</label>
                <select className="form-control" value={selectedDoctor} onChange={e => setSelectedDoctor(e.target.value)} required disabled={!selectedHospital}>
                  <option value="">— Choose Doctor —</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.user.name} ({d.specialization})</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: '2.5rem' }}>
                <label className="form-label">Symptoms & Reason</label>
                <textarea className="form-control" rows="4" value={problem} onChange={e => setProblem(e.target.value)} required placeholder="Describe your symptoms in detail..." style={{ resize: 'vertical' }} />
              </div>
              <motion.button whileHover={!activeAppointment ? { scale: 1.02 } : {}} whileTap={!activeAppointment ? { scale: 0.97 } : {}}
                type="submit" disabled={!!activeAppointment || booking}
                className={`btn ${activeAppointment ? 'btn-secondary' : 'btn-gradient glowing-element'}`}
                style={{ width: '100%', padding: '1.2rem', fontSize: '1.1rem', borderRadius: '16px' }}>
                {booking ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} /> Booking…
                  </span>
                ) : activeAppointment ? 'Active Appointment Exists' : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>Confirm Booking <ArrowRight size={20} /></span>
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>

        {/* RIGHT – Live Status */}
        <motion.div initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }}>
          <AnimatePresence mode="wait">
            {activeAppointment ? (
              <motion.div key="active" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
                className="glass-panel" style={{ padding: '2.75rem', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 0 50px rgba(139,92,246,0.15)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Activity size={24} color="var(--accent-purple)" />
                    <h3 style={{ margin: 0, fontSize: '1.4rem' }}>Live Queue Status</h3>
                  </div>
                  <span className={`badge ${activeAppointment.status === 'PENDING' ? 'badge-warning' : 'badge-primary'} glowing-element`}>
                    {activeAppointment.status}
                  </span>
                </div>

                {/* Token + Current serving */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div className="glass-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.28)' }}>
                    <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Your Token</p>
                    <div className="token-display glow-text" style={{ fontSize: '5rem' }}>
                      {activeAppointment.tokenNumber === 0 ? 'EMG' : activeAppointment.tokenNumber === -1 ? 'SCH' : activeAppointment.tokenNumber}
                    </div>
                  </div>
                  {activeAppointment.tokenNumber > 0 && queueStatus && (
                    <div className="glass-card" style={{ padding: '2.5rem 1.5rem', textAlign: 'center', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.28)' }}>
                      <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Now Serving</p>
                      <div style={{ fontSize: '5rem', fontFamily: 'Outfit', fontWeight: 900, lineHeight: 1, color: 'var(--warning)', filter: 'drop-shadow(0 0 18px rgba(245,158,11,0.5))' }}>
                        {queueStatus.currentPatient}
                      </div>
                    </div>
                  )}
                </div>

                {/* Position + ETA */}
                {activeAppointment.tokenNumber > 0 && queueStatus && (
                  <div className="glass-card" style={{ padding: '1.5rem 2rem', marginBottom: '2rem', background: 'rgba(0,0,0,0.35)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>People ahead of you</span>
                      <span style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit' }}>
                        <AnimatedCounter target={Math.max(0, queueStatus.positionInQueue - 1)} />
                      </span>
                    </div>
                    <div style={{ height: 1, background: 'var(--glass-border)', marginBottom: '1rem' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '1rem' }}>
                        <Clock size={18} /> Estimated Wait
                      </span>
                      <span className="text-gradient" style={{ fontSize: '1.6rem', fontWeight: 800, fontFamily: 'Outfit' }}>
                        <AnimatedCounter target={Math.max(0, queueStatus.positionInQueue - 1) * 15} /> min
                      </span>
                    </div>
                  </div>
                )}

                {/* Doctor info */}
                <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '1.5rem', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.6rem', borderRadius: '12px' }}>
                      <User size={18} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Doctor</p>
                      <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>Dr. {activeAppointment.doctor?.user?.name}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.08)', padding: '0.6rem', borderRadius: '12px' }}>
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Location</p>
                      <span style={{ fontSize: '1.05rem', color: 'var(--text-secondary)' }}>{activeAppointment.doctor?.hospital?.name}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel"
                style={{ padding: '6rem 3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '2.5rem', borderRadius: '50%', marginBottom: '2rem', border: '1px solid var(--glass-border)' }}>
                  <Navigation size={68} color="var(--text-muted)" />
                </div>
                <h3 style={{ fontSize: '1.6rem', marginBottom: '0.75rem' }}>No Active Appointment</h3>
                <p style={{ color: 'var(--text-secondary)', maxWidth: 340, lineHeight: 1.65 }}>Book an appointment on the left to see your live queue status here.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── HISTORY ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <Clock size={22} color="var(--text-muted)" />
          <h3 style={{ margin: 0, fontSize: '1.35rem' }}>Appointment History</h3>
        </div>
        {historyAppts.length === 0 ? (
          <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1rem' }}>
            No past appointments found. Your history will appear here.
          </div>
        ) : (
          <div className="grid grid-cols-3">
            {historyAppts.map((appt, idx) => (
              <motion.div key={appt.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + idx * 0.07 }} className="glass-card" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <strong style={{ fontSize: '1.05rem' }}>Dr. {appt.doctor?.user?.name}</strong>
                  <span className={`badge badge-${appt.status === 'COMPLETED' ? 'success' : 'danger'}`}>{appt.status}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                    <MapPin size={15} /> {appt.doctor?.hospital?.name}
                  </p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
                    <Calendar size={15} /> {new Date(appt.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
