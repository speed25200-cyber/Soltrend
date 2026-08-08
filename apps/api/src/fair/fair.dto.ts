import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator';

const TEMPLATES = ['dice', 'limbo', 'coinflip', 'wheel', 'plinko', 'mines'] as const;

export class ClientSeedDto {
  @IsString() sessionId!: string;
  @IsString() clientSeed!: string;
}

export class RotateDto {
  @IsString() sessionId!: string;
}

export class VerifyDto {
  @IsString() serverSeed!: string;
  @IsString() clientSeed!: string;
  @IsInt() @Min(1) nonce!: number;
  @IsIn(TEMPLATES) template!: (typeof TEMPLATES)[number];
  @IsOptional() @IsNumber() @Min(0) bet?: number;
  @IsOptional() @IsNumber() edge?: number;
  @IsOptional() @IsObject() params?: Record<string, any>;
  @IsOptional() @IsString() expectedHash?: string;
}
