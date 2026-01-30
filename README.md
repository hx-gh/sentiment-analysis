# 🚀 Sentiment Analysis System

Bem-vindo à implementação do Sistema de Análise de Sentimentos. Este projeto foi desenvolvido em **Node.js/TypeScript** utilizando o framework **NestJS**, focado em robustez, escalabilidade e velocidade de processamento.

## Comentários

1.  **Worker Pool Persistente**
    *   Foi implementado um **Pool de Workers Persistente** com foco em performance, para que o tempo de resposta ficasse abaixo de 100ms. 
    *   Os workers iniciam junto com a aplicação e ficam aguardando tarefas via fila interna.
    *   **Resultado**: Tempo de processamento para 1000 mensagens ficou abaixo de 100ms.
    *   **Justificativa**: O uso de workers persistentes evita o overhead de inicialização dos workers para cada requisição, o que economiza no tempo de inicialização de cada Worker (o custo em média é de 100ms). Os resultados sem a pool giram em torno de ~180ms.

2.  **Escalabilidade para 1 Milhão de Mensagens (RabbitMQ)**
    *   A arquitetura atual com `Worker Pool` desacoplado é "RabbitMQ-ready".
    *   Para processar **1 milhão de mensagens/seg**, basta substituir a fila em memória (`taskQueue`) por filas externas (RabbitMQ/Kafka).
    *   Isso habilita o padrão **Fan-out**, onde múltiplos pods do Kubernetes consomem a fila paralelamente com zero alteração na lógica de negócio (`feed.worker.ts`).
    * **Justificativa**: A implementação das Worker Threads implica também na implementação de filas para o correto processamento e ordem das mensagens, que em suma é o necessário para a escalabilidade, mesmo com o princípio KISS, é algo que se tornou implicito na implementação e um plus para o projeto. Além disso, essa estrutura reforça a **Idempotência**: se um worker falhar, a mensagem pode ser reprocessada da fila sem efeitos colaterais duplos, garantindo consistência.

---

## ✅ Checklist de Entrega

### Funcionalidade
- [x] Todos os 6 casos de teste passam
- [x] Endpoint HTTP funcional (`POST /analyze-feed`)
- [x] Validações 400/422 implementadas (DTOs + Pipes)
- [x] Função pura disponível para testes (`SentimentService` desacoplado)

### Performance
- [x] < 200ms para 1000 mensagens (**Atual: ~30ms**)
- [x] Uso de memória otimizado (Streams/Chunks e Workers leves)
- [x] Algoritmos O(n log n) ou melhor (Maioria linear O(n))

### Qualidade
- [x] Código organizado e documentado (Padrão NestJS)
- [x] README com instruções claras (Ver abaixo)
- [x] Outputs determinísticos (Sem seeds aleatórias)
- [x] Tratamento de edge cases (Unicode, Emojis, Negações Duplas, Timeouts)

### Algoritmos
- [x] Tokenização/normalização NFKD
- [x] Janela temporal relativa ao timestamp da requisição
- [x] Ordem de precedência correta no sentimento
- [x] Flags MBRAS case-insensitive
- [x] Anomalias e trending implementados
- [x] SHA-256 determinístico para influência

### CI
- [x] Criação de um workflow do git actions
- [x] Criar um CI de ao menos 3 etapas (Setup, Build, Test)

---

## 🚀 Como Rodar o Projeto

Pré-requisitos: Node.js 18+ e NPM.

### 1. Instalação
```bash
npm install
```

### 2. Rodar Testes (Unitários + E2E + Performance)
```bash
# Roda tudo e valida os 6 cenários + performance
npm run test:e2e
```

### 3. Rodar Servidor
```bash
# Modo Desenvolvimento
npm run start:dev

# Modo Produção (Build Otimizado)
npm run build
npm run start:prod
```
**Nota**: Ao iniciar a aplicação (`npm run start:dev` ou `npm run start`), os arquivos de exemplo em `examples/` são **automaticamente atualizados** com timestamps recentes para garantir que os testes manuais funcionem dentro da janela de 30 minutos.

```bash
curl -X POST http://localhost:3000/analyze-feed \
  -H "Content-Type: application/json" \
  -d @examples/sample-request.json
```

```bash
curl -X POST http://localhost:3000/analyze-feed \
  -H "Content-Type: application/json" \
  -d @examples/performance-1k.json
```


## Conclusões

Agradeço pela oportunidade de participar deste teste técnico. Foi uma experiência bacana onde pude explorar não apenas os conceitos dos algoritmos propostos mas também por em prática conhecimentos de Worker Threads e Pools com foco em alta performance.

Muito obrigado! 🚀
