const admin = require('firebase-admin');
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let db = null;
let messaging = null;

try {
  const serviceAccountPath = path.join(__dirname, '../firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    messaging = admin.messaging();
    console.log('Firebase Admin initialized successfully.');
  } else {
    console.warn('Firebase Service Account not found. Firebase Admin is disabled.');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error.message);
}

let twilioClient = null;
if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    console.log('Twilio Client initialized successfully.');
  } catch (error) {
    console.error('Error initializing Twilio:', error.message);
  }
} else {
  console.warn('Twilio credentials missing. SMS notifications disabled.');
}

module.exports = { admin, db, messaging, twilioClient };
