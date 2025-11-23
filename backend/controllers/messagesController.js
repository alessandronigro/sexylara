const Message = require("../models/Message");
exports.getMessages = async (req, res) => {
  const messages = await Message.find({ userId: req.user.id });
  res.json(messages);
};
exports.saveMessage = async (req, res) => {
  const newMsg = new Message({ userId: req.user.id, ...req.body });
  await newMsg.save();
  res.json(newMsg);
};