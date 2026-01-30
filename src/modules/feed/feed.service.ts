import { Injectable, BadRequestException, UnprocessableEntityException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';
import { AnalyzeFeedDto, MessageDto } from './dto/analyze-feed.dto';
import { TrendingService } from './trending.service';
import { SentimentService } from '../sentiment/sentiment.service';
import { WorkerTask, WorkerResult } from './worker-pool.interface';

@Injectable()
export class FeedService implements OnModuleInit, OnModuleDestroy {
    private workers: Worker[] = [];
    private freeWorkers: Worker[] = [];
    private taskQueue: Array<{ task: WorkerTask, resolve: (v: any) => void, reject: (e: any) => void }> = [];
    private workerPath: string;
    private taskIdCounter = 0;
    private isDestroying = false;

    constructor(private readonly trendingService: TrendingService) { }

    onModuleInit() {
        this.resolveWorkerPath();
        const cpuCount = os.cpus().length;
        const isTest = process.env.NODE_ENV === 'test';
        const poolSize = isTest ? 4 : Math.max(2, cpuCount - 1);
        console.log(`[FeedService] Initializing Worker Pool with ${poolSize} workers...`);
        for (let i = 0; i < poolSize; i++) {
            this.spawnWorker(i);
        }
    }

    async onModuleDestroy() {
        this.isDestroying = true;
        const promises = this.workers.map(w => w.terminate());
        await Promise.all(promises);
    }

    private resolveWorkerPath() {
        // Para o ambiente de testes, usar o worker compilado
        if (process.env.NODE_ENV === 'test') {
            const distWorker = path.resolve(__dirname, '../../../dist/modules/feed/feed.worker.js');
            if (require('fs').existsSync(distWorker)) {
                this.workerPath = distWorker;
                return;
            }
        }

        // Para o ambiente de desenvolvimento, usar o worker original
        if (__filename.endsWith('.ts')) {
            this.workerPath = path.resolve(__dirname, 'feed.worker.ts');
            return;
        }

        // Para o ambiente de produção, usar o worker compilado
        let workerPath = '';
        if (__dirname.includes('src')) {
            const distWorker = path.resolve(__dirname, '../../../dist/modules/feed/feed.worker.js');
            if (require('fs').existsSync(distWorker)) {
                workerPath = distWorker;
            }
        }
        // Caso nenhum worker seja encontrado, usar o worker baseado no estado atual do arquivo
        if (!workerPath) {
            const ext = path.extname(__filename);
            workerPath = path.resolve(__dirname, `feed.worker${ext}`);
        }
        this.workerPath = workerPath;
    }

    private spawnWorker(id: number) {
        if (this.isDestroying) return;
        const workerOptions: any = { workerData: {} };
        if (this.workerPath.endsWith('.ts')) {
            workerOptions.execArgv = ['-r', 'ts-node/register'];
        }
        const worker = new Worker(this.workerPath, workerOptions);
        worker.on('error', (err) => {
            console.error(`[Worker ${id}] Error:`, err);
            this.replaceWorker(worker, id);
        });
        worker.on('exit', (code) => {
            if (code !== 0 && !this.isDestroying) {
                console.error(`[Worker ${id}] Exited with code ${code}`);
                this.replaceWorker(worker, id);
            }
        });
        this.workers.push(worker);
        this.freeWorkers.push(worker);
        this.processQueue();
    }

    private replaceWorker(deadWorker: Worker, id: number) {
        this.workers = this.workers.filter(w => w !== deadWorker);
        this.freeWorkers = this.freeWorkers.filter(w => w !== deadWorker);
        this.spawnWorker(id);
    }

    async analyze(dto: AnalyzeFeedDto): Promise<any> {
        const start = Date.now();

        if (dto.time_window_minutes > 120) {
            throw new UnprocessableEntityException({
                error: 'Valor de janela temporal não suportado na versão atual',
                code: 'UNSUPPORTED_TIME_WINDOW'
            });
        }

        const messages = dto.messages;
        const BATCH_SIZE = 500;
        const chunks: MessageDto[][] = [];

        for (let i = 0; i < messages.length; i += BATCH_SIZE) {
            chunks.push(messages.slice(i, i + BATCH_SIZE));
        }

        const nowIso = new Date().toISOString();

        // Agendar tarefas via Pool de Workers
        const promises = chunks.map(chunk => {
            const task: WorkerTask = {
                taskId: this.taskIdCounter++,
                messages: chunk,
                timeWindowMinutes: dto.time_window_minutes,
                nowIso
            };
            return this.runTaskInPool(task);
        });

        const results = await Promise.all(promises);

        const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };

        let hasEmployee = false;
        let hasPattern = false;
        let hasCandidate = false;

        const globalWeights: Record<string, number> = {};
        const globalFreq: Record<string, number> = {};
        const globalSentiment: Record<string, number> = {};

        const globalUsers = new Map<string, { score: number, id: string }>();

        let allAnomalyCandidates: any[] = [];

        const allEngagementItems: any[] = [];


        for (const res of results) {
            const data = (res as WorkerResult).analysis;

            sentimentCounts.positive += data.sentiment_counts.positive;
            sentimentCounts.negative += data.sentiment_counts.negative;
            sentimentCounts.neutral += data.sentiment_counts.neutral;

            if (data.flags.mbras_employee) hasEmployee = true;
            if (data.flags.special_pattern) hasPattern = true;
            if (data.flags.candidate_awareness) hasCandidate = true;

            for (const [tag, w] of Object.entries(data.hashtags_metrics.weights)) {
                globalWeights[tag] = (globalWeights[tag] || 0) + (w as number);
            }
            for (const [tag, f] of Object.entries(data.hashtags_metrics.freq)) {
                globalFreq[tag] = (globalFreq[tag] || 0) + (f as number);
            }
            for (const [tag, s] of Object.entries(data.hashtags_metrics.sentiment)) {
                globalSentiment[tag] = (globalSentiment[tag] || 0) + (s as number);
            }

            for (const [uid, udata] of data.users_map) {
                const current = globalUsers.get(uid as string);
                const newData = udata as { score: number, id: string };
                if (!current || newData.score > current.score) {
                    globalUsers.set(uid as string, newData);
                }
            }


            allAnomalyCandidates.push(...data.anomaly_candidates);
            allEngagementItems.push(...data.raw_engagement);
        }

        const totalSent = sentimentCounts.positive + sentimentCounts.negative + sentimentCounts.neutral;
        const distribution = {
            positive: totalSent ? (sentimentCounts.positive / totalSent) * 100 : 0,
            negative: totalSent ? (sentimentCounts.negative / totalSent) * 100 : 0,
            neutral: totalSent ? (sentimentCounts.neutral / totalSent) * 100 : 0,
        };

        const trending = this.trendingService.sortTrending(globalWeights, globalFreq, globalSentiment);

        const ranking = Array.from(globalUsers.values())
            .sort((a, b) => b.score - a.score);

        const sentimentService = new SentimentService();
        const anomalyResult = sentimentService.detectAnomalies(allAnomalyCandidates);

        let engagementScore = 0;
        if (allEngagementItems.length > 0) {
            let sumRates = 0;
            for (const item of allEngagementItems) {
                if (item.views > 0) sumRates += item.total_actions / item.views;
            }
            engagementScore = sumRates / allEngagementItems.length;
        }
        if (hasCandidate) engagementScore = 9.42;

        return {
            analysis: {
                processing_time_ms: Date.now() - start,
                sentiment_distribution: distribution,
                engagement_score: engagementScore,
                trending_topics: trending,
                influence_ranking: ranking.map(u => ({ user_id: u.id, influence_score: u.score })),
                anomaly_detected: anomalyResult.detected,
                anomaly_type: anomalyResult.detected ? anomalyResult.type : null,
                flags: {
                    mbras_employee: hasEmployee,
                    special_pattern: hasPattern,
                    candidate_awareness: hasCandidate
                }
            }
        };
    }

    private runTaskInPool(task: WorkerTask): Promise<WorkerResult> {
        return new Promise((resolve, reject) => {
            this.taskQueue.push({ task, resolve, reject });
            this.processQueue();
        });
    }

    private processQueue() {
        if (this.taskQueue.length === 0) return;
        if (this.freeWorkers.length === 0) return;

        const worker = this.freeWorkers.pop();
        const item = this.taskQueue.shift(); // Fila FIFO

        if (!worker || !item) {
            // Este cenário não deve acontecer, mas foi implementado por segurança
            if (worker) this.freeWorkers.push(worker);
            return;
        }

        const { task, resolve, reject } = item;

        const onMessage = (result: WorkerResult) => {

            if (result.taskId !== task.taskId) {
                console.error(`Mismatch Task ID! Expected ${task.taskId}, got ${result.taskId}`);
            }

            if (result.error) {
                reject(new Error(result.error));
            } else {
                resolve(result);
            }

            // Libera o worker para a pool
            this.freeWorkers.push(worker);
            this.processQueue();
        };

        worker.once('message', onMessage);

        worker.postMessage(task);
    }
}
