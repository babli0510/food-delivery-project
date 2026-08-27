const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const DeliveryPartner = require("../models/DeliveryPartner");

// ======================================================
// Generate JWT Token
// ======================================================

const generateToken = (id) => {
  return jwt.sign(
    {
      id,
      role: "delivery_partner",
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

// ======================================================
// POST /api/delivery/auth/register
// ======================================================

const registerDeliveryPartner = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      password,
      coordinates,
    } = req.body;

    if (
      !name ||
      !phone ||
      !email ||
      !password ||
      !coordinates
    ) {
      return res.status(400).json({
        message:
          "name, phone, email, password and coordinates are required",
      });
    }

    if (
      !Array.isArray(coordinates) ||
      coordinates.length !== 2 ||
      typeof coordinates[0] !== "number" ||
      typeof coordinates[1] !== "number"
    ) {
      return res.status(400).json({
        message: "coordinates must be [lng, lat]",
      });
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    const existingPartner =
      await DeliveryPartner.findOne({
        $or: [
          { email: normalizedEmail },
          { phone },
        ],
      });

    if (existingPartner) {
      return res.status(409).json({
        message:
          "Delivery partner with this email or phone already exists",
      });
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const partner =
      await DeliveryPartner.create({
        name,
        phone,
        email: normalizedEmail,
        password: hashedPassword,
        isAvailable: true,
        currentLoad: 0,
        location: {
          type: "Point",
          coordinates,
        },
      });

    return res.status(201).json({
      _id: partner._id,
      name: partner.name,
      phone: partner.phone,
      email: partner.email,
      role: "delivery_partner",
      token: generateToken(partner._id),
    });
  } catch (err) {
    console.error(
      "registerDeliveryPartner error:",
      err
    );

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// POST /api/delivery/auth/login
// ======================================================

const loginDeliveryPartner = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    const partner =
      await DeliveryPartner.findOne({
        email: normalizedEmail,
      });

    if (!partner) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    const isPasswordCorrect =
      await bcrypt.compare(
        password,
        partner.password
      );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid credentials",
      });
    }

    return res.json({
      _id: partner._id,
      name: partner.name,
      phone: partner.phone,
      email: partner.email,
      role: "delivery_partner",
      token: generateToken(partner._id),
    });
  } catch (err) {
    console.error(
      "loginDeliveryPartner error:",
      err
    );

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// POST /api/delivery/auth/reset-password
// LOCAL TESTING ONLY
// ======================================================

const resetDeliveryPartnerPassword = async (
  req,
  res
) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        message:
          "email and newPassword are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message:
          "newPassword must be at least 6 characters",
      });
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    const partner =
      await DeliveryPartner.findOne({
        email: normalizedEmail,
      });

    if (!partner) {
      return res.status(404).json({
        message: "Delivery partner not found",
      });
    }

    partner.password =
      await bcrypt.hash(newPassword, 10);

    await partner.save();

    return res.json({
      message: "Password reset successfully",
    });
  } catch (err) {
    console.error(
      "resetDeliveryPartnerPassword error:",
      err
    );

    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// ======================================================
// EXPORTS
// ======================================================

module.exports = {
  registerDeliveryPartner,
  loginDeliveryPartner,
  resetDeliveryPartnerPassword,
};