import { findTrolleyRecipient, getSupabaseUser, safePayoutProfile, syncTrolleyProfile } from '../../server/trolley-lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  try {
    const authorization = req.headers.authorization || '';
    const accessToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    const user = await getSupabaseUser(accessToken);
    const recipient = await findTrolleyRecipient(user.id);
    if (!recipient) {
      res.status(200).json({ ok: true, configured: false, ready: false });
      return;
    }
    const profile = safePayoutProfile(recipient);
    await syncTrolleyProfile(user.id, recipient);
    const ready = Boolean(profile?.recipientId && profile?.status === 'active' && profile?.complianceStatus !== 'blocked' && profile?.payoutMethod === 'bank-transfer' && profile?.country && profile?.currency);
    res.status(200).json({
      ok: true, configured: true, ready,
      country: profile?.country || null, currency: profile?.currency || null,
      recipientStatus: profile?.status || null, complianceStatus: profile?.complianceStatus || null,
      payoutMethod: profile?.payoutMethod || null, routeMinimum: profile?.routeMinimum ?? null,
      estimatedFee: profile?.estimatedFee ?? null, bankName: profile?.bankName || null,
      accountLast4: profile?.accountLast4 || null
    });
  } catch (error) {
    const message = error?.message || 'Could not refresh bank payout status.';
    res.status(/credentials|configured/i.test(message) ? 503 : 400).json({ error: message });
  }
}
