import { describe, it, expect } from "vitest";
import { encryptApiKey, decryptApiKey, getKeyPrefix } from "@/lib/encryption";

describe("encryptApiKey / decryptApiKey", () => {
  it("round-trips a short API key", () => {
    const key = "sk-test-1234567890";
    const encrypted = encryptApiKey(key);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(key);
  });

  it("round-trips a long API key", () => {
    const key = "sk-ant-api03-" + "a".repeat(100);
    const encrypted = encryptApiKey(key);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(key);
  });

  it("produces different ciphertext for same input (random IV)", () => {
    const key = "sk-test-1234567890";
    const enc1 = encryptApiKey(key);
    const enc2 = encryptApiKey(key);
    expect(enc1).not.toBe(enc2);
  });

  it("encrypted format has three colon-separated parts", () => {
    const encrypted = encryptApiKey("test");
    const parts = encrypted.split(":");
    expect(parts.length).toBe(3);
  });

  it("IV is 32 hex chars (16 bytes)", () => {
    const encrypted = encryptApiKey("test");
    const iv = encrypted.split(":")[0];
    expect(iv.length).toBe(32);
  });

  it("auth tag is 32 hex chars (16 bytes)", () => {
    const encrypted = encryptApiKey("test");
    const authTag = encrypted.split(":")[1];
    expect(authTag.length).toBe(32);
  });

  it("detects tampering (modified ciphertext)", () => {
    const encrypted = encryptApiKey("test");
    const parts = encrypted.split(":");
    // Tamper with the encrypted part
    parts[2] = "0".repeat(parts[2].length);
    const tampered = parts.join(":");

    expect(() => decryptApiKey(tampered)).toThrow();
  });

  it("detects tampering (modified auth tag)", () => {
    const encrypted = encryptApiKey("test");
    const parts = encrypted.split(":");
    parts[1] = "0".repeat(32);
    const tampered = parts.join(":");

    expect(() => decryptApiKey(tampered)).toThrow();
  });

  it("handles special characters", () => {
    const key = "sk-test/with+special=chars&more!";
    const encrypted = encryptApiKey(key);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(key);
  });

  it("handles unicode characters", () => {
    const key = "sk-test-émojis-🔑";
    const encrypted = encryptApiKey(key);
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe(key);
  });

  it("handles empty string", () => {
    const encrypted = encryptApiKey("");
    const decrypted = decryptApiKey(encrypted);
    expect(decrypted).toBe("");
  });
});

describe("getKeyPrefix", () => {
  it("masks long keys with first 4 and last 4 chars", () => {
    expect(getKeyPrefix("sk-test-1234567890")).toBe("sk-t...7890");
  });

  it("masks 8-char keys with first 2 chars (length <= 8 branch)", () => {
    // Keys with length <= 8 use substring(0, 2) + "..."
    expect(getKeyPrefix("abcd1234")).toBe("ab...");
  });

  it("masks very short keys", () => {
    expect(getKeyPrefix("abc")).toBe("ab...");
  });

  it("masks 9+ char keys with first 4 and last 4", () => {
    expect(getKeyPrefix("123456789")).toBe("1234...6789");
  });
});
