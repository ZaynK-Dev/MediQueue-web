const express = require('express');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { db, messaging, twilioClient } = require('../services/firebase');

const router = express.Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid token' }); }
};

// ── Notification helpers ──────────────────────────────────────────────────────
async function sendSMS(to, body) {
  if (!twilioClient || !to) return;
  try {
    await twilioClient.messages.create({ body, from: process.env.TWILIO_PHONE_NUMBER, to });
    console.log(`[SMS] Sent to ${to}`);
  } catch (e) { console.error('[SMS] Failed:', e.message); }
}

async function sendFCM(fcmToken, title, body) {
  if (!messaging || !fcmToken) return false;
  try {
    await messaging.send({ token: fcmToken, notification: { title, body } });
    return true;
  } catch (e) { console.error('[FCM] Failed:', e.message); return false; }
}

async function notifyPatient(patientId, title, body) {
  // Try FCM first, fallback to SMS
  if (!db) return;
  try {
    const snap = await db.collection('Users').doc(String(patientId)).get();
    if (!snap.exists) return;
    const { fcmToken, mobileNumber, isAppActive } = snap.data();
    const pushed = fcmToken && isAppActive ? await sendFCM(fcmToken, title, body) : false;
    if (!pushed && mobileNumber) await sendSMS(mobileNumber, `${title}: ${body}`);
  } catch (e) { console.error('[Notify] Error:', e.message); }
}

// ── Book Appointment ──────────────────────────────────────────────────────────
router.post('/book', auth, async (req, res) => {
  const { doctorId, hospitalId, issueDescription, preferredTime } = req.body;
  const patientId = req.user.id;
  try {
    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId }, include: { user: true, hospital: true }
    });
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    let tokenNumber = 0;
    let estimatedTime = new Date();

    if (doctor.category === 'Surgeon') {
      tokenNumber = -1;
      estimatedTime = preferredTime ? new Date(preferredTime) : new Date(Date.now() + 86400000);
    } else if (doctor.category === 'Emergency Doctor') {
      tokenNumber = 0;
    } else {
      const latest = await prisma.appointment.findFirst({
        where: { doctorId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
        orderBy: { tokenNumber: 'desc' }
      });
      tokenNumber = latest && latest.tokenNumber > 0 ? latest.tokenNumber + 1 : 1;
      const queueCount = await prisma.appointment.count({ where: { doctorId, status: { in: ['PENDING', 'IN_PROGRESS'] } } });
      const mins = doctor.category === 'Specialist' ? 20 : 10;
      estimatedTime = new Date(Date.now() + queueCount * mins * 60000);
    }

    const appointment = await prisma.appointment.create({
      data: { patientId, doctorId, hospitalId, status: 'PENDING', tokenNumber, issueDescription, estimatedTime },
      include: { patient: true }
    });

    // Notify
    req.io.emit(`queue_update_${doctorId}`, { type: 'NEW_APPOINTMENT', appointment });
    req.io.emit(`patient_update_${patientId}`, { type: 'APPOINTMENT_BOOKED', appointment });
    await notifyPatient(patientId, 'Appointment Confirmed',
      `Token #${tokenNumber > 0 ? tokenNumber : tokenNumber === 0 ? 'Emergency' : 'Scheduled'} with Dr. ${doctor.user.name} at ${doctor.hospital.name}.`);

    res.json(appointment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Get queue ────────────────────────────────────────────────────────────────
router.get('/queue/:doctorId', async (req, res) => {
  try {
    const queue = await prisma.appointment.findMany({
      where: { doctorId: req.params.doctorId, status: { in: ['PENDING', 'IN_PROGRESS', 'SKIPPED'] } },
      include: { patient: true },
    });
    const sorted = queue.sort((a, b) => {
      if (a.tokenNumber === 0 && b.tokenNumber !== 0) return -1;
      if (b.tokenNumber === 0 && a.tokenNumber !== 0) return 1;
      return a.tokenNumber - b.tokenNumber;
    });
    res.json(sorted);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── My Appointments ──────────────────────────────────────────────────────────
router.get('/my-appointments', auth, async (req, res) => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { patientId: req.user.id },
      include: { doctor: { include: { user: true, hospital: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(appointments);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Update Status ─────────────────────────────────────────────────────────────
router.put('/:id/status', auth, async (req, res) => {
  const { status, skipReason } = req.body;
  try {
    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status, skipReason },
      include: { patient: true, doctor: { include: { user: true, hospital: true } } }
    });

    req.io.emit(`patient_update_${appointment.patientId}`, { type: 'STATUS_UPDATE', status, appointment });
    req.io.emit(`queue_update_${appointment.doctorId}`, { type: 'STATUS_UPDATE' });

    if (status === 'SKIPPED') {
      await notifyPatient(appointment.patientId, 'Queue Update',
        `Your turn was skipped by Dr. ${appointment.doctor?.user?.name}. You can rejoin the queue.`);
    }

    if (status === 'IN_PROGRESS') {
      const queue = await prisma.appointment.findMany({
        where: { doctorId: appointment.doctorId, status: 'PENDING' },
        orderBy: { tokenNumber: 'asc' }
      });
      // Notify #1 in queue (next)
      if (queue.length > 0) {
        req.io.emit(`patient_update_${queue[0].patientId}`, { type: 'NEXT_ALERT', message: 'Please be ready – you are next!' });
        await notifyPatient(queue[0].patientId, '⚡ You\'re Next!', 'Please proceed to the doctor\'s room now.');
      }
      // Notify #3 in queue (upcoming)
      if (queue.length > 2) {
        req.io.emit(`patient_update_${queue[2].patientId}`, { type: 'UPCOMING_ALERT', message: 'Your turn is coming soon – 3rd in queue.' });
        await notifyPatient(queue[2].patientId, 'Get Ready!', 'Your turn is near. Please arrive at the hospital.');
      }
    }

    res.json(appointment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Rejoin ────────────────────────────────────────────────────────────────────
router.post('/:id/rejoin', auth, async (req, res) => {
  try {
    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status: 'PENDING', skipReason: null }
    });
    req.io.emit(`queue_update_${appointment.doctorId}`, { type: 'STATUS_UPDATE' });
    req.io.emit(`patient_update_${appointment.patientId}`, { type: 'STATUS_UPDATE', appointment });
    res.json(appointment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/analytics/:doctorId', auth, async (req, res) => {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const appointments = await prisma.appointment.findMany({
      where: { doctorId: req.params.doctorId, createdAt: { gte: today } }
    });
    const completed = appointments.filter(a => a.status === 'COMPLETED').length;
    res.json({
      totalPatientsToday: appointments.length,
      completedToday: completed,
      averageConsultationTime: '15 mins',
      peakHours: '10 AM – 12 PM'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── Manual Notify ─────────────────────────────────────────────────────────────
router.post('/notify/:patientId', auth, async (req, res) => {
  const { title, body } = req.body;
  await notifyPatient(req.params.patientId, title || 'MediQueue', body || 'Please check your queue status.');
  res.json({ success: true });
});

module.exports = router;
