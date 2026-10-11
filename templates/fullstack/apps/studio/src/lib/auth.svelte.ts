/** Auth store for the studio (token in localStorage via MosaicClient). */

import { client } from './client';

export interface AuthState {
  user: { id: string; email: string; name: string; roles: string[]; isAdmin: boolean } | null;
  ready: boolean;
}

class AuthStore {
  user = $state<AuthState['user']>(null);
  ready = $state(false);

  async refresh(): Promise<void> {
    try {
      const me = await client.me();
      this.user = me;
    } catch {
      this.user = null;
    } finally {
      this.ready = true;
    }
  }

  async login(email: string, password: string): Promise<void> {
    const res = await client.login(email, password);
    client.setToken(res.token);
    await this.refresh();
  }

  logout(): void {
    client.logout().catch(() => undefined);
    client.setToken(null);
    this.user = null;
  }

  get isAdmin(): boolean {
    return Boolean(this.user?.isAdmin);
  }
}

export const auth = new AuthStore();
