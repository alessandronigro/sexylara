// In-memory group memory/gossip store (placeholder; replace with DB persistence when available).

const groupMemory = new Map(); // groupId -> { events: [], gossip: [] }

function getGroupState(groupId) {
  if (!groupMemory.has(groupId)) {
    groupMemory.set(groupId, { events: [], gossip: [] });
  }
  return groupMemory.get(groupId);
}

function addGossip(groupId, entry) {
  if (!groupId || !entry) return;
  const state = getGroupState(groupId);
  state.gossip.push({ ...entry, at: Date.now() });
  if (state.gossip.length > 50) state.gossip = state.gossip.slice(-50);
}

function addEvent(groupId, event) {
  if (!groupId || !event) return;
  const state = getGroupState(groupId);
  state.events.push({ ...event, at: Date.now() });
  if (state.events.length > 100) state.events = state.events.slice(-100);
}

module.exports = {
  getGroupState,
  addGossip,
  addEvent,
};
