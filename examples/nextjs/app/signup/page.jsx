import { notFound } from 'next/navigation';
import { readAuthPage } from '../../lib/artifacts.js';
import { site } from '../../lib/site.js';
import AuthForm from '../login/auth-form.jsx';

export default async function Signup() {
  if (process.env.AUTH === 'off' || site.allowRegistration !== true) notFound();
  const page = await readAuthPage('/signup');
  return <AuthForm allowRegistration registering page={page} />;
}
