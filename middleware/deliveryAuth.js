const jwt = require("jsonwebtoken");
const DeliveryPartner = require("../models/DeliveryPartner");

const protectDeliveryPartner = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Not authorized, delivery partner token required",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const partner = await DeliveryPartner.findById(
      decoded.id
    );

    if (!partner) {
      return res.status(404).json({
        message: "Delivery partner not found",
      });
    }

    req.deliveryPartner = partner;

    next();
  } catch (err) {
    console.error(
      "Delivery authentication error:",
      err.message
    );

    return res.status(401).json({
      message: "Invalid or expired delivery partner token",
    });
  }
};

module.exports = {
  protectDeliveryPartner,
};