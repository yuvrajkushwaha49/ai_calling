/**
 * Workains Reality CRM - Build & Deployment Version Metadata
 * Exposes immutable build and runtime identifiers for call session telemetry.
 */
import { execSync } from 'child_process';

let cachedGitSha: string | null = null;

function resolveGitCommitSha(): string {
  if (process.env.GIT_COMMIT_SHA) {
    return process.env.GIT_COMMIT_SHA;
  }
  if (cachedGitSha) {
    return cachedGitSha;
  }
  try {
    const sha = execSync('git rev-parse --short HEAD', { timeout: 1000, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (sha) {
      cachedGitSha = sha;
      return sha;
    }
  } catch {
    // ignore
  }
  cachedGitSha = 'e5399cc'; // Fallback to current Round 6 commit baseline
  return cachedGitSha;
}

export const APP_VERSION = '1.8.2';
export const GIT_COMMIT_SHA = resolveGitCommitSha();
export const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID || 'workains-prod-round8.2';
export const PROCESS_PID = process.pid;

export function getVersionTelemetry() {
  return {
    version: APP_VERSION,
    commitSha: GIT_COMMIT_SHA,
    deploymentId: DEPLOYMENT_ID,
    processPid: PROCESS_PID,
    uptimeSeconds: Math.round(process.uptime()),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV || 'production',
  };
}

