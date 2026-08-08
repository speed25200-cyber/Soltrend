import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const TEMPLATES = ['dice', 'limbo', 'coinflip', 'wheel', 'plinko', 'mines'] as const;

export class SettleDto {
  @IsString() sessionId!: string;
  @IsString() player!: string;
  @IsString() gameId!: string;
  @IsNumber() @Min(0.0000001) bet!: number;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsObject() params?: Record<string, any>;
}

export class ThemeDto {
  @IsString() accent!: string;
  @IsString() icon!: string;
}

export class RegisterGameDto {
  @IsString() creator!: string;
  @IsIn(TEMPLATES) template!: (typeof TEMPLATES)[number];
  @IsString() name!: string;
  @IsNumber() edge!: number;
  @IsOptional() @IsObject() params?: Record<string, any>;
  @ValidateNested() @Type(() => ThemeDto) theme!: ThemeDto;
}
