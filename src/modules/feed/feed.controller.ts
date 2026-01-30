import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { FeedService } from './feed.service';
import { AnalyzeFeedDto } from './dto/analyze-feed.dto';

@Controller('analyze-feed')
export class FeedController {
    constructor(private readonly feedService: FeedService) { }

    @Post()
    @HttpCode(200)
    async analyze(@Body() dto: AnalyzeFeedDto) {
        return this.feedService.analyze(dto);
    }
}
