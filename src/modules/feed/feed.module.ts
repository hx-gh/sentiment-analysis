import { Module } from '@nestjs/common';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';
import { SentimentModule } from '../sentiment/sentiment.module';
import { InfluenceModule } from '../influence/influence.module';
import { TrendingService } from './trending.service';

@Module({
    imports: [SentimentModule, InfluenceModule],
    controllers: [FeedController],
    providers: [FeedService, TrendingService],
})
export class FeedModule { }
