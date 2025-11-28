/**
 * Minimal push notification stub for Android/Web/iOS.
 * Stores tokens per user and platform and provides a send function.
 * Replace send logic with real FCM/APNs/web-push as needed.
 */

const userPushTokens = new Map(); // userId -> [{ platform, token }]

function registerPushToken(userId, platform, token) {
  if (!userId || !platform || !token) return;
  const list = userPushTokens.get(userId) || [];
  const exists = list.some((t) => t.token === token && t.platform === platform);
  if (!exists) {
    list.push({ platform, token });
    userPushTokens.set(userId, list);
  }
}

function getTokens(userId) {
  return userPushTokens.get(userId) || [];
}

async function sendPushNotification(userId, payload) {
  const tokens = getTokens(userId);
  if (!tokens.length) return false;
  // TODO: Integrate with FCM/APNs/Web-Push.
  console.log(`📲 (stub) Sending push to ${userId} tokens=${tokens.length}:`, payload);
  return true;
}

module.exports = {
  registerPushToken,
  sendPushNotification,
  getTokens,
};
