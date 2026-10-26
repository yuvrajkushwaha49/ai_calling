import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        email: string;
        name: string;
        id: string;
        role: import("@prisma/client").$Enums.UserRole;
        createdAt: Date;
    }[]>;
    findOne(id: string): Promise<{
        email: string;
        name: string;
        id: string;
        role: import("@prisma/client").$Enums.UserRole;
        createdAt: Date;
    }>;
    update(id: string, dto: UpdateUserDto): Promise<{
        email: string;
        name: string;
        id: string;
        role: import("@prisma/client").$Enums.UserRole;
    }>;
}
