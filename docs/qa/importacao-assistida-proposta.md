# Proposta: importar dívidas por texto, imagem ou áudio

Recurso proposto, ainda não implementado nesta entrega visual.

## Fluxo recomendado

1. Abrir **Importar com ajuda** em Dados ou Finanças.
2. Colar uma lista, enviar foto/print ou gravar/enviar áudio.
3. Extrair uma prévia tabular: descrição, valor, tipo, vencimento, situação, quantidade e número da parcela, recorrência, observações e categoria sugerida.
4. Sinalizar campos ausentes ou ambíguos. Distinguir valor total de valor por parcela e pedir confirmação quando isso não estiver claro. Datas relativas devem usar o fuso e a data escolhidos pelo usuário.
5. Comparar com registros existentes e alertar possíveis duplicatas, permitindo corrigir ou desmarcar linhas.
6. Mostrar o total e as datas de todas as parcelas antes da confirmação. Salvar somente os itens aprovados, informar resultados parciais e permitir corrigir falhas sem reenviar o lote inteiro.

Vencimento de uma dívida e validade de um documento são informações diferentes. Não inferir juros, multas, data de vencimento ou pagamento concluído quando o material não informar. Proposta começa com vencimento e parcelas já suportados pelo formulário; novos campos exigem contratos de dados explícitos.

## Implementação em etapas

- **Texto colado:** entrega mais rápida, barata e fácil de corrigir. Reconhecer colunas e padrões antes de recorrer à IA.
- **Foto ou print:** OCR ou modelo com visão no servidor, retornando dados estruturados validados. Manter a imagem ao lado da prévia durante a revisão.
- **Áudio:** reaproveitar voz ao vivo quando disponível; upload de gravações exige serviço de transcrição. Usar a mesma revisão de lote.
- **Documentos com várias páginas:** depois de validar os casos simples; limitar páginas, tamanho e duração desde o primeiro serviço.

## Requisitos para a implementação

Endpoint autenticado no servidor, validação dos campos, autorização por usuário/workspace e confirmação explícita do lote. A chave de IA fica no servidor, nunca em variável VITE_ ou no JavaScript do navegador. Controlar quantidade de solicitações e custo por usuário. Informar o envio do material ao provedor e definir retenção/exclusão dos arquivos. Conteúdo de imagem/texto/áudio é dado: não deve executar instruções nem operações do app.

Critérios de teste: parcelas e totais coerentes, formatos brasileiros, datas incertas, imagem ilegível, duplicata, falha parcial, arquivos inválidos, isolamento entre equipes e recuperação após interrupção. A extração ajuda a preencher; a revisão continua necessária.
