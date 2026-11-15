import { Router } from 'express';
import { authMiddleware, publicUserSelect } from '../middlewares/authMiddleware.js';
import { cookieOptions, issueSession, opaqueToken, readCookie, sessions, sessionCookie } from '../services/sessionService.js';
import { providerConfig, socialAuth } from '../services/socialAuthService.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import prisma from '../config/prisma.js';

const router = Router();
const bindingCookie = () => process.env.NODE_ENV === 'production' ? '__Host-havie_oauth' : 'havie_oauth';
router.get('/providers', (req, res) => {
  res.set('Cache-Control', 'no-store').json({ data: Object.fromEntries(['google', 'facebook'].map((provider) => {
    try { providerConfig(provider); return [provider, true]; } catch { return [provider, false]; }
  })) });
});
router.post('/social/:provider/start', (req, res, next) => req.body?.mode === 'link' ? authMiddleware(req, res, next) : next(), asyncHandler(async (req, res) => {
  const binding = opaqueToken();
  const url = await socialAuth.begin(req.params.provider, { binding, returnTo: req.body?.returnTo, linkUserId: req.user?.id ?? null });
  res.cookie(bindingCookie(), binding, { ...cookieOptions(), maxAge: 600000 });
  res.set('Cache-Control', 'no-store').json({ data: { url } });
}));
router.get('/social/:provider/callback', asyncHandler(async (req, res) => {
  const config = providerConfig(req.params.provider);
  const destination = new URL('/auth', config.appOrigin);
  try {
    if (req.query.error) throw new HttpError(400, 'OAUTH_CANCELLED', 'Đã hủy đăng nhập.');
    const currentSession = await sessions.read(readCookie(req, sessionCookie()));
    const currentUser = currentSession && await prisma.user.findUnique({ where: { id: currentSession.userId }, select: { id: true, isActive: true, authVersion: true } });
    const authenticatedUserId = currentUser?.isActive && currentUser.authVersion === currentSession.authVersion ? currentUser.id : null;
    const result = await socialAuth.complete(req.params.provider, { code: req.query.code, state: req.query.state, binding: readCookie(req, bindingCookie()), authenticatedUserId });
    const user = Object.fromEntries(Object.keys(publicUserSelect).map((key) => [key, result.user[key]]));
    await issueSession(req, res, user);
    destination.searchParams.set('social', 'success');
    destination.searchParams.set('returnTo', result.returnTo);
  } catch (error) {
    const allowed = ['OAUTH_CANCELLED', 'OAUTH_ACCOUNT_EXISTS', 'OAUTH_ALREADY_LINKED', 'ACCOUNT_DISABLED'];
    destination.searchParams.set('socialError', allowed.includes(error.code) ? error.code : 'OAUTH_FAILED');
  }
  res.clearCookie(bindingCookie(), cookieOptions());
  res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer').redirect(destination.href);
}));
export default router;
