import { readMosaic } from '../../lib/artifacts.js';

export default async function OAuthChoices({ provider = 'all', next = '/', error, linkAccounts = false }) {
  const { data } = await readMosaic('/auth/oauth');
  const providers = data?.providers.filter(({ id }) => provider === 'all' || id === provider) ?? [];
  return <>
    {error && <p role="alert">{error === 'existing' ? 'This email already has an account. Sign in with your password, then return here to link the provider.' : 'Could not complete provider sign-in. Try again or sign in with your password.'}</p>}
    {providers.map(({ id, label }) => {
      const action = `/api/auth/oauth/${id}/start?next=${encodeURIComponent(next)}`;
      return data.signedIn && linkAccounts
        ? <form key={id} action={action} method="post"><button type="submit">Link {label} account</button></form>
        : <p key={id}><a className="workflow-action" href={action}>Continue with {label}</a></p>;
    })}
  </>;
}
