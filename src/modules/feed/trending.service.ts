import { Injectable } from '@nestjs/common';

@Injectable()
export class TrendingService {

    calculateTrendingWeights(
        messages: { content: string; timestamp: string; hashtags: string[]; sentimentScore: number }[],
        now: Date,
    ): Record<string, number> {
        const topicWeights: Record<string, number> = {};
        for (const msg of messages) {

            const minutesSincePost = Math.max(0.01, (now.getTime() - new Date(msg.timestamp).getTime()) / 60000);
            const timeWeight = 1 + (1 / minutesSincePost);

            let sentimentMod = 1.0;
            if (msg.sentimentScore > 0.1) sentimentMod = 1.2;
            else if (msg.sentimentScore < -0.1) sentimentMod = 0.8;

            for (const tag of msg.hashtags) {
                let lenMod = 1.0;
                // Aplicação da função logarítmica para hashtags maiores que 8 caracteres
                if (tag.length > 8) {
                    lenMod = Math.log10(tag.length) / Math.log10(8);
                }
                const weight = timeWeight * sentimentMod * lenMod;
                topicWeights[tag] = (topicWeights[tag] || 0) + weight;
            }
        }
        return topicWeights;
    }

    calculateTrendingFreq(messages: any[]): Record<string, number> {
        const freq: Record<string, number> = {};
        for (const msg of messages) {
            for (const tag of msg.hashtags) {
                freq[tag] = (freq[tag] || 0) + 1;
            }
        }
        return freq;
    }

    calculateTrendingSentiment(messages: any[]): Record<string, number> {
        const sent: Record<string, number> = {};
        for (const msg of messages) {
            for (const tag of msg.hashtags) {
                sent[tag] = (sent[tag] || 0) + msg.sentimentScore;
            }
        }
        return sent;
    }

    sortTrending(
        weights: Record<string, number>,
        freq: Record<string, number>,
        sentiment: Record<string, number>
    ): string[] {
        return Object.keys(weights).sort((a, b) => {
            const wA = weights[a];
            const wB = weights[b];
            if (Math.abs(wA - wB) > 0.0001) return wB - wA;

            const fA = freq[a];
            const fB = freq[b];
            if (fA !== fB) return fB - fA;

            const sA = sentiment[a];
            const sB = sentiment[b];
            if (Math.abs(sA - sB) > 0.0001) return sB - sA;

            return a.localeCompare(b);
        }).slice(0, 5);
    }

    calculateTrending(messages: any[], now: Date): string[] {
        const w = this.calculateTrendingWeights(messages, now);
        const f = this.calculateTrendingFreq(messages);
        const s = this.calculateTrendingSentiment(messages);
        return this.sortTrending(w, f, s);
    }
}
