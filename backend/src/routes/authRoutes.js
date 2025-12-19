import express from "express";
import {
	login,
	registerCustomer,
	registerMerchant,
	requestOtp,
	verifyEmail,
	verifyOtp,
	forgotPassword, // <--- Import the new function
  	resetPassword   // <--- Import the new function
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup/customer", registerCustomer);
router.post("/signup/merchant", registerMerchant);
router.post("/login", login);
router.post("/otp/request", requestOtp);
router.post("/otp/verify", verifyOtp);
router.get("/verify/:token", verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
