import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHello(): string;
    getVersion(): {
        version: string;
        commitSha: string;
        deploymentId: string;
        processPid: number;
        uptimeSeconds: number;
        nodeVersion: string;
        environment: string;
    };
}
