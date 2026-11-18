"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROCESS_PID = exports.DEPLOYMENT_ID = exports.GIT_COMMIT_SHA = exports.APP_VERSION = void 0;
exports.getVersionTelemetry = getVersionTelemetry;
const child_process_1 = require("child_process");
let cachedGitSha = null;
function resolveGitCommitSha() {
    if (process.env.GIT_COMMIT_SHA) {
        return process.env.GIT_COMMIT_SHA;
    }
    if (cachedGitSha) {
        return cachedGitSha;
    }
    try {
        const sha = (0, child_process_1.execSync)('git rev-parse --short HEAD', { timeout: 1000, stdio: ['ignore', 'pipe', 'ignore'] })
            .toString()
            .trim();
        if (sha) {
            cachedGitSha = sha;
            return sha;
        }
    }
    catch {
    }
    cachedGitSha = 'e5399cc';
    return cachedGitSha;
}
exports.APP_VERSION = '1.8.3';
exports.GIT_COMMIT_SHA = resolveGitCommitSha();
exports.DEPLOYMENT_ID = process.env.DEPLOYMENT_ID || 'workains-prod-round8.3';
exports.PROCESS_PID = process.pid;
function getVersionTelemetry() {
    return {
        version: exports.APP_VERSION,
        commitSha: exports.GIT_COMMIT_SHA,
        deploymentId: exports.DEPLOYMENT_ID,
        processPid: exports.PROCESS_PID,
        uptimeSeconds: Math.round(process.uptime()),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'production',
    };
}
//# sourceMappingURL=version.js.map