const crypto = require('crypto');

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}_${Date.now()}`;
}

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

class AutomationControlPlane {
  constructor({ maxLog = 1000 } = {}) {
    this.maxLog = Math.max(100, Math.min(10000, Number(maxLog) || 1000));
    this.sessions = new Map();
    this.leases = new Map();
    this.commandLog = [];
  }

  createSession({ agentName = 'llm-agent', purpose = '', metadata = {} } = {}) {
    const sessionId = makeId('llm');
    const startedAt = nowIso();
    const session = {
      sessionId,
      agentName: String(agentName || 'llm-agent').slice(0, 120),
      purpose: String(purpose || '').slice(0, 500),
      metadata: cleanObject(metadata),
      status: 'active',
      startedAt,
      lastHeartbeatAt: startedAt,
      endedAt: null,
      state: {},
    };
    this.sessions.set(sessionId, session);
    this.logEvent({ sessionId, type: 'session.create', details: { agentName: session.agentName, purpose: session.purpose } });
    return { ok: true, session };
  }

  getSession(sessionId) {
    const id = String(sessionId || '').trim();
    if (!id) return null;
    return this.sessions.get(id) || null;
  }

  heartbeat({ sessionId, state = {} } = {}) {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Unknown automation session.');
    session.lastHeartbeatAt = nowIso();
    session.status = 'active';
    session.state = cleanObject(state);
    this.logEvent({ sessionId: session.sessionId, type: 'session.heartbeat', details: { state: session.state } });
    return { ok: true, session };
  }

  endSession({ sessionId, reason = '' } = {}) {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Unknown automation session.');
    session.status = 'ended';
    session.endedAt = nowIso();
    for (const [leaseName, lease] of Array.from(this.leases.entries())) {
      if (lease.sessionId === session.sessionId) this.leases.delete(leaseName);
    }
    this.logEvent({ sessionId: session.sessionId, type: 'session.end', details: { reason: String(reason || '') } });
    return { ok: true, session };
  }

  listSessions() {
    return {
      ok: true,
      sessions: Array.from(this.sessions.values()).sort((a, b) => String(b.lastHeartbeatAt).localeCompare(String(a.lastHeartbeatAt))),
      leases: Array.from(this.leases.values()),
    };
  }

  acquireLease({ sessionId, leaseName = 'default', ttlMs = 30000 } = {}) {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Unknown automation session.');

    const name = String(leaseName || 'default').trim();
    if (!name) throw new Error('leaseName is required');

    const now = Date.now();
    const existing = this.leases.get(name);
    if (existing && existing.expiresAtMs > now && existing.sessionId !== session.sessionId) {
      return { ok: false, reason: 'lease_held', lease: existing };
    }

    const lease = {
      leaseName: name,
      sessionId: session.sessionId,
      agentName: session.agentName,
      acquiredAt: nowIso(),
      expiresAtMs: now + Math.max(1000, Math.min(600000, Number(ttlMs) || 30000)),
    };
    this.leases.set(name, lease);
    this.logEvent({ sessionId: session.sessionId, type: 'lease.acquire', details: { leaseName: name } });
    return { ok: true, lease };
  }

  releaseLease({ sessionId, leaseName = 'default' } = {}) {
    const session = this.getSession(sessionId);
    if (!session) throw new Error('Unknown automation session.');
    const name = String(leaseName || 'default').trim();
    const existing = this.leases.get(name);
    if (!existing) return { ok: true, released: false };
    if (existing.sessionId !== session.sessionId) return { ok: false, reason: 'not_lease_owner', lease: existing };
    this.leases.delete(name);
    this.logEvent({ sessionId: session.sessionId, type: 'lease.release', details: { leaseName: name } });
    return { ok: true, released: true };
  }

  logEvent({ sessionId = null, type = 'event', details = {} } = {}) {
    const entry = {
      eventId: makeId('evt'),
      sessionId: sessionId == null ? null : String(sessionId),
      type: String(type || 'event'),
      details: cleanObject(details),
      createdAt: nowIso(),
    };
    this.commandLog.push(entry);
    if (this.commandLog.length > this.maxLog) this.commandLog.splice(0, this.commandLog.length - this.maxLog);
    return { ok: true, entry };
  }

  listLog({ limit = 200 } = {}) {
    const lim = Math.max(1, Math.min(this.maxLog, Number(limit) || 200));
    return { ok: true, events: this.commandLog.slice(-lim).reverse() };
  }
}

module.exports = {
  AutomationControlPlane,
};
