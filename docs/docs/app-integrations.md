---
title: App integrations
---

# App integrations

:::note Framework version
OAuth, notification delivery, and the Svelte Map and OAuth components are documented for the current source tree. The published server `0.4.1` and UI `0.4.2` packages predate these additions. Use a build from source or a published release that includes them. Cloud project connections for GitHub, Neon, and Vercel are separate from these app integrations.
:::

OAuth and notification credentials belong in your app's server environment. Use
the environment variables in your scaffold's `.env.example` or pass
`auth.oauth` and `notifications` to `createMosaicServer()`. Configure each
deployment separately.

## OAuth sign-in

Set `MOSAIC_OAUTH_ORIGIN` to your app's exact public origin, such as
`https://app.example.com`. Use an explicit localhost origin and port for development.
Keep `MOSAIC_JWT_SECRET` stable across all server instances.

| Provider | Required environment variables | Callback path |
| --- | --- | --- |
| Google | `MOSAIC_GOOGLE_CLIENT_ID`, `MOSAIC_GOOGLE_CLIENT_SECRET` | `/api/auth/oauth/google/callback` |
| GitHub | `MOSAIC_GITHUB_CLIENT_ID`, `MOSAIC_GITHUB_CLIENT_SECRET` | `/api/auth/oauth/github/callback` |

- **Google.** Create a web application OAuth client. Add the full callback URL
  under authorized redirect URIs and configure the consent screen. Mosaic requests
  `openid email profile`. [Google OAuth setup](https://developers.google.com/identity/openid-connect/openid-connect)
- **GitHub.** Register an OAuth App and enter the full callback URL. Mosaic
  requests `read:user` and `user:email` to identify the account. [GitHub OAuth App setup](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

The default sign-in page shows the configured providers. In Studio, add
**OAuth sign-in** to a custom page and choose a provider or **All configured
providers**. Set **After sign-in** to a path on your app, such as `/dashboard`.

With public sign-up enabled, first-time OAuth users get the viewer role. To
connect a provider to an existing account, sign in with the current password,
return to the sign-in page, and select **Link Google account** or **Link GitHub
account**. This keeps the existing account and permissions.

## Notifications

Choose one provider per deployment with `MOSAIC_NOTIFICATION_PROVIDER`.

- **ntfy** delivers push messages to the topic you configure. Set
  `MOSAIC_NTFY_URL` for self-hosting, `MOSAIC_NTFY_TOPIC`, and
  `MOSAIC_NTFY_TOKEN` for a protected topic. Subscribers follow the same
  topic in their ntfy client. [ntfy publishing guide](https://docs.ntfy.sh/publish/)
- **Resend** delivers transactional email. Set `MOSAIC_RESEND_API_KEY` and
  `MOSAIC_RESEND_FROM` to a sender on your verified domain. Pass a recipient
  in `to` when sending. [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)

Call `client.sendNotification({ title, message, to })` or add a Studio
**API request** action with method **POST** and path `/notifications`.
The server requires the `notifications:send` permission or an administrator
account. Studio's **Message** action shows an in-app toast.

## Maps

Add a **Map** component in Studio and set its title and coordinates. Choose
**OpenStreetMap** for an interactive embed using open map data. Choose
**Mapbox** for a static image using its commercial API. Mapbox uses a
browser-visible `pk.` token restricted to your app's website.
[OpenStreetMap attribution](https://www.openstreetmap.org/copyright) · [Mapbox Static Images API](https://docs.mapbox.com/api/maps/static-images/)
