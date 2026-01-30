import { IsArray, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AnalyzeFeedDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MessageDto)
    messages: MessageDto[];

    @IsInt()
    @IsNotEmpty()
    time_window_minutes: number;
}

export class MessageDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(280)
    content: string;

    @IsString()
    @IsNotEmpty()
    timestamp: string;

    @IsString()
    @IsNotEmpty()
    @Matches(/^user_[\p{L}0-9_]{3,}$/iu, { message: 'user_id invalid format' })
    user_id: string;

    @IsArray()
    @IsString({ each: true })
    hashtags: string[];

    @IsInt()
    @IsOptional()
    reactions: number = 0;

    @IsInt()
    @IsOptional()
    shares: number = 0;

    @IsInt()
    @IsOptional()
    views: number = 0;
}
