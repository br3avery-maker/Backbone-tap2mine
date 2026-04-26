/**
 * Tap2Mine Relay Client — Rotator with automatic failover
 *
 * Cycles through multiple relay servers. If one dies, marks it dead,
 * tries the next. Periodically re-probes dead relays.
 *
 * The relay list is embedded in the app and can be updated from peers.
 */

export interface RelayServer {
  url: string;
  status: 'alive' | 'dead' | 'unknown';
  lastCheck: number;
  lastSuccess: number;
  failures: number;
}

export interface RelayMessage {
  from: string;
  data: unknown;
  timestamp: number;
}

export type MessageHandler = (message: RelayMessage) => void;

// Default relay list — shipped with the app, updated dynamically
const DEFAULT_RELAYS: RelayServer[] = [
  // ── UPDATE THESE after deploying your relay! ──
  { url: 'https://tap2mine-relay.br3avery.workers.dev', status: 'unknown', lastCheck: 0, lastSuccess: 0, failures: 0 },
  { url: 'https://tap2mine-signal.pages.dev', status: 'unknown', lastCheck: 0, lastSuccess: 0, failures: 0 },
  { url: 'https://chao-relay.fly.dev', status: 'unknown', lastCheck: 0, lastSuccess: 0, failures: 0 },
];

const MAX_FAILURES = 3;
const HEALTH_INTERVAL = 60_000;
const REPROBE_DEAD_INTERVAL = 300_000;
const POLL_INTERVAL = 2000;

export class RelayClient {
  private relays: RelayServer[];
  private activeRelay: RelayServer | null = null;
  private token: string | null = null;
  private nodeId: string | null = null;
  private onMessage: MessageHandler;
  private polling = false;
  private since = 0;

  constructor(nodeId: string, onMessage: MessageHandler, relays: RelayServer[] = DEFAULT_RELAYS) {
    this.nodeId = nodeId;
    this.onMessage = onMessage;
    this.relays = relays;
  }

  async register(): Promise<boolean> {
    const relay = this.findBestRelay();
    if (!relay) return false;

    try {
      const res = await this.fetchJson(relay.url, '/v1/register', { method: 'POST' });
      if (res?.token) {
        this.token = res.token;
        this.activeRelay = relay;
        relay.status = 'alive';
        relay.lastSuccess = Date.now();
        relay.failures = 0;
        console.log(`[Relay] Registered with ${relay.url}`);
        this.startPolling();
        return true;
      }
    } catch {
      this.markRelayDead(relay);
    }
    return false;
  }

  async send(toNodeId: string, message: unknown): Promise<boolean> {
    if (!this.activeRelay || !this.token) {
      const ok = await this.register();
      if (!ok) return false;
    }

    try {
      await this.fetchJson(this.activeRelay!.url, '/v1/send', {
        method: 'POST',
        body: JSON.stringify({
          token: this.token,
          to_node_id: toNodeId,
          from_node_id: this.nodeId,
          message,
        }),
      });
      return true;
    } catch {
      this.markRelayDead(this.activeRelay!);
      const ok = await this.register();
      if (ok) {
        return this.send(toNodeId, message);
      }
      return false;
    }
  }

  addRelay(url: string) {
    if (!this.relays.find(r => r.url === url)) {
      this.relays.push({ url, status: 'unknown', lastCheck: 0, lastSuccess: 0, failures: 0 });
    }
  }

  getRelays(): RelayServer[] { return [...this.relays]; }
  getActiveRelay(): string | null { return this.activeRelay?.url || null; }

  private async fetchJson(baseUrl: string, path: string, init: RequestInit = {}): Promise<any> {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  private findBestRelay(): RelayServer | null {
    const now = Date.now();
    const sorted = [...this.relays].sort((a, b) => {
      if (a.status === 'alive' && b.status !== 'alive') return -1;
      if (a.status !== 'alive' && b.status === 'alive') return 1;
      if (a.status === 'dead' && b.status !== 'dead') return 1;
      if (a.status !== 'dead' && b.status === 'dead') return -1;
      return a.failures - b.failures;
    });
    for (const relay of sorted) {
      if (relay.status === 'alive') return relay;
      if (relay.status === 'unknown') return relay;
      if (relay.status === 'dead' && now - relay.lastCheck > REPROBE_DEAD_INTERVAL) return relay;
    }
    return null;
  }

  private markRelayDead(relay: RelayServer) {
    relay.failures++;
    relay.status = 'dead';
    relay.lastCheck = Date.now();
    if (this.activeRelay === relay) this.activeRelay = null;
  }

  private startPolling() {
    if (this.polling) return;
    this.polling = true;

    const poll = async () => {
      if (!this.activeRelay || !this.token) { this.polling = false; return; }

      try {
        const result = await this.fetchJson(this.activeRelay.url, '/v1/poll', {
          method: 'POST',
          body: JSON.stringify({ token: this.token, since: this.since }),
        });
        this.activeRelay.status = 'alive';
        this.activeRelay.lastSuccess = Date.now();
        this.activeRelay.failures = 0;

        if (result.messages?.length > 0) {
          for (const msg of result.messages) { this.onMessage(msg); }
          this.since = result.since || Date.now();
        }
      } catch {
        this.markRelayDead(this.activeRelay);
        await this.register();
      }
      setTimeout(poll, POLL_INTERVAL);
    };
    poll();
  }
}
