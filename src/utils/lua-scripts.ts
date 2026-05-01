export const RATE_LIMIT_SCRIPT: string = `
redis.call("ZREMRANGEBYSCORE", KEYS[1], 0, ARGV[2])
redis.call("ZADD", KEYS[1], ARGV[1], ARGV[1])
local count = redis.call("ZCARD", KEYS[1])
redis.call("EXPIRE", KEYS[1], ARGV[3])
return count
`;

export const BOOK_SLOT_SCRIPT: string = `
local current = redis.call("GET", KEYS[1])
if current == false then return -2 end
if tonumber(current) <= 0 then return -1 end
return redis.call("DECR", KEYS[1])
`;

export const RELEASE_SLOT_SCRIPT: string = `
return redis.call("INCR", KEYS[1])
`;

export const RELEASE_LOCK_SCRIPT: string = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;
