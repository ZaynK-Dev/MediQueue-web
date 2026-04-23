import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Replace with your actual Firebase config from Firebase Console
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Messaging is only available in browser with valid HTTPS or localhost + VAPID key
let messagingInstance = null;
export let messaging = null;

const initMessaging = async () => {
  try {
    const { getMessaging } = await import('firebase/messaging');
    messagingInstance = getMessaging(app);
    messaging = messagingInstance;
  } catch (e) {
    console.warn('[FCM] Messaging not available:', e.message);
  }
};

// Only init messaging if browser supports it
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  initMessaging();
}

export const requestNotificationPermission = async () => {
  try {
    if (!messagingInstance) await initMessaging();
    if (!messagingInstance) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    const { getToken } = await import('firebase/messaging');
    const token = await getToken(messagingInstance, {
      vapidKey: 'YOUR_VAPID_KEY_HERE'
    });
    return token;
  } catch (error) {
    console.warn('[FCM] Could not get token:', error.message);
    return null;
  }
};

export const onMessageListener = (callback) => {
  if (!messagingInstance) return () => {};
  import('firebase/messaging').then(({ onMessage }) => {
    onMessage(messagingInstance, callback);
  });
  return () => {};
};
