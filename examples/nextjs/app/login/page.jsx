import { site } from '../../lib/site.js';
import { readAuthPage } from '../../lib/artifacts.js';
import AuthForm from './auth-form.jsx';
import OAuthChoices from './oauth-choices.jsx';

export default async function Login({ searchParams }) {
  const allowRegistration = process.env.AUTH !== 'off' && site.allowRegistration === true;
  const search = await searchParams;
  const registering = allowRegistration && search.mode === 'signup';
  const page = await readAuthPage(registering ? '/signup' : '/login');
  return <AuthForm allowRegistration={allowRegistration} registering={registering} page={page}>
    <OAuthChoices next={typeof search.next === 'string' ? search.next : '/'} error={search.oauth} linkAccounts />
  </AuthForm>;
}
