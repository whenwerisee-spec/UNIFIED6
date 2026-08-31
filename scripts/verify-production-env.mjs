#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import process from 'process';

const cwd = process.cwd();
const credentialsEnvPath = (process.env.SOVEREIGN_CREDENTIALS_FILE || path.join(cwd, 'config', '.env.credentials')).trim();
const envFiles = [
  path.join(cwd, '.env'),
  path.join(cwd, '.env.local'),
  path.join(cwd, '.env.production'),
  path.join(cwd, '.env.production.local'),
  credentialsEnvPath
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const entries = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    entries[key] = value;
  }
  return entries;
}

const loadedEnv = {};
for (const filePath of envFiles) {
  Object.assign(loadedEnv, parseEnvFile(filePath));
}

function getValue(name) {
  if (typeof process.env[name] === 'string' && process.env[name].trim()) {
    return process.env[name].trim();
  }
  if (typeof loadedEnv[name] === 'string' && loadedEnv[name].trim()) {
    return loadedEnv[name].trim();
  }

  const workspaceFileMap = {
    SOVEREIGN_ENCRYPTION_KEY: 'sovereign_encryption_key.txt',
    JWT_SECRET: 'jwt_secret.txt'
  };
  const fallbackFile = workspaceFileMap[name];
  if (fallbackFile) {
    const filePath = path.join(cwd, fallbackFile);
    if (fs.existsSync(filePath)) {
      const value = fs.readFileSync(filePath, 'utf8').trim();
      if (value) return value;
    }
  }

  return '';
}

const isProduction = (process.env.NODE_ENV || loadedEnv.NODE_ENV || '').trim() === 'production';

if (!isProduction) {
  console.log('Production environment validation skipped because NODE_ENV is not set to production.');
  process.exit(0);
}

const requiredChecks = [
  { name: 'SOVEREIGN_ENCRYPTION_KEY', minLength: 32 },
  { name: 'JWT_SECRET', minLength: 32 },
  { name: 'SOVEREIGN_ADMIN_EMAILS', minLength: 3 },
  { name: 'COINBASE_API_KEY_ID', minLength: 8 },
  { name: 'COINBASE_API_SECRET_RAW', minLength: 8 },
  { name: 'MARSHALL_WALLET_PRIVATE_KEY', minLength: 32 }
];

const errors = [];
for (const check of requiredChecks) {
  const value = getValue(check.name);
  if (value.trim().length < check.minLength) {
    errors.push(`${check.name} must be set to a value with at least ${check.minLength} characters.`);
  }
}

if (errors.length > 0) {
  console.error('Production environment validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Production environment validation passed.');
