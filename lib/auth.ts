import "server-only"

import crypto from "crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(crypto.scrypt)

export const hashPassword = async (password: string) => {
  const salt = crypto.randomBytes(16).toString("hex")
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  return `scrypt$${salt}$${derivedKey.toString("hex")}`
}

export const verifyPassword = async (password: string, storedHash: string) => {
  const [method, salt, hash] = storedHash.split("$")
  if (method !== "scrypt" || !salt || !hash) {
    return false
  }
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer
  const storedKey = Buffer.from(hash, "hex")
  if (storedKey.length !== derivedKey.length) {
    return false
  }
  return crypto.timingSafeEqual(storedKey, derivedKey)
}
