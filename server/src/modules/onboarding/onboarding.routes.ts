import { Router } from 'express';
import { validateZod } from '../../middlewares/validateZod.js';
import { requireUserId } from '../../utils/requestUser.js';
import { sendSuccess } from '../../utils/response.js';
import { onboardingSchema } from './onboarding.schemas.js';
import { completeOnboarding } from './onboarding.service.js';

export const onboardingRouter = Router();

onboardingRouter.post('/', validateZod({ body: onboardingSchema }), async (req, res) => {
  const result = await completeOnboarding(requireUserId(req), req.body);
  sendSuccess(res, 'Onboarding selesai. Perjalanan UPgrade-mu dimulai!', result, { status: 201 });
});
