import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  getProfile,
  registerWithPassword,
  loginWithPassword,
  changeEmail,
  changeNickname,
  forgotPassword,
  resetPassword,
  deleteAccount,
  unsubscribe,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Password reset sends mail and accepts guessable-by-brute-force tokens, so it
// gets limits much tighter than the app-wide one.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many reset requests. Please try again in a few minutes.' },
});
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// Password authentication
router.post('/register-password', registerWithPassword);
router.post('/login-password', loginWithPassword);
router.post('/forgot-password', forgotLimiter, forgotPassword);
router.post('/reset-password', resetLimiter, resetPassword);

// Profile
router.get('/profile', authenticate, getProfile);
router.put('/email', authenticate, changeEmail);
router.put('/nickname', authenticate, changeNickname);
router.delete('/account', authenticate, deleteAccount);

// Public — reached directly from an email link, not the app
router.get('/unsubscribe', unsubscribe);

export default router;
