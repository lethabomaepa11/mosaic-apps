import { site } from '../../lib/site.js';
import { readAuthPage } from '../../lib/artifacts.js';
import AuthForm from './auth-form.jsx';

export default async function Login({ searchParams }) {
  const allowRegistration = process.env.AUTH !== 'off' && site.allowRegistration === true;
  const registering = allowRegistration && (await searchParams).mode === 'signup';
  const page = await readAuthPage(registering ? '/signup' : '/login');
  return <AuthForm allowRegistration={allowRegistration} registering={registering} page={page} />;
}
