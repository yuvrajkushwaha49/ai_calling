"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallsModule = void 0;
const common_1 = require("@nestjs/common");
const calls_service_1 = require("./calls.service");
const calls_controller_1 = require("./calls.controller");
const exotel_service_1 = require("./exotel.service");
const exotel_stream_service_1 = require("./exotel-stream.service");
const twilio_service_1 = require("./twilio.service");
const twilio_stream_service_1 = require("./twilio-stream.service");
const mcube_service_1 = require("./mcube.service");
const mcube_stream_service_1 = require("./mcube-stream.service");
const ai_module_1 = require("../ai/ai.module");
const voice_module_1 = require("../voice/voice.module");
const conversation_module_1 = require("../conversation/conversation.module");
const appointments_module_1 = require("../appointments/appointments.module");
let CallsModule = class CallsModule {
};
exports.CallsModule = CallsModule;
exports.CallsModule = CallsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            ai_module_1.AiModule,
            voice_module_1.VoiceModule,
            conversation_module_1.ConversationModule,
            appointments_module_1.AppointmentsModule,
        ],
        controllers: [calls_controller_1.CallsController],
        providers: [
            calls_service_1.CallsService,
            twilio_service_1.TwilioService,
            twilio_stream_service_1.TwilioStreamService,
            exotel_service_1.ExotelService,
            exotel_stream_service_1.ExotelStreamService,
            mcube_service_1.McubeService,
            mcube_stream_service_1.McubeStreamService,
        ],
        exports: [
            calls_service_1.CallsService,
            twilio_service_1.TwilioService,
            twilio_stream_service_1.TwilioStreamService,
            exotel_service_1.ExotelService,
            exotel_stream_service_1.ExotelStreamService,
            mcube_service_1.McubeService,
            mcube_stream_service_1.McubeStreamService,
        ],
    })
], CallsModule);
//# sourceMappingURL=calls.module.js.map