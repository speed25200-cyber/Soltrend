import { IsNumber, IsOptional, IsString } from 'class-validator';

export class SetLimitsDto {
  @IsString() sessionId!: string;
  @IsOptional() @IsNumber() maxBet?: number;
  @IsOptional() @IsNumber() dailyLossLimit?: number;
  @IsOptional() @IsNumber() selfExcludedUntil?: number;
}
