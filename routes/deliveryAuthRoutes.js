const express = require("express");

const router = express.Router();

const {
  registerDeliveryPartner,
  loginDeliveryPartner,
  resetDeliveryPartnerPassword,
} = require("../controllers/deliveryAuthController");

// ======================================================
// POST /api/delivery/auth/register
// ======================================================

router.post(
  "/register",
  registerDeliveryPartner
);

// ======================================================
// POST /api/delivery/auth/login
// ======================================================

router.post(
  "/login",
  loginDeliveryPartner
);

// ======================================================
// POST /api/delivery/auth/reset-password
// LOCAL TESTING ONLY
// ======================================================

router.post(
  "/reset-password",
  resetDeliveryPartnerPassword
);

module.exports = router;