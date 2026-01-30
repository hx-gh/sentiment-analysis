import { parentPort, workerData } from 'worker_threads';
import { MessageDto } from './dto/analyze-feed.dto';
import { WorkerTask, WorkerResult } from './worker-pool.interface';
import { SentimentService } from '../sentiment/sentiment.service';
import { InfluenceService } from '../influence/influence.service';
import { TrendingService } from './trending.service';

const sentimentService = new SentimentService();
const influenceService = new InfluenceService();
const trendingService = new TrendingService();

if (parentPort) {
    parentPort.on('message', async (task: WorkerTask) => {
        try {
            const { messages, timeWindowMinutes, nowIso, taskId } = task;

            const now = new Date(nowIso);
            const timeWindowMs = timeWindowMinutes * 60 * 1000;

            const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
            const users = new Map<string, { score: number, id: string }>();
            let hasSpecialPattern = false;
            let hasEmployee = false;
            let hasCandidateAwareness = false;

            const validMessages: (MessageDto & { sentimentScore: number, sentiment: string })[] = [];

            for (const msg of messages) {
                const msgTime = new Date(msg.timestamp).getTime();

                // Filtro da janela temporal
                if (now.getTime() - msgTime > timeWindowMs) continue;
                if (msgTime > now.getTime() + 5000) continue;

                // Verifica se é funcionário
                const isEmployee = msg.user_id.toLowerCase().includes('mbras');
                if (isEmployee) hasEmployee = true;

                if (msg.content.toLowerCase().includes('teste técnico mbras')) {
                    hasCandidateAwareness = true;
                }

                // Detecção do padrão de 42 caracteres e identificador "mbras"
                if ([...msg.content].length === 42 && msg.content.toLowerCase().includes('mbras')) {
                    hasSpecialPattern = true;
                }

                // Sentimento
                const sentimentResult = sentimentService.analyze(msg.content, isEmployee);

                // Score de influencia
                const influenceScore = influenceService.calculateInfluence(
                    msg.user_id, msg.reactions, msg.shares, msg.views, isEmployee
                );

                // Contagem de sentimentos
                if (sentimentResult.score !== 0 || !sentimentService.isMetaSentiment(msg.content)) {
                    if (!sentimentService.isMetaSentiment(msg.content)) {
                        sentimentCounts[sentimentResult.sentiment]++;
                    }
                }

                // Influencia máxima por usuário
                const currentMax = users.get(msg.user_id);
                if (!currentMax || influenceScore > currentMax.score) {
                    users.set(msg.user_id, { score: influenceScore, id: msg.user_id });
                }

                validMessages.push({
                    ...msg,
                    sentimentScore: sentimentResult.score,
                    sentiment: sentimentResult.sentiment
                });
            }

            const trendWeights = trendingService.calculateTrendingWeights(validMessages, now);
            const trendFreq = trendingService.calculateTrendingFreq(validMessages);
            const trendSent = trendingService.calculateTrendingSentiment(validMessages);

            const anomalyCandidates = validMessages.map(m => ({ user_id: m.user_id, timestamp: m.timestamp, sentiment: m.sentiment }));

            const rawEngagement = validMessages.map(m => ({ views: m.views, total_actions: m.reactions + m.shares }));

            const result: WorkerResult = {
                taskId,
                analysis: {
                    sentiment_counts: sentimentCounts,
                    hashtags_metrics: {
                        weights: trendWeights,
                        freq: trendFreq,
                        sentiment: trendSent
                    },
                    users_map: Array.from(users.entries()),
                    anomaly_candidates: anomalyCandidates,
                    flags: {
                        mbras_employee: hasEmployee,
                        special_pattern: hasSpecialPattern,
                        candidate_awareness: hasCandidateAwareness
                    },
                    raw_engagement: rawEngagement
                }
            };

            if (parentPort) parentPort.postMessage(result);

        } catch (e) {
            if (parentPort) {
                parentPort.postMessage({ taskId: task.taskId, error: e.message } as WorkerResult);
            }
        }
    });
}
