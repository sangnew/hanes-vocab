// Firebase project config — safe to be public; access is controlled by
// Firestore security rules, not by hiding these values.
// Reuses the same Firebase project as the Busan/Jeju trip site (trip-af733) —
// this app just uses its own top-level collection ("categories") in the same
// Firestore database, so no new project/console setup was needed.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA9OCKXK8OZu8Vz-lxkAiJh-nZVzOWuRJU",
  authDomain: "trip-af733.firebaseapp.com",
  projectId: "trip-af733",
  storageBucket: "trip-af733.firebasestorage.app",
  messagingSenderId: "870457044792",
  appId: "1:870457044792:web:9fe9885f4fd8bcabf49bcd",
};
