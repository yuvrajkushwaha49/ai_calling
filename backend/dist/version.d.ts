export declare const APP_VERSION = "1.8.3";
export declare const GIT_COMMIT_SHA: string;
export declare const DEPLOYMENT_ID: string;
export declare const PROCESS_PID: number;
export declare function getVersionTelemetry(): {
    version: string;
    commitSha: string;
    deploymentId: string;
    processPid: number;
    uptimeSeconds: number;
    nodeVersion: string;
    environment: string;
};
