#!/usr/bin/env node

require("dotenv").config();
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT in environment");
  }

  const parsed = JSON.parse(raw);

  if (parsed.private_key) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }

  return parsed;
}

function getAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  return initializeApp({
    credential: cert(getServiceAccount()),
  });
}

async function makeAdminByEmail(email) {
  if (!email || !email.includes("@")) {
    throw new Error("Provide a valid email. Example: npm run make-admin -- user@example.com");
  }

  const app = getAdminApp();
  const auth = getAuth(app);
  const db = getFirestore(app);

  const userRecord = await auth.getUserByEmail(email);

  await db.collection("users").doc(userRecord.uid).set(
    {
      email: userRecord.email || email,
      role: "Admin",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    uid: userRecord.uid,
    email: userRecord.email || email,
  };
}

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error("Usage: npm run make-admin -- user@example.com");
    process.exit(1);
  }

  try {
    const result = await makeAdminByEmail(email.trim());
    console.log("✅ User promoted to Admin");
    console.log(`   Email: ${result.email}`);
    console.log(`   UID:   ${result.uid}`);
    console.log("   Please sign out and sign in again in the app.");
  } catch (error) {
    console.error("❌ Failed to promote user:", error.message || error);
    process.exit(1);
  }
}

main();
