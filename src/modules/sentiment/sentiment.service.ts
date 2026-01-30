import { Injectable } from '@nestjs/common';
import { SENTIMENT_DICTIONARY } from './sentiment.dictionary';

@Injectable()
export class SentimentService {
    private readonly POLARITY_WORDS: Record<string, number> = {};
    private readonly INTENSIFIERS: Record<string, number> = {};
    private readonly NEGATIONS: string[] = [];

    constructor() {
        // Inicializa o dicionário de sentimentos
        for (const word of SENTIMENT_DICTIONARY.positives) this.POLARITY_WORDS[word] = 1;
        for (const word of SENTIMENT_DICTIONARY.negatives) this.POLARITY_WORDS[word] = -1;

        for (const word of SENTIMENT_DICTIONARY.intensifiers) this.INTENSIFIERS[word] = 1.5;

        this.NEGATIONS = Array.from(SENTIMENT_DICTIONARY.negations);
    }

    analyze(
        content: string,
        isMbrasEmployee: boolean = false,
    ): { score: number; sentiment: 'positive' | 'negative' | 'neutral' } {
        if (this.isMetaSentiment(content)) {
            return { score: 0, sentiment: 'neutral' };
        }

        const tokens = this.tokenize(content);
        if (tokens.length === 0) return { score: 0, sentiment: 'neutral' };

        let totalScore = 0;

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const normalizedToken = this.normalize(token);

            // Se for uma palavra de polarização, calcula o score
            if (this.POLARITY_WORDS.hasOwnProperty(normalizedToken)) {
                let currentScore = this.POLARITY_WORDS[normalizedToken];

                // Verifica se a palavra tem um intensificador
                if (i > 0) {
                    const prevToken = this.normalize(tokens[i - 1]);
                    if (this.INTENSIFIERS.hasOwnProperty(prevToken)) {
                        currentScore *= this.INTENSIFIERS[prevToken];
                    }
                }

                // Verifica se a palavra tem uma negação
                // Verifica se a palavra tem uma negação
                let negationMultiplier = 1;
                const lookbackStart = Math.max(0, i - 3);

                let foundNegations = 0;
                for (let j = i - 1; j >= lookbackStart; j--) {
                    const prevToken = this.normalize(tokens[j]);
                    if (this.NEGATIONS.includes(prevToken)) {
                        // Check if previous (closer to target) was also negation to dedup
                        if (j < i - 1 && this.NEGATIONS.includes(this.normalize(tokens[j + 1]))) {
                            continue;
                        }
                        foundNegations++;
                    }
                }

                if (foundNegations % 2 !== 0) {
                    negationMultiplier = -1;
                }

                currentScore *= negationMultiplier;

                // Aplica regra de funcionário MBRAS
                if (isMbrasEmployee && currentScore > 0) {
                    currentScore *= 2.0;
                }

                totalScore += currentScore;
            }
        }

        const finalScore = tokens.length > 0 ? totalScore / tokens.length : 0;

        let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
        if (finalScore > 0.1) sentiment = 'positive';
        else if (finalScore < -0.1) sentiment = 'negative';

        return { score: finalScore, sentiment };
    }

    isMetaSentiment(content: string): boolean {
        const normalized = content.toLowerCase().replace(/[.,!?;:"()\[\]{}…]/g, '').trim();
        return normalized === 'teste técnico mbras';
    }

    private normalize(token: string): string {
        return token
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    private tokenize(content: string): string[] {
        const regex = /(?:#[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*)|[\p{L}\p{N}]+/gu;
        const matches = content.match(regex);
        return matches || [];
    }


    detectAnomalies(messages: { user_id: string; timestamp: string; sentiment: string }[]): { detected: boolean; type: string | null } {
        // Agrupa por usuário
        const userMsgs: Record<string, typeof messages> = {};
        for (const m of messages) {
            if (!userMsgs[m.user_id]) userMsgs[m.user_id] = [];
            userMsgs[m.user_id].push(m);
        }

        for (const userId in userMsgs) {
            const msgs = userMsgs[userId].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            // Verifica condição de burst
            if (msgs.length > 10) {
                for (let i = 0; i < msgs.length; i++) {
                    const start = new Date(msgs[i].timestamp).getTime();
                    let count = 0;
                    for (let j = i; j < msgs.length; j++) {
                        // Verifica se a mensagem está dentro do intervalo de 5 minutos
                        if (new Date(msgs[j].timestamp).getTime() - start <= 5 * 60 * 1000) {
                            count++;
                        } else {
                            break;
                        }
                    }
                    // Se houver mais de 10 mensagens em 5 minutos, retorna flag de burst
                    if (count > 10) return { detected: true, type: 'burst' };
                }
            }

            // Verifica condição de alternância
            if (msgs.length >= 10) {
                const signs = msgs.map(m => m.sentiment === 'positive' ? 1 : (m.sentiment === 'negative' ? -1 : 0));
                let altCount = 1;
                for (let k = 1; k < signs.length; k++) {
                    // Verifica se há alternância de sentimentos
                    if (signs[k] !== 0 && signs[k] === -signs[k - 1]) {
                        altCount++;
                    } else {
                        altCount = 1;
                    }
                    // Se houver alternância de sentimentos, retorna flag de alternância
                    if (altCount >= 10) return { detected: true, type: 'alternating_sentiment' };
                }
            }
        }

        // Verifica condição de postagem sincronizada
        const sortedAll = messages.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        for (let i = 0; i < sortedAll.length - 2; i++) {
            const t1 = new Date(sortedAll[i].timestamp).getTime();
            const t3 = new Date(sortedAll[i + 2].timestamp).getTime();
            if (t3 - t1 <= 2000) {
                // Se houver 3 mensagens dentro de uma janela de 2s, retorna flag de postagem sincronizada
                return { detected: true, type: 'synchronized_posting' };
            }
        }

        return { detected: false, type: null };
    }
}
