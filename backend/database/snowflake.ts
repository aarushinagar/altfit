/**
 * Snowflake ID Generator
 *
 * Generates 64-bit distributed IDs suitable for distributed systems.
 * Format: [timestamp (42 bits) | workerId (10 bits) | sequence (12 bits)]
 *
 * Properties:
 * - Sortable by timestamp
 * - Unique within a datacenter/process
 * - Non-sequential but time-ordered
 */

const EPOCH = 1704067200000; // 2024-01-01 00:00:00 UTC
const WORKER_ID = BigInt(process.env.WORKER_ID || "1");
const DATA_CENTER_ID = BigInt(process.env.DATA_CENTER_ID || "1");

let sequence = 0n;
let lastTimestamp = 0n;

const TIMESTAMP_BITS = 42n;
const DATA_CENTER_BITS = 5n;
const WORKER_BITS = 5n;
const SEQUENCE_BITS = 12n;

const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n;
const MAX_DATA_CENTER_ID = (1n << DATA_CENTER_BITS) - 1n;
const MAX_WORKER_ID = (1n << WORKER_BITS) - 1n;

if (DATA_CENTER_ID > MAX_DATA_CENTER_ID) {
  throw new Error(
    `DATA_CENTER_ID must be less than ${MAX_DATA_CENTER_ID + 1n}`,
  );
}

if (WORKER_ID > MAX_WORKER_ID) {
  throw new Error(`WORKER_ID must be less than ${MAX_WORKER_ID + 1n}`);
}

/**
 * Generates a new Snowflake ID
 */
export function generateSnowflakeId(): bigint {
  let timestamp = BigInt(Date.now() - EPOCH);

  if (timestamp === lastTimestamp) {
    sequence = (sequence + 1n) & MAX_SEQUENCE;
    if (sequence === 0n) {
      // Sequence overflowed, wait until next millisecond
      while (timestamp <= lastTimestamp) {
        timestamp = BigInt(Date.now() - EPOCH);
      }
    }
  } else {
    sequence = 0n;
  }

  lastTimestamp = timestamp;

  const id =
    (timestamp << (DATA_CENTER_BITS + WORKER_BITS + SEQUENCE_BITS)) |
    (DATA_CENTER_ID << (WORKER_BITS + SEQUENCE_BITS)) |
    (WORKER_ID << SEQUENCE_BITS) |
    sequence;

  return id;
}

/**
 * Parses a Snowflake ID to extract its components
 */
export function parseSnowflakeId(id: string) {
  const bigId = BigInt(id);

  const sequence = Number(bigId & MAX_SEQUENCE);
  const workerId = Number((bigId >> SEQUENCE_BITS) & MAX_WORKER_ID);
  const dataCenterId = Number(
    (bigId >> (WORKER_BITS + SEQUENCE_BITS)) & MAX_DATA_CENTER_ID,
  );
  const timestamp =
    Number(bigId >> (DATA_CENTER_BITS + WORKER_BITS + SEQUENCE_BITS)) + EPOCH;

  return {
    timestamp: new Date(timestamp),
    dataCenterId,
    workerId,
    sequence,
  };
}
