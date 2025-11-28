function analyze(context, perception) {
  if (!context.groupId) {
    return {
      groupIntent: 'private',
    };
  }

  const callouts = ['luna', 'lei', 'lui'];
  const groupMention = callouts.some((keyword) =>
    context.message.toLowerCase().includes(keyword),
  );
  return {
    groupIntent: groupMention ? 'addressed' : 'observing',
    focus: context.message.slice(0, 100),
  };
}

module.exports = {
  analyze,
};
