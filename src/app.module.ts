import { Module } from '@nestjs/common';

import { FeedModule } from './modules/feed/feed.module';

@Module({
  imports: [FeedModule],
  controllers: [],
  providers: [],
})
export class AppModule { }
