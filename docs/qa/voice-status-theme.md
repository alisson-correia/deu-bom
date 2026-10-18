# Voz, status e tema global — 18/10/2026

O reconhecimento reconstrói cada snapshot de resultados e descarta índices antigos. Eventos atrasados de um reconhecedor encerrado são ignorados; os trechos finais e os reinícios são unidos sem repetir sobreposições. Repetições dentro de uma mesma frase são preservadas. Isso corrige a montagem da transcrição, sem reescrever descrições já salvas pelo usuário.

O controle de status fica dentro do cartão, junto ao rótulo. Marcado corresponde a completed (Pago/Recebido); desmarcado a pending. O alvo da alteração é explícito e é preservado durante a confirmação de escopo das recorrências. O controle aguarda a resposta da API e mantém o estado anterior quando a gravação falha. A faixa lateral e o rótulo redundante foram removidos.

A paleta atual controla ícones de categorias existentes, bordas, superfícies, textos gerais, menus, navegação, formulários e indicadores de categoria. Aumentou-se moderadamente a saturação das paletas coloridas; Preto e tons neutros continuam disponíveis. A aplicação usa variáveis CSS atuais, sem gravar novas cores nas transações ou categorias.

Os significados financeiros são preservados: verde para positivo/receita/a receber, vermelho para negativo/despesa/a pagar, âmbar para pendências e a cor escolhida para o balanço neutro e destaques gerais. Os gráficos distinguem receitas, despesas e balanço. A barra de cor do navegador acompanha o fundo atual.

A validação inclui snapshots cumulativos, índices removidos, repetição de callbacks após encerramento, pagamento e reversão com persistência simulada, falha de gravação, cartões antigos após troca de paleta e navegação por todas as oito páginas em claro/escuro. O contraste das 24 paletas continua sendo verificado. Testes de voz simulam a API do navegador; não substituem um teste acústico em aparelho físico.
