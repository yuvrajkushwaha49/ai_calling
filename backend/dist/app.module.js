"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const prisma_module_1 = require("./prisma/prisma.module");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const leads_module_1 = require("./leads/leads.module");
const projects_module_1 = require("./projects/projects.module");
const calls_module_1 = require("./calls/calls.module");
const appointments_module_1 = require("./appointments/appointments.module");
const ai_module_1 = require("./ai/ai.module");
const analytics_module_1 = require("./analytics/analytics.module");
const audit_module_1 = require("./audit/audit.module");
const llm_module_1 = require("./llm/llm.module");
const knowledge_module_1 = require("./knowledge/knowledge.module");
const conversation_module_1 = require("./conversation/conversation.module");
const campaigns_module_1 = require("./campaigns/campaigns.module");
const feedback_module_1 = require("./feedback/feedback.module");
const jwt_auth_guard_1 = require("./auth/guards/jwt-auth.guard");
const roles_guard_1 = require("./common/guards/roles.guard");
const global_exception_filter_1 = require("./common/filters/global-exception.filter");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            prisma_module_1.PrismaModule,
            audit_module_1.AuditModule,
            llm_module_1.LlmModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            leads_module_1.LeadsModule,
            projects_module_1.ProjectsModule,
            knowledge_module_1.KnowledgeModule,
            conversation_module_1.ConversationModule,
            calls_module_1.CallsModule,
            campaigns_module_1.CampaignsModule,
            feedback_module_1.FeedbackModule,
            appointments_module_1.AppointmentsModule,
            ai_module_1.AiModule,
            analytics_module_1.AnalyticsModule,
        ],
        providers: [
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: roles_guard_1.RolesGuard },
            { provide: core_1.APP_FILTER, useClass: global_exception_filter_1.GlobalExceptionFilter },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map