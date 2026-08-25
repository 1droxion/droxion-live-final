import fs from 'node:fs';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function readLines(path) {
  return fs.readFileSync(path, 'utf8').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
}

function distribute(total, shardIndex, shardCount) {
  const values = [];
  for (let index = shardIndex; index < total; index += shardCount) values.push(index);
  return values;
}

const roomsTarget = Number(option('rooms', 100));
const viewersTarget = Number(option('viewers', 10000));
const durationSeconds = Number(option('duration', 300));
const shardIndex = Number(option('shard-index', process.env.SHARD_INDEX || 0));
const shardCount = Number(option('shard-count', process.env.SHARD_COUNT || 1));
const roomFile = option('room-file', process.env.DROXION_LOAD_ROOM_FILE || '');
const tokenFile = option('token-file', process.env.DROXION_LOAD_TOKEN_FILE || '');
const url = process.env.DROXION_LOAD_SUPABASE_URL || '';
const anonKey = process.env.DROXION_LOAD_SUPABASE_ANON_KEY || '';
const approved = process.env.DROXION_LOAD_APPROVED === '1';
const productionApproved = process.env.DROXION_LOAD_ALLOW_PRODUCTION === '1';
const shardViewers = distribute(viewersTarget, shardIndex, shardCount);

console.log(JSON.stringify({ roomsTarget, viewersTarget, durationSeconds, shardIndex, shardCount, shardViewers: shardViewers.length }, null, 2));
if (!approved) {
  console.log('Dry run only. Set DROXION_LOAD_APPROVED=1 after founder approval to create connections.');
  process.exit(0);
}
if (/zlnhaqzawbzagraxhmlb\.supabase\.co/i.test(url) && !productionApproved) {
  throw new Error('Production target refused. Use an isolated load environment, or separately set DROXION_LOAD_ALLOW_PRODUCTION=1 after founder approval.');
}
if (!url || !anonKey || !roomFile || !tokenFile) throw new Error('Load URL, anon key, room file and token file are required.');

const rooms = readLines(roomFile).slice(0, roomsTarget);
const tokens = readLines(tokenFile);
if (rooms.length < roomsTarget) throw new Error(`Need ${roomsTarget} active test room UUIDs; received ${rooms.length}.`);
if (!tokens.length) throw new Error('At least one isolated test-user JWT is required.');

const resources = [];
const counters = { subscribed: 0, subscribeErrors: 0, reads: 0, readErrors: 0, realtimeEvents: 0 };
const runId = `${Date.now()}-${shardIndex}`;

async function connectViewer(globalIndex) {
  const roomId = rooms[globalIndex % rooms.length];
  const token = tokens[globalIndex % tokens.length];
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  client.realtime.setAuth(token);
  const channel = client
    .channel(`droxion-load-${runId}-${globalIndex}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'droxion_live_events', filter: `session_id=eq.${roomId}` }, () => { counters.realtimeEvents += 1; });

  await new Promise(resolve => {
    const timeout = setTimeout(() => { counters.subscribeErrors += 1; resolve(); }, 15000);
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') { clearTimeout(timeout); counters.subscribed += 1; resolve(); }
      if (['CHANNEL_ERROR', 'TIMED_OUT'].includes(status)) { clearTimeout(timeout); counters.subscribeErrors += 1; resolve(); }
    });
  });

  const read = async () => {
    const results = await Promise.all([
      client.rpc('droxion_live_room_status', { p_session_id: roomId }),
      client.rpc('droxion_live_chat_messages', { p_session_id: roomId, p_after_id: 0 }),
      client.rpc('droxion_live_gift_events', { p_session_id: roomId, p_after: new Date(Date.now() - 60000).toISOString() }),
    ]);
    counters.reads += results.length;
    counters.readErrors += results.filter(result => result.error).length;
  };
  await read();
  const safetyTimer = setInterval(() => read().catch(() => { counters.readErrors += 3; }), 300000 + Math.floor(Math.random() * 60000));
  resources.push({ client, channel, safetyTimer });
}

for (let offset = 0; offset < shardViewers.length; offset += 25) {
  await Promise.all(shardViewers.slice(offset, offset + 25).map(connectViewer));
  if (offset % 250 === 0) console.log(JSON.stringify(counters));
}

await new Promise(resolve => setTimeout(resolve, durationSeconds * 1000));
await Promise.all(resources.map(async ({ client, channel, safetyTimer }) => {
  clearInterval(safetyTimer);
  await client.removeChannel(channel).catch(() => {});
}));
console.log(JSON.stringify({ complete: true, ...counters }, null, 2));

export { distribute };
