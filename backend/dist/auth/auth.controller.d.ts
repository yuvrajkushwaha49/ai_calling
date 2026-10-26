import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, ForgotPasswordDto } from './dto/auth.dto';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
        };
    }>;
    register(dto: RegisterDto): Promise<{
        accessToken: string;
        user: {
            id: string;
            email: string;
            name: string;
            role: string;
        };
    }>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    getProfile(userId: string): Promise<{
        email: string;
        name: string;
        id: string;
        role: import("@prisma/client").$Enums.UserRole;
        createdAt: Date;
    } | null>;
}
