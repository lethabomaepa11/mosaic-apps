import { notFound } from 'next/navigation';
import { readAuthPage } from '../../lib/artifacts.js';
import { site } from '../../lib/site.js';
import AuthForm from '../login/auth-form.jsx';
import OAuthChoices from '../login/oauth-choices.jsx';

export default async function Signup({ searchParams }) {
  if (process.env.AUTH === 'off' || site.allowRegistration !== true) notFound();
  const page = await readAuthPage('/signup');
  const { next } = await searchParams;
  return <AuthForm allowRegistration registering page={page}><OAuthChoices next={typeof next === 'string' ? next : '/'} linkAccounts /></AuthForm>;
}
