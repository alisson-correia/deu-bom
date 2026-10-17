# Google Agenda + Tasks: configuração e limites

## Comportamento implementado

Cada lançamento sincronizado tem uma tarefa na lista **Deu Bom · Finanças** e um evento no calendário secundário **Deu Bom · Lembretes**. O evento é privado e transparente (não bloqueia horários), vermelho para despesa e verde para receita. Fica na data do lançamento às 09h, no fuso escolhido ao conectar, com lembretes no dia anterior e no próprio dia. As notificações finais dependem das permissões e configurações do Google e do dispositivo.

A tarefa é a referência de conclusão. Ao sincronizar, uma conclusão/reabertura na tarefa atualiza o lançamento com a sessão e as políticas RLS do usuário. Alterações do app atualizam tarefa e lembrete; os lembretes são retirados de lançamentos concluídos. Quando ambos mudam, a atualização mais recente prevalece. A exclusão do app remove os itens vinculados na próxima sincronização. Desconectar preserva os lançamentos financeiros e interrompe a integração.

O app sincroniza ao abrir/retomar, após alterações e a cada minuto enquanto estiver visível. Não há promessa de sincronização instantânea com o app fechado: a API Google Tasks não oferece webhook de conclusão. Um agendador no servidor será necessário se essa latência em segundo plano for um requisito. Os lembretes já criados no Google funcionam independentemente do app estar aberto.

A API de Tasks não possui campo `colorId` nem criação de lembretes. Por isso aparecem dois itens vinculados no Google. A cor e os alertas são do evento, e a conclusão é da tarefa.

## Preparação no Google Cloud

1. Em um projeto Google Cloud que você administra, habilite **Google Calendar API** e **Google Tasks API**.
2. Configure a tela de consentimento OAuth. Se estiver em modo de testes, cadastre o email Google que será usado para conectar.
3. Crie um cliente OAuth do tipo **Aplicativo Web**.
4. Cadastre exatamente esta URI de redirecionamento autorizada:
   `https://deu-bom-financas-sem-erro.vercel.app/api/google/callback`
5. Nas variáveis seguras do projeto Vercel, ambiente Production, cadastre `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`. Não coloque o segredo em variável VITE_, no Git ou no chat.
6. Confirme `GOOGLE_TOKEN_ENCRYPTION_KEY` (64 caracteres hexadecimais gerados com segurança; manter estável) e as variáveis de servidor `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` da integração Supabase.
7. Faça uma nova publicação após cadastrar os valores. Abra **Configurações → Agenda → Conectar Google** e autorize a conta.

Escopos solicitados: `openid`, `email`, `https://www.googleapis.com/auth/tasks` e `https://www.googleapis.com/auth/calendar.app.created`. O acesso de calendário fica limitado aos calendários secundários criados pelo app. Não é solicitado acesso geral de escrita à agenda principal.

O modo Testing do Google pode limitar a duração dos refresh tokens e o número de usuários; siga as exigências de publicação/verificação do Google antes de liberar a integração para todos. Para outro domínio/ambiente, configure `PUBLIC_APP_URL` e a URI correspondente no cliente OAuth; os cookies e o callback precisam usar a mesma origem. Não conecte uma prévia com callback de outro domínio.

## Banco e servidor

A migração `supabase/migrations/20261017190000_google_calendar_integration.sql` cria duas tabelas privadas. Ela não modifica lançamentos existentes. As tabelas têm RLS ativado e acesso revogado para anon/authenticated; os tokens são cifrados com AES-256-GCM no servidor antes de serem gravados. As rotas validam a sessão Supabase no servidor; alterações financeiras continuam sujeitas ao cliente RLS do próprio usuário. O OAuth usa state cifrado com expiração, cookie HttpOnly/Secure/SameSite e PKCE.

Para aplicar de um ambiente administrativo com PostgreSQL acessível, use `npm run db:migrate:google`. O comando exige `POSTGRES_URL_NON_POOLING` ou `POSTGRES_URL` e mantém verificação TLS de cadeia e hostname, incluindo o certificado público `prod-ca-2021.crt` do Supabase em `scripts/certs` (origem: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt). Não roda automaticamente em todos os builds. Em ambientes sem acesso TCP ao banco, pode ser executado uma vez no build autorizado do Vercel com as variáveis da integração existente; depois restaure o build normal `npm run build`.

A chave de cifragem pode ser criada com `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"` e deve ser inserida somente no armazenamento seguro. Trocar a chave invalida os tokens cifrados existentes; não a regenere em cada deploy.

## Validação e pendências reais

Os testes automatizados usam serviços simulados para validar contrato, criptografia, proteção do callback, isolamento da sessão e conclusão Google→app. A conexão real exige o Client ID/Secret e o consentimento de uma conta Google. Até essa configuração existir, o app mostra **Integração aguardando configuração** e não simula uma conexão bem-sucedida.

Teste real após configurar: criar receita e despesa pendentes; conferir os dois itens de cada lançamento; validar cores, datas, horário livre e alertas; concluir uma tarefa no Google; reabrir/sincronizar o app e conferir o lançamento; testar reconexão e uma falha de permissão. Não confundir testes simulados com essa aceitação real.

Referências: [Tasks](https://developers.google.com/workspace/tasks/reference/rest/v1/tasks), [Events](https://developers.google.com/workspace/calendar/api/v3/reference/events), [escopos Calendar](https://developers.google.com/workspace/calendar/api/auth).
