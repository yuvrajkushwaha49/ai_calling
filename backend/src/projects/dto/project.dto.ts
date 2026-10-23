import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType } from '@prisma/client';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  builder: string;

  @IsEnum(PropertyType)
  propertyType: PropertyType;

  @Type(() => Number)
  @IsNumber()
  startingPrice: number;

  @Type(() => Number)
  @IsNumber()
  endingPrice: number;

  @IsOptional()
  @IsDateString()
  possessionDate?: string;

  @IsOptional()
  @IsString()
  reraNumber?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  builder?: string;

  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  startingPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  endingPrice?: number;

  @IsOptional()
  @IsDateString()
  possessionDate?: string;

  @IsOptional()
  @IsString()
  reraNumber?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  websiteUrl?: string;
}
