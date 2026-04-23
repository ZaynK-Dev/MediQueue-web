const { db, messaging, twilioClient } = require('./firebase');

// Utility to send SMS
async function sendSMS(to, body) {
  if (!twilioClient) {
    console.log(`[Twilio Disabled] Would have sent SMS to ${to}: ${body}`);
    return;
  }
  try {
    await twilioClient.messages.create({
      body: body,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    console.log(`SMS sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
  }
}

// Utility to send Push Notification
async function sendPushNotification(fcmToken, title, body) {
  if (!messaging || !fcmToken) {
    console.log(`[FCM Disabled/No Token] Would have sent Push: ${title}`);
    return false;
  }
  try {
    await messaging.send({
      token: fcmToken,
      notification: { title, body }
    });
    console.log(`Push notification sent to token: ${fcmToken}`);
    return true;
  } catch (error) {
    console.error(`Failed to send push notification:`, error);
    return false;
  }
}

// The core notification router
async function notifyPatient(patientId, title, messageBody) {
  if (!db) return; // DB not initialized
  const userDoc = await db.collection('Users').doc(patientId).get();
  if (!userDoc.exists) return;
  
  const userData = userDoc.data();
  const { fcmToken, mobileNumber, isAppActive } = userData;

  let pushSuccess = false;
  if (fcmToken && isAppActive) {
    pushSuccess = await sendPushNotification(fcmToken, title, messageBody);
  }

  if (!pushSuccess && mobileNumber) {
    await sendSMS(mobileNumber, `${title}: ${messageBody}`);
  }
}

// Listen to Firestore Changes
function startNotificationListener() {
  if (!db) {
    console.warn('Cannot start Notification Listener: Firestore is not initialized.');
    return;
  }
  console.log('Started Firestore Notification Listener...');
  
  db.collection('Appointments').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
      const appointment = change.doc.data();
      const patientId = appointment.patientId;

      if (change.type === 'added') {
        await notifyPatient(
          patientId, 
          'Appointment Confirmed', 
          `Your appointment with Dr. ${appointment.doctorName} is confirmed for ${appointment.time}.`
        );
      }
      
      if (change.type === 'modified') {
        if (appointment.status === 'NEXT_IN_QUEUE') {
          await notifyPatient(
            patientId,
            'Get Ready!',
            `You are next in queue for Dr. ${appointment.doctorName}. Please proceed to the clinic.`
          );
        } else if (appointment.status === 'SKIPPED') {
          await notifyPatient(
            patientId,
            'Queue Update',
            `Your turn was skipped by Dr. ${appointment.doctorName}. Please contact the reception.`
          );
        }
      }
    });
  });
}

module.exports = { startNotificationListener };
