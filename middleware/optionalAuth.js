const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Unlike `protect`, this never returns 401 — it's for public endpoints that
// behave slightly differently (e.g. record an interaction) when the caller
// happens to be logged in.
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (user && !user.isRestricted) req.user = user;
    next();
  } catch (err) {
    // Invalid/expired token on a public route — proceed as anonymous rather than failing
    next();
  }
};

module.exports = { optionalAuth };
