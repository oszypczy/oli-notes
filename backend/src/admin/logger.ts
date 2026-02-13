export type EventType =
  | 'login_success'
  | 'login_denied_faculty'
  | 'logout'
  | 'auth_verify_fail'
  | 'error'
  | 'admin_access';

export interface LogEvent {
  id: number;
  timestamp: string;
  type: EventType;
  usosId?: string;
  ip?: string;
  detail?: string;
}

export interface EventStats {
  loginsToday: number;
  loginsTotal: number;
  deniedToday: number;
  errorsToday: number;
  logoutsToday: number;
  verifyFailsToday: number;
  bufferUsed: number;
  bufferMax: number;
  uptimeSeconds: number;
}

export interface EventFilter {
  type?: EventType;
  limit?: number;
  offset?: number;
}

const DEFAULT_MAX_SIZE = 500;

class EventLogger {
  private buffer: LogEvent[];
  private head = 0;
  private count = 0;
  private sequence = 0;
  private readonly maxSize: number;
  private readonly startTime: number;

  constructor(maxSize = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
    this.startTime = Date.now();
  }

  log(type: EventType, opts?: { usosId?: string; ip?: string; detail?: string }): void {
    this.buffer[this.head] = {
      id: ++this.sequence,
      timestamp: new Date().toISOString(),
      type,
      usosId: opts?.usosId,
      ip: opts?.ip,
      detail: opts?.detail,
    };
    this.head = (this.head + 1) % this.maxSize;
    if (this.count < this.maxSize) this.count++;
  }

  getEvents(filter?: EventFilter): LogEvent[] {
    const limit = Math.min(filter?.limit ?? 50, 200);
    const offset = filter?.offset ?? 0;

    const events: LogEvent[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - 1 - i + this.maxSize) % this.maxSize;
      const event = this.buffer[idx];
      if (event && (!filter?.type || event.type === filter.type)) {
        events.push(event);
      }
    }

    return events.slice(offset, offset + limit);
  }

  getStats(): EventStats {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    let loginsToday = 0, loginsTotal = 0, deniedToday = 0;
    let errorsToday = 0, logoutsToday = 0, verifyFailsToday = 0;

    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - 1 - i + this.maxSize) % this.maxSize;
      const event = this.buffer[idx];
      if (!event) continue;

      const isToday = event.timestamp >= todayIso;

      if (event.type === 'login_success') {
        loginsTotal++;
        if (isToday) loginsToday++;
      }
      if (isToday) {
        if (event.type === 'login_denied_faculty') deniedToday++;
        if (event.type === 'error') errorsToday++;
        if (event.type === 'logout') logoutsToday++;
        if (event.type === 'auth_verify_fail') verifyFailsToday++;
      }
    }

    return {
      loginsToday, loginsTotal, deniedToday, errorsToday,
      logoutsToday, verifyFailsToday,
      bufferUsed: this.count,
      bufferMax: this.maxSize,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

export const eventLogger = new EventLogger();
