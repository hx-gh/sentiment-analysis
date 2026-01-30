import { Module } from '@nestjs/common';
import { InfluenceService } from './influence.service';

@Module({
    providers: [InfluenceService],
    exports: [InfluenceService],
})
export class InfluenceModule { }
