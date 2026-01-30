export const SENTIMENT_DICTIONARY = {
    positives: new Set([
        'adorei', 'amei', 'ótimo', 'otimo', 'bom', 'excelente', 'maravilhoso',
        'gostei', 'perfeito', 'top', 'legal', 'curti', 'parabéns', 'parabens',
        'feliz', 'satisfeito', 'recomendo', 'melhor', 'incrível', 'incrivel'
    ]),
    negatives: new Set([
        'odiei', 'detestei', 'péssimo', 'pessimo', 'ruim', 'horrível', 'horrivel',
        'lixo', 'bosta', 'droga', 'chato', 'triste', 'decepção', 'decepcao',
        'pior', 'lento', 'bugado', 'falha', 'erro', 'problema', 'terrível', 'terrivel'
    ]),
    intensifiers: new Set([
        'muito', 'super', 'tão', 'tao', 'demais', 'bastante', 'extremamente', 'realmente'
    ]),
    negations: new Set([
        'não', 'nao', 'nunca', 'jamais', 'nem'
    ])
};
