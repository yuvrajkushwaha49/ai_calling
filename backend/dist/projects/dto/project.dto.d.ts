import { PropertyType } from '@prisma/client';
export declare class CreateProjectDto {
    name: string;
    companyName?: string;
    location: string;
    builder: string;
    propertyType: PropertyType;
    startingPrice: number;
    endingPrice: number;
    possessionDate?: string;
    reraNumber?: string;
    amenities?: string[];
    description?: string;
    websiteUrl?: string;
}
export declare class UpdateProjectDto {
    name?: string;
    companyName?: string;
    location?: string;
    builder?: string;
    propertyType?: PropertyType;
    startingPrice?: number;
    endingPrice?: number;
    possessionDate?: string;
    reraNumber?: string;
    amenities?: string[];
    description?: string;
    websiteUrl?: string;
}
