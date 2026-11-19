import jwt from 'jsonwebtoken';

// The one-click unsubscribe link at the bottom of an announcement mail. The token carries a
// purpose, so it cannot be used as a login session (see decisions.md, section 4).
export const unsubscribeUrlFor = (userId: number): string => {
  const token = jwt.sign({ userId, purpose: 'unsubscribe' }, process.env.JWT_SECRET!);
  return `${process.env.FRONTEND_URL}/api/auth/unsubscribe?token=${token}`;
};
