import { Test, TestingModule } from '@nestjs/testing';
import { SentimentService } from './sentiment.service';

describe('SentimentService', () => {
    let service: SentimentService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [SentimentService],
        }).compile();

        service = module.get<SentimentService>(SentimentService);
    });

    it('should calculate "Super adorei!" correctly for MBRAS employee', () => {
        // Exemplo 4.1.1
        // "Super adorei!" -> ["Super", "adorei"] (2 tokens)
        // adorei (1) * super (1.5) * mbras (2) = 3.0
        // Score = 3.0 / 2 = 1.5
        const result = service.analyze('Super adorei!', true);
        expect(result.score).toBeCloseTo(1.5);
        expect(result.sentiment).toBe('positive');
    });

    it('should calculate "Não muito bom" correctly', () => {
        // Exemplo 179
        // "Não muito bom" -> ["Não", "muito", "bom"] (3 tokens)
        // bom (1) * muito (1.5) * nao (-1) = -1.5
        // Score = -1.5 / 3 = -0.5
        const result = service.analyze('Não muito bom');
        expect(result.score).toBeCloseTo(-0.5);
        expect(result.sentiment).toBe('negative');
    });

    it('should return neutral for "muito" (Orphan Intensifier)', () => {
        // Teste 3A
        const result = service.analyze('muito');
        // score: 0 / 1 = 0
        expect(result.sentiment).toBe('neutral');
    });

    it('should detect double negation', () => {
        // Teste 3B: "não não gostei"
        // tokens: nao, nao, gostei
        const result = service.analyze('não não gostei');
        expect(result.sentiment).toBe('negative');
    });
});
