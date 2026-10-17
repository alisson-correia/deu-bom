# Deu Bom — Finanças sem erro

Aplicação React/TypeScript + Vite, shadcn/ui, Zustand e Supabase. Este é o repositório da aplicação completa: receitas, despesas, recorrências, workspaces, compras, metas, análises e eventos.

## Desenvolvimento

Use Node 24 e npm. O frontend não exige a CLI do Supabase; a instalação abaixo evita o download opcional dela pelo postinstall e recompõe os módulos nativos usados pelo build, mantendo a verificação de integridade do npm.

```sh
npm ci --ignore-scripts
npm rebuild esbuild @swc/core
cp .env.example .env.local
# Preencha a configuração pública do projeto Supabase correto.
npm run dev -- --host 0.0.0.0
```

O projeto esperado está em `supabase/config.toml`: `ufmzkxhrljpogulllnzv`. Use sua URL e chave **publishable** ou **anon** nas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Nunca use `service_role` no frontend. As variáveis injetadas pelo ambiente têm prioridade sobre `.env.local`: confira se apontam ao projeto correto antes de executar o app ou gerar um build.

`VITE_PUBLIC_APP_URL` é opcional para fixar um domínio canônico de convites e recuperação de senha. Sem ela, o app usa a origem atual do navegador. Os domínios usados precisam ser permitidos nas configurações de Auth do Supabase.

## Ajustes de interface

- Controle **Tema** sempre acessível: Claro, Escuro e Sistema, com escolha persistida e acompanhamento da preferência do dispositivo.
- Paleta violeta/azul e rosa suave nos dois modos; categorias já personalizadas pelos usuários são preservadas.
- Receita e despesa com a mesma aparência inicial; destaque somente ao selecionar. Removidos o atalho flutuante de nova despesa, um link repetido de detalhes e o botão Salvar duplicado do formulário.
- Voz na tela inicial reutiliza o mesmo reconhecimento e parser das outras telas. Diga “despesa mercado 35,90 reais”, “salário 2000 reais”, “tema claro”, “tema escuro” ou “modo do sistema”. Lançamentos abrem o formulário para revisão; nenhuma transcrição é salva automaticamente.
- O parser preserva compras/recorrência e distingue valores decimais de parcelas. Resultados parciais não executam comandos, erros de microfone têm orientação e a escuta termina ao sair da tela. A voz depende do suporte e das permissões do navegador, que pode processar o áudio online.
- Aviso único de nova versão pelo service worker e por `version.json`, com verificação ao abrir, voltar ao app e a cada minuto. Permite adiar e pede confirmação antes de atualizar, sem recarregar automaticamente por troca do worker em outra aba.
- O worker guarda apenas assets do app; não mantém respostas autenticadas do Supabase no cache compartilhado.
- Formulário acima da navegação mobile, alvos de toque, foco contido, fechamento por Escape e título/valor dos cartões reorganizados em telas estreitas.
- Falhas de carregamento não simulam saldo zero; falhas de gravação preservam os campos.

## Validação

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e -- --workers=3
npm run build
npm run check:supabase
npm run check:vercel
```

Para usar explicitamente o arquivo local no diagnóstico: `npm run check:supabase -- --local`. Em máquinas sem escrita no diretório pessoal, defina `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright` ao instalar e executar o navegador.

Os testes de navegador usam exclusivamente uma API simulada (`supabase.test`) em desktop, Pixel 7 emulado e viewport de 320 px. Cobrem persistência pela API simulada, revisão por voz, temas, atualização, falhas e layouts. Não substituem a validação com contas reais nem o teste acústico em aparelhos físicos. O workflow `Validate app` executa os checks sem publicar em produção.

## Supabase

A configuração pública usada pelo site já publicado foi validada com GET e `limit=0`. As 11 tabelas referenciadas responderam HTTP 200, inclusive `purchase_goals`. Nenhum registro foi solicitado nem alterado. Existência pela API não comprova políticas RLS, constraints, triggers ou RPCs; essa auditoria exige acesso autorizado ao banco.

O ambiente inicialmente injetava uma URL/chave diferentes e recebia HTTP 401. A configuração pública válida foi preparada apenas em `.env.local`, ignorado pelo Git. Corrija os valores do ambiente para o projeto acima; não copie credenciais para commits ou logs.

## Vercel

`vercel.json` fixa a instalação por npm (sem escolher os lockfiles Bun), configura Vite, saída `dist`, fallback SPA e ausência de cache em `/sw.js` e `/version.json`. O endpoint público `https://deu-bom-financas-sem-erro.vercel.app` respondeu HTTP 200 com identificação do Vercel.

A API administrativa, porém, respondeu HTTP 404 ao token disponível para o project ID informado (`prj_s5VpsAYH1MfNwHQwyO1GOJ8N4sX5`) e para o alias da publicação. Portanto, não foi possível confirmar o vínculo Git nem realizar um novo deploy com esse acesso. O GitHub também não apresentou deployments/status Vercel para o HEAD original deste repositório. Isso não prova que o projeto inexista: ele pode pertencer a outra equipe/escopo.

No painel Vercel, confira se o projeto está ligado a **alisson-correia/deu-bom**, com Framework Vite, comando `npm run build`, pasta `dist` e as variáveis públicas corretas na etapa de build. Para publicar via CLI/API, use um token com acesso de implantação à equipe/projeto e o Team/Organization ID correto. Forneça credenciais somente pelas configurações seguras do ambiente. A CLI aceita `vercel deploy --prod` após o vínculo autorizado; esse comando não foi executado com sucesso nesta sessão.

## Prévia mobile

Capturas de navegador emulado de 320 px, com dados de teste:

| Claro | Escuro |
| --- | --- |
| ![Início claro](docs/qa/screenshots/mobile-light.png) | ![Início escuro](docs/qa/screenshots/mobile-dark.png) |
