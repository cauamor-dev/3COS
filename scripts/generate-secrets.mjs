import { randomBytes } from "node:crypto";

const secret = (bytes) => randomBytes(bytes).toString("base64url");

console.log(`API_KEY=c3c_${secret(32)}`);
console.log(`MCP_SECRET=${secret(32)}`);
console.log(`CRON_SECRET=${secret(32)}`);
