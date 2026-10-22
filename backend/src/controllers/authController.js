const userStore = require("../services/userStore");
const { generateToken } = require("../utils/token");

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// POST /api/auth/register
async function register(req, res, next) {
  try {
    const { email, password, fullName, phone = "" } = req.body;

    if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter your full name.",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long.",
      });
    }

    const user = await userStore.createUser({
      email,
      password,
      fullName,
      phone,
      role: "rider",
    });

    const token = generateToken({
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully. Welcome to SwiftRide!",
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await userStore.authenticateUser(email, password);

    const token = generateToken({
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    });

    return res.json({
      success: true,
      message: "Signed in successfully. Welcome back!",
      token,
      user,
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/auth/me
async function getProfile(req, res, next) {
  try {
    const user = await userStore.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/auth/profile
async function updateProfile(req, res, next) {
  try {
    const { fullName, phone } = req.body;
    const updatedUser = await userStore.updateUserProfile(req.user.id, {
      fullName,
      phone,
    });

    return res.json({
      success: true,
      message: "Profile updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  return res.json({
    success: true,
    message: "Logged out successfully.",
  });
}

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  logout,
};
