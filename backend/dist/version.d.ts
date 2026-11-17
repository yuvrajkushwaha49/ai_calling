export declare const APP_VERSION = "1.7.0";
export declare const GIT_COMMIT_SHA: string;
export declare const DEPLOYMENT_ID: string;
export declare const PROCESS_PID: number;
export declare function getVersionTelemetry(): {
    version: string;
    commitSha: string;
    deploymentId: string;
    processPid: number;
};
