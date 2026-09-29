import express from 'express';
import {
  getProfile,
  registerWithPassword,
  loginWithPassword,
  changeEmail,
  deleteAccount,
  unsubscribe,
} from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Password authentication
router.post('/register-password', registerWithPassword);
router.post('/login-password', loginWithPassword);

// Profile
router.get('/profile', authenticate, getProfile);
router.put('/email', authenticate, changeEmail);
router.delete('/account', authenticate, deleteAccount);

// Public — reached directly from an email link, not the app
router.get('/unsubscribe', unsubscribe);

export default router;
