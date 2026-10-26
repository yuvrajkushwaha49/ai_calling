"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const class_validator_1 = require("class-validator");
const knowledge_service_1 = require("./knowledge.service");
const auth_decorators_1 = require("../common/decorators/auth.decorators");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
class AddWebsiteDto {
    projectId;
    url;
    title;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddWebsiteDto.prototype, "projectId", void 0);
__decorate([
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], AddWebsiteDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddWebsiteDto.prototype, "title", void 0);
class AddTextDto {
    projectId;
    title;
    text;
    sourceType;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddTextDto.prototype, "projectId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddTextDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddTextDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddTextDto.prototype, "sourceType", void 0);
let KnowledgeController = class KnowledgeController {
    knowledge;
    constructor(knowledge) {
        this.knowledge = knowledge;
    }
    list(projectId) {
        return this.knowledge.listByProject(projectId);
    }
    get(id) {
        return this.knowledge.getSource(id);
    }
    addWebsite(dto, userId) {
        return this.knowledge.addWebsite({ ...dto, actorId: userId });
    }
    addText(dto, userId) {
        return this.knowledge.addTextDocument({ ...dto, actorId: userId });
    }
    upload(file, projectId, title, sourceType, userId) {
        return this.knowledge.uploadFile({
            projectId,
            file,
            title,
            sourceType,
            actorId: userId,
        });
    }
    reprocess(id, userId) {
        return this.knowledge.reprocess(id, userId);
    }
    remove(id, userId) {
        return this.knowledge.remove(id, userId);
    }
};
exports.KnowledgeController = KnowledgeController;
__decorate([
    (0, common_1.Get)('project/:projectId'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('website'),
    (0, auth_decorators_1.Roles)(client_1.UserRole.ADMIN, client_1.UserRole.MANAGER, client_1.UserRole.AGENT),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AddWebsiteDto, String]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "addWebsite", null);
__decorate([
    (0, common_1.Post)('text'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AddTextDto, String]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "addText", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)('projectId')),
    __param(2, (0, common_1.Body)('title')),
    __param(3, (0, common_1.Body)('sourceType')),
    __param(4, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, Object, String]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)(':id/reprocess'),
    (0, auth_decorators_1.Roles)(client_1.UserRole.ADMIN, client_1.UserRole.MANAGER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "reprocess", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, auth_decorators_1.Roles)(client_1.UserRole.ADMIN, client_1.UserRole.MANAGER),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)('sub')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], KnowledgeController.prototype, "remove", null);
exports.KnowledgeController = KnowledgeController = __decorate([
    (0, common_1.Controller)('knowledge'),
    __metadata("design:paramtypes", [knowledge_service_1.KnowledgeService])
], KnowledgeController);
//# sourceMappingURL=knowledge.controller.js.map