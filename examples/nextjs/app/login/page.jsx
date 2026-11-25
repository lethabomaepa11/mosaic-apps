import { site } from '../../lib/site.js';
import AuthForm from './auth-form.jsx';

export default async function Login({ searchParams }) {
  const allowRegistration = process.env.AUTH !== 'off' && site.allowRegistration === true;
  return <AuthForm allowRegistration={allowRegistration} registering={allowRegistration && (await searchParams).mode === 'signup'} />;
}
