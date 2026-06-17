import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ApplyStoreDto {
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  gstin?: string;
}
