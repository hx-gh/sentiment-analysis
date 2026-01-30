import { MessageDto } from './dto/analyze-feed.dto';

export interface WorkerTask {
    taskId: number;
    messages: MessageDto[];
    timeWindowMinutes: number;
    nowIso: string;
}

export interface WorkerResult {
    taskId: number;
    analysis: any;
    error?: string;
}
