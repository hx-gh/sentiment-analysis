import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('Final Verification (e2e)', () => {
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

    // Teste 1 — Básico
    it('Teste 1: Should detect positive sentiment and trending topics', async () => {
        const payload = {
            messages: [{
                id: 'msg_01',
                content: 'Adorei o produto! #lançamento',
                timestamp: new Date().toISOString(),
                user_id: 'user_123',
                hashtags: ['#lançamento'],
                reactions: 10,
                shares: 5,
                views: 100,
            }],
            time_window_minutes: 30,
        };

        const res = await request(app.getHttpServer())
            .post('/analyze-feed')
            .send(payload)
            .expect(200);

        expect(res.body.analysis.sentiment_distribution.positive).toBe(100);
        expect(res.body.analysis.trending_topics).toContain('#lançamento');
    });

    // Teste 2A — Erro de Janela
    it('Teste 2A: Should return 422 for time_window_minutes = 123', async () => {
        const payload = {
            messages: [],
            time_window_minutes: 123,
        };

        const res = await request(app.getHttpServer())
            .post('/analyze-feed')
            .send(payload)
            .expect(422);

        expect(res.body.code).toBe('UNSUPPORTED_TIME_WINDOW');
    });

    // Teste 2B — Flags Especiais
    it('Teste 2B: Should detect MBRAS employee and Candidate Awareness', async () => {
        const payload = {
            messages: [{
                id: 'msg_02',
                content: 'teste técnico mbras',
                timestamp: new Date().toISOString(),
                user_id: 'user_mbras_dev',
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

        const flags = res.body.analysis.flags;
        expect(flags.mbras_employee).toBe(true);
        expect(flags.candidate_awareness).toBe(true);
        expect(res.body.analysis.engagement_score).toBe(9.42);

        // Meta exclusion check: Should not count towards sentiment
        expect(res.body.analysis.sentiment_distribution.positive).toBe(0);
        expect(res.body.analysis.sentiment_distribution.neutral).toBe(0);
        expect(res.body.analysis.sentiment_distribution.negative).toBe(0);
    });

    // Teste 3A — Intensificador Órfão
    it('Teste 3A: Should return neutral for "muito" (Orphan Intensifier)', async () => {
        const payload = {
            messages: [{
                id: 'msg_03',
                content: 'muito',
                timestamp: new Date().toISOString(),
                user_id: 'user_test_x', // Fixed length
                hashtags: [],
                reactions: 0,
                shares: 0,
                views: 1,
            }],
            time_window_minutes: 30,
        };

        const res = await request(app.getHttpServer())
            .post('/analyze-feed')
            .send(payload)
            .expect(200);

        expect(res.body.analysis.sentiment_distribution.neutral).toBe(100);
    });

    // Teste 3B — Negação Dupla
    it('Teste 3B: Should detect negative sentiment for "não não gostei"', async () => {
        const payload = {
            messages: [{
                id: 'msg_04',
                content: 'não não gostei', // Treated as emphasized negative
                timestamp: new Date().toISOString(),
                user_id: 'user_test_y', // Fixed length
                hashtags: [],
                reactions: 0,
                shares: 0,
                views: 1,
            }],
            time_window_minutes: 30,
        };

        const res = await request(app.getHttpServer())
            .post('/analyze-feed')
            .send(payload)
            .expect(200);

        expect(res.body.analysis.sentiment_distribution.negative).toBe(100);
    });

    // Teste 3C — Case Sensitivity MBRAS
    it('Teste 3C: Should detect MBRAS employee with mixed case user_id', async () => {
        const payload = {
            messages: [{
                id: 'msg_05',
                content: 'olá',
                timestamp: new Date().toISOString(),
                user_id: 'user_MBRAS_007', // Mixed case
                hashtags: [],
                reactions: 0,
                shares: 0,
                views: 1,
            }],
            time_window_minutes: 30,
        };

        const res = await request(app.getHttpServer())
            .post('/analyze-feed')
            .send(payload)
            .expect(200);

        expect(res.body.analysis.flags.mbras_employee).toBe(true);
    });
});
