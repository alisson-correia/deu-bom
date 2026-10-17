# Importação, comprovantes e voz

Configurações → Dados oferece um modelo CSV UTF-8 com exemplos, instruções de cada coluna e uma prévia selecionável. CSV/TSV e texto tabulado são aceitos. Valor representa o total original; Parcelas e ParcelaInicial permitem importar apenas a parte restante da dívida. Centavos são distribuídos sem perda e os vencimentos mantêm o dia original quando possível. Possíveis duplicados começam desmarcados. Não se criam categorias automaticamente. O lote selecionado é confirmado em uma transação PostgreSQL, com IDs estáveis para repetição segura.

Foto, câmera, PDF ou texto livre podem preparar dados para revisão. A leitura automática não grava finanças: valores, direção da transferência e datas ausentes precisam ser conferidos. Não se deve presumir que a data da compra é o vencimento do cartão. Para comprovante de parcela já paga, importa-se somente o pagamento identificado, sem inventar o restante. Há preenchimento manual mesmo quando a IA está indisponível.

Limites: CSV até 2 MB/500 linhas/1000 lançamentos; comprovantes JPG/PNG/WebP/PDF até 3 MB, PDF até 10 páginas na leitura; imagens são otimizadas no navegador. A IA aceita até 12 mil caracteres e 50 itens por leitura. Limite de 30 tentativas por usuário/dia UTC, incluindo chamadas que falhem no provedor.

O anexo é enviado somente ao confirmar a importação. Fica em bucket privado, com links de leitura de cinco minutos e controle por usuário/equipe. Também pode ser anexado ao editar um lançamento. Remover o vínculo de um anexo tenta excluir o arquivo próprio sem outros vínculos. Excluir uma transação remove os metadados em cascata; arquivos físicos sem vínculo podem exigir limpeza administrativa posterior.

## Servidor

Aplicar `20261017230000_receipts_and_bulk_import.sql` antes da publicação. O prebuild pode aplicá-la com `RECEIPTS_SCHEMA_AUTO_MIGRATE=1`, usando PostgreSQL administrativo com TLS validado; remover a flag após conferência. Tabelas: transaction_attachments e document_import_usage; bucket privado deu-bom-comprovantes; RPC autenticada import_finance_batch e RPC administrativa reserve_document_import.

Leitura usa OPENAI_API_KEY (gpt-4.1-mini), ou AI_GATEWAY_API_KEY/OIDC da Vercel (google/gemini-2.5-flash-lite). AI_IMPORT_MODEL é opcional. Configurar segredos somente no servidor Vercel. A conta precisa ter acesso/cobrança habilitados. O teste real inicial do Gateway respondeu customer_verification_required; testes simulados de extração não comprovam liberação dessa conta nem qualidade de OCR em recibos reais.

## Quantidades por voz

“Despesa 10 açúcares, 1 quilo cada, R$50 cada um à vista pago dia 10/11/2026” prepara R$500, preserva quantidade e embalagem nas observações e associa categoria alimentar existente. “10 quilos de açúcar 50 reais cada” na lista prepara quantidade 10 kg a R$50 por kg. O peso de cada pacote não substitui a quantidade de pacotes. Quando a base do preço financeiro é ambígua, a revisão pergunta se é unitário ou total.

A revisão exibe um resumo; dados reconhecidos podem ser editados. Data, situação e categoria desconhecidas aparecem para completar. Nada é cadastrado sem confirmação. A lista de compras permanece local ao navegador; os lançamentos financeiros e anexos usam Supabase.
