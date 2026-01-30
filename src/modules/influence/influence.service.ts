import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class InfluenceService {
    calculateInfluence(
        userId: string,
        reactions: number,
        shares: number,
        views: number,
        isMbrasEmployee: boolean,
    ): number {
        const followers = this.calculateFollowers(userId);
        const engagementRate = this.calculateEngagement(reactions, shares, views);

        let influenceScore = (followers * 0.4) + (engagementRate * 0.6);

        // Se for id terminando em "007" -> x0.5
        if (userId.endsWith('007')) {
            influenceScore *= 0.5;
        }

        // Se for funcionário -> +2.0
        if (isMbrasEmployee) {
            influenceScore += 2.0;
        }

        return influenceScore;
    }

    calculateFollowers(userId: string): number {

        // Aplica regra especial para id com 13 caracteres
        if (userId.length === 13) return 233;

        // Aplica regra especial para id com caracteres não-ASCII e retorna 4242 -> Lógica do "user_café" -> 4242
        if (/[^\x00-\x7F]/.test(userId)) {
            return 4242;
        }

        // Aplica regra especial para id terminando em "_prime" e retorna 8191
        if (userId.endsWith('_prime')) {
            return 8191;
        }

        // Aplicação do algoritmo de hash SHA-256 determinístico => Equivalente ao exemplo em Python
        const hash = crypto.createHash('sha256').update(userId).digest('hex');
        const intValue = BigInt('0x' + hash);
        return Number(intValue % 10000n) + 100;
    }

    private calculateEngagement(reactions: number, shares: number, views: number): number {
        if (views === 0) return 0;
        let rate = (reactions + shares) / views;

        // Ajuste de Golden Ratio: interações (reactions + shares) múltiplo de 7
        if ((reactions + shares) % 7 === 0 && (reactions + shares) > 0) {
            const phi = 1.61803398875; // Golden Ratio
            rate *= (1 + 1 / phi);
        }

        return rate;
    }
}
