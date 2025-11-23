const jwt = require("jsonwebtoken");

exports.login = (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "Username richiesto" });
  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.json({ token });
};
