import fs from 'fs';
import path from 'path';

export type EventType =
  | 'login_success'
  | 'login_denied_faculty'
  | 'logout'
  | 'resource_access'
  | 'error';

export interface LogEvent {
  id: number;
  timestamp: string;
  type: EventType;
  usosId?: string;
  detail?: string;
}

export interface EventStats {
  loginsTotal: number;
  resourcesTotal: number;
  deniedTotal: number;
  errorsTotal: number;
  bufferUsed: number;
  bufferMax: number;
  uptimeSeconds: number;
}

export interface EventFilter {
  type?: EventType;
  limit?: number;
  offset?: number;
}

export interface ActivityBucket {
  time: string;
  users: number;
}

const DEFAULT_MAX_SIZE = 500;
const BUCKET_MS = 5 * 60 * 1000;
const PERSIST_INTERVAL = 60 * 1000;
const DATA_DIR = process.env.DATA_DIR || '/app/data';
const PERSIST_PATH = path.join(DATA_DIR, 'events.json');

interface PersistedState {
  buffer: (LogEvent | null)[];
  head: number;
  count: number;
  sequence: number;
}

class EventLogger {
  private buffer: (LogEvent | null)[];
  private head = 0;
  private count = 0;
  private sequence = 0;
  private readonly maxSize: number;
  private readonly startTime: number;
  private persistTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxSize = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize).fill(null);
    this.startTime = Date.now();
    this.load();
    this.persistTimer = setInterval(() => this.save(), PERSIST_INTERVAL);
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private load(): void {
    try {
      if (!fs.existsSync(PERSIST_PATH)) return;
      const raw = fs.readFileSync(PERSIST_PATH, 'utf-8');
      const state: PersistedState = JSON.parse(raw);
      if (!Array.isArray(state.buffer) || state.buffer.length !== this.maxSize) return;
      this.buffer = state.buffer;
      this.head = state.head;
      this.count = state.count;
      this.sequence = state.sequence;
      console.log(`Loaded ${this.count} events from disk`);
    } catch {
      console.error('Failed to load persisted events, starting fresh');
    }
  }

  save(): void {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const state: PersistedState = {
        buffer: this.buffer,
        head: this.head,
        count: this.count,
        sequence: this.sequence,
      };
      fs.writeFileSync(PERSIST_PATH, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to persist events:', err);
    }
  }

  private shutdown(): void {
    this.save();
    if (this.persistTimer) clearInterval(this.persistTimer);
    process.exit(0);
  }

  log(type: EventType, opts?: { usosId?: string; detail?: string }): void {
    this.buffer[this.head] = {
      id: ++this.sequence,
      timestamp: new Date().toISOString(),
      type,
      usosId: opts?.usosId,
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
    let loginsTotal = 0, resourcesTotal = 0, deniedTotal = 0, errorsTotal = 0;

    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - 1 - i + this.maxSize) % this.maxSize;
      const event = this.buffer[idx];
      if (!event) continue;

      if (event.type === 'login_success') loginsTotal++;
      if (event.type === 'resource_access') resourcesTotal++;
      if (event.type === 'login_denied_faculty') deniedTotal++;
      if (event.type === 'error') errorsTotal++;
    }

    return {
      loginsTotal, resourcesTotal, deniedTotal, errorsTotal,
      bufferUsed: this.count,
      bufferMax: this.maxSize,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  getActivity(hours = 6): ActivityBucket[] {
    const now = Date.now();
    const start = now - hours * 60 * 60 * 1000;
    const bucketCount = Math.ceil((hours * 60 * 60 * 1000) / BUCKET_MS);
    const buckets: Set<string>[] = [];
    for (let i = 0; i < bucketCount; i++) buckets.push(new Set());

    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - 1 - i + this.maxSize) % this.maxSize;
      const event = this.buffer[idx];
      if (!event || !event.usosId) continue;

      const ts = new Date(event.timestamp).getTime();
      if (ts < start) continue;

      const bucketIdx = Math.floor((ts - start) / BUCKET_MS);
      if (bucketIdx >= 0 && bucketIdx < bucketCount) {
        buckets[bucketIdx].add(event.usosId);
      }
    }

    return buckets.map((users, i) => ({
      time: new Date(start + i * BUCKET_MS).toISOString(),
      users: users.size,
    }));
  }
}

export const eventLogger = new EventLogger();
