import { getAdminAuth, getAdminDb } from "./firebaseAdmin";

export async function getUserFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) {
    return null;
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const roleDoc = await getAdminDb().collection("users").doc(decoded.uid).get();
    const role = roleDoc.exists ? roleDoc.data().role || "Student" : "Student";

    return {
      uid: decoded.uid,
      email: decoded.email || "",
      role,
    };
  } catch {
    return null;
  }
}

export function isAdminRole(role) {
  return String(role || "").toLowerCase() === "admin";
}
