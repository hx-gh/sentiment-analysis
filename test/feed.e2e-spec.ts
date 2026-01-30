import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('FeedController (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe());
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    // Casos redundantes removidos (cobertos por all-cases.e2e-spec.ts)
    // Mantendo apenas casos extras específicos deste arquivo

    it('/analyze-feed (POST) - Prime User (Influence 8191)', async () => {
        const payload = {
            messages: [{
                id: 'msg_prime',
                content: 'test',
                timestamp: new Date().toISOString(),
                user_id: 'user_math_prime',
                hashtags: [],
                reactions: 0,
                shares: 0,
                views: 10,
            }],
            time_window_minutes: 30,
        };

        const res = await request(app.getHttpServer())
            .post('/analyze-feed')
            .send(payload)
            .expect(200);

        const ranking = res.body.analysis.influence_ranking;
        const user = ranking.find(u => u.user_id === 'user_math_prime');
        // Score = (8191 * 0.4) + (0 * 0.6) = 3276.4
        expect(user.influence_score).toBeCloseTo(3276.4);
    });
});
