import express from "express";
import {
	login,
	registerCustomer,
	registerMerchant,
	requestOtp,
	verifyEmail,
	verifyOtp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup/customer", registerCustomer);
router.post("/signup/merchant", registerMerchant);
router.post("/login", login);
router.post("/otp/request", requestOtp);
router.post("/otp/verify", verifyOtp);
router.get("/verify/:token", verifyEmail);

export default router;
