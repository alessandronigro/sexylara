const { updateGroupGraph } = require('../memory/GroupMemoryStore');

function update(groupId, edgeUpdates) {
  if (!groupId) return null;
  updateGroupGraph(groupId, edgeUpdates);
  return edgeUpdates;
}

module.exports = {
  update,
};
