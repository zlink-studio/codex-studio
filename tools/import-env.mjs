import crypto from "node:crypto";
import fs from "node:fs";
import readline from "node:readline";

const inPath = process.argv[2] ?? ".env.local.enc";
const outPath = process.argv[3] ?? ".env.local";
const force = process.argv.includes("--force");

if (!fs.existsSync(inPath)) {
  throw new Error(`Encrypted env file not found: ${inPath}`);
}
if (fs.existsSync(outPath) && !force) {
  throw new Error(`${outPath} already exists. Re-run with --force to overwrite.`);
}

async function readSecret(prompt) {
  if (!process.stdin.isTTY) {
    throw new Error("Interactive terminal required for password input.");
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdout.write(prompt);

  let value = "";
  return await new Promise((resolve, reject) => {
    const onKeypress = (str, key) => {
      if (key?.name === "return") {
        process.stdin.setRawMode(false);
        process.stdin.off("keypress", onKeypress);
        process.stdout.write("\n");
        resolve(value);
        return;
      }
      if (key?.name === "backspace") {
        value = value.slice(0, -1);
        return;
      }
      if (key?.ctrl && key?.name === "c") {
        process.stdin.setRawMode(false);
        process.stdin.off("keypress", onKeypress);
        reject(new Error("Cancelled."));
        return;
      }
      if (str && !key?.ctrl && !key?.meta) {
        value += str;
      }
    };

    process.stdin.on("keypress", onKeypress);
  });
}

const payload = JSON.parse(fs.readFileSync(inPath, "utf8"));
if (payload.version !== 1) {
  throw new Error(`Unsupported encrypted env version: ${payload.version}`);
}

const salt = Buffer.from(payload.salt, "base64");
const iv = Buffer.from(payload.iv, "base64");
const expectedTag = Buffer.from(payload.tag, "base64");
const cipherBytes = Buffer.from(payload.ciphertext, "base64");
const iterations = Number(payload.iterations);

const passphrase = await readSecret("Encryption password: ");
const keyMaterial = crypto.pbkdf2Sync(passphrase, salt, iterations, 64, "sha256");
const encKey = keyMaterial.subarray(0, 32);
const macKey = keyMaterial.subarray(32, 64);

const actualTag = crypto
  .createHmac("sha256", macKey)
  .update(Buffer.concat([salt, iv, cipherBytes]))
  .digest();

if (
  expectedTag.length !== actualTag.length ||
  !crypto.timingSafeEqual(expectedTag, actualTag)
) {
  throw new Error("Invalid password or corrupted encrypted env file.");
}

const decipher = crypto.createDecipheriv("aes-256-cbc", encKey, iv);
const plainText = Buffer.concat([
  decipher.update(cipherBytes),
  decipher.final()
]).toString("utf8");

fs.writeFileSync(outPath, plainText, "utf8");
console.log(`Decrypted ${inPath} -> ${outPath}`);
