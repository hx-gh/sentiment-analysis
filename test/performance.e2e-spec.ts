import { Test, TestingModule } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import * as fs from 'fs';
import * as path from 'path';

describe('Performance (e2e)', () => {
    let app: NestExpressApplication;
    let payload: any;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication<NestExpressApplication>();
        app.useBodyParser('json', { limit: '10mb' });
        app.useGlobalPipes(new ValidationPipe());
        await app.init();

        // Load payload
        const payloadPath = path.join(__dirname, '../examples/performance-1k.json');
        payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

        // Update timestamps to be fresh so they aren't filtered out
        const now = new Date();
        payload.messages.forEach(m => m.timestamp = now.toISOString());
    });

    afterAll(async () => {
        await app.close();
    });

    it('should process 1000 messages in < 200ms', async () => {
        const res = await request(app.getHttpServer())
            .post('/analyze-feed')
            .send(payload);

        if (res.status !== 200) {
            console.log(JSON.stringify(res.body, null, 2));
        }

        expect(res.status).toBe(200);

        const time = res.body.analysis.processing_time_ms;
        console.log(`Processing Time for 1000 messages: ${time}ms`);
        expect(time).toBeLessThan(200);
    });
});
