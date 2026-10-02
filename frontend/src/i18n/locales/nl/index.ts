import type { en } from '../en';
import { common } from './common';
import { errors } from './errors';
import { auth } from './auth';
import { home } from './home';
import { races } from './races';
import { lb } from './lb';
import { ds } from './ds';
import { teams } from './teams';
import { news } from './news';
import { stats } from './stats';
import { live } from './live';
import { profile } from './profile';
import { pw } from './pw';
import { rules } from './rules';
import { about } from './about';
import { privacy } from './privacy';

export const nl: Record<keyof typeof en, string> = {
  ...common,
  ...errors,
  ...auth,
  ...home,
  ...races,
  ...lb,
  ...ds,
  ...teams,
  ...news,
  ...stats,
  ...live,
  ...profile,
  ...pw,
  ...rules,
  ...about,
  ...privacy,
};
