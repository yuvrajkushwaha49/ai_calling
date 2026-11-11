"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryModule = void 0;
const common_1 = require("@nestjs/common");
const customer_memory_service_1 = require("./customer-memory.service");
const fact_extractor_service_1 = require("./fact-extractor.service");
const question_validator_service_1 = require("./question-validator.service");
const prisma_module_1 = require("../prisma/prisma.module");
const redis_module_1 = require("../redis/redis.module");
let MemoryModule = class MemoryModule {
};
exports.MemoryModule = MemoryModule;
exports.MemoryModule = MemoryModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, redis_module_1.RedisModule],
        providers: [
            customer_memory_service_1.CustomerMemoryService,
            fact_extractor_service_1.FactExtractorService,
            question_validator_service_1.QuestionValidatorService,
        ],
        exports: [
            customer_memory_service_1.CustomerMemoryService,
            fact_extractor_service_1.FactExtractorService,
            question_validator_service_1.QuestionValidatorService,
        ],
    })
], MemoryModule);
//# sourceMappingURL=memory.module.js.map