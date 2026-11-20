import { Router } from 'express';
import { authCookie, clearAuthCookie, setAuthCookie } from '../../middlewares/authCookie.js';
import { authRateLimiter } from '../../middlewares/rateLimiter.js';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { loginSchema, registerSchema, updatePreferencesSchema } from './auth.schemas.js';
import {
  getCurrentUser,
  loginUser,
  registerUser,
  toPublicUser,
  updatePreferences,
} from './auth.service.js';

export const authRouter = Router();

authRouter.post('/register', authRateLimiter, validateZod({ body: registerSchema }), async (req, res) => {
  const user = await registerUser(req.body);
  setAuthCookie(res, user.id);
  sendSuccess(res, 'Pendaftaran berhasil. Selamat datang di UPgrade!', { user: toPublicUser(user) }, { status: 201 });
});

authRouter.post('/login', authRateLimiter, validateZod({ body: loginSchema }), async (req, res) => {
  const user = await loginUser(req.body);
  setAuthCookie(res, user.id);
  sendSuccess(res, 'Berhasil masuk.', { user: toPublicUser(user) });
});

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res);
  sendSuccess(res, 'Berhasil keluar.', null);
});

authRouter.get('/me', authCookie, async (req, res) => {
  const user = await getCurrentUser(requireUserId(req));
  sendSuccess(res, 'Data pengguna berhasil dimuat.', { user: toPublicUser(user) });
});

authRouter.patch('/preferences', authCookie, validateZod({ body: updatePreferencesSchema }), async (req, res) => {
  const user = await updatePreferences(requireUserId(req), req.body);
  sendSuccess(res, 'Pengaturan berhasil disimpan.', { user: toPublicUser(user) });
});
