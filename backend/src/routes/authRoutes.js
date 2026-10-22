const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateUser } = require("../middleware/authMiddleware");

// Public authentication routes
router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/logout", authController.logout);

// Protected customer profile routes
router.get("/me", authenticateUser, authController.getProfile);
router.put("/profile", authenticateUser, authController.updateProfile);

module.exports = router;
