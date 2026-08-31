/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';
import { OperationType, FirestoreErrorInfo } from '../types';

// Silence background Firestore channel logs if database is unprovisioned
try {
  setLogLevel('silent');
} catch {}

const app = initializeApp(firebaseConfig as any);
const firestoreDatabaseId = (firebaseConfig as any).firestoreDatabaseId;

export const isFirestoreAvailable = Boolean(
  firestoreDatabaseId ||
  (import.meta as any).env?.VITE_ENABLE_FIRESTORE === 'true'
);

export const db = firestoreDatabaseId
  ? getFirestore(app, firestoreDatabaseId)
  : getFirestore(app); /* CRITICAL: The app will break without this line */
export const auth = getAuth();

// Initialize Firebase App Check with reCAPTCHA v3 support
if (typeof window !== 'undefined') {
  try {
    const siteKey = (import.meta as any).env?.VITE_RECAPTCHA_SITE_KEY;
    
    if (siteKey && siteKey !== '6Ld_k_YpAAAAADy9_y231hD2h8f9S0_example_key' && siteKey.trim() !== '') {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
      if ((import.meta as any).env?.DEV) {
        console.log('Firebase App Check initialized.');
      }
    } else {
      if ((import.meta as any).env?.DEV) {
        console.log('Firebase App Check skipped: No valid VITE_RECAPTCHA_SITE_KEY provided.');
      }
    }
  } catch (err) {
    if ((import.meta as any).env?.DEV) {
      console.warn('Firebase App Check failed to initialize gracefully:', err);
    }
  }
}

/**
 * Handle Firestore exceptions and rethrow a detailed, JSON-formatted error object.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
    }
  };
  if ((import.meta as any).env?.DEV) {
    console.error('Firestore Error: ', JSON.stringify(errInfo, null, 2));
  }
  throw new Error(JSON.stringify(errInfo));
}
