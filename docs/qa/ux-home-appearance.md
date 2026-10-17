# Revisão UX: início, aparência e orientação

Objetivo: permitir entender o mês e registrar um movimento rapidamente, com menos blocos concorrendo pela atenção.

## Decisões

- Cabeçalho curto, seletor de mês e saldo confirmado dominante.
- A pagar e A receber compactos; receitas e despesas com o mesmo estilo de ação.
- Microfone acessível no cabeçalho, sem um card permanente de instruções antes do saldo. Abrir a ajuda cancela a escuta em andamento.
- Movimentos recentes antes de análises secundárias; detalhes financeiros permanecem disponíveis.
- Cor de destaque independente do modo claro/escuro/sistema. Não transformar receita, despesa e erro em preferências decorativas.
- Nos formulários, a cor selecionada governa Salvar, foco e seleções ativas, incluindo Despesa/Receita, situação e categoria. Os nomes explicam o significado financeiro; uma seleção ativa não deve conservar um acento fixo de receita/despesa.
- As cores cadastradas para categorias permanecem nos respectivos ícones e amostras; a moldura de seleção segue a cor do sistema. Alertas reais e exclusão mantêm os tokens semânticos de aviso/erro/destruição.
- Todos os recursos acessíveis por Mais no celular/tablet até 1279px, sem exigir a barra lateral. A barra lateral fica restrita a desktop a partir de 1280px.
- Interrogação no topo abre guia contextual: passos curtos, Voltar/Próximo/Concluir, fechamento e reinício. O guia não altera dados nem aciona operações descritas.

## Paletas implementadas

Contraste calculado pela fórmula WCAG para os tokens HSL reais de `src/utils/appearance.ts`, antes de considerar transparências ou estados de interação. O texto sobre a primária usa branco no claro e `hsl(250 30% 12%)` no escuro, conforme `useTheme.tsx`.

| Cor | Claro, HSL | Razão | Escuro, HSL | Razão |
|---|---|---:|---|---:|
| Azul | `217 70% 42%` | 6,59:1 | `217 90% 78%` | 9,11:1 |
| Verde | `153 55% 28%` | 6,13:1 | `153 50% 68%` | 10,39:1 |
| Roxo | `258 43% 49%` | 6,69:1 | `258 78% 76%` | 6,95:1 |
| Rosa | `333 50% 40%` | 7,00:1 | `333 80% 82%` | 9,93:1 |

Todos esses pares excedem AA para texto normal. Rosa claro com texto branco não é recomendado. As amostras precisam de nomes e marca de seleção; cor sozinha não indica estado.

## Pontos de validação

- Larguras de 320px, celular e tablet até 1279px: ações com alvo mínimo de 44px, navegação inferior e acesso a Mais, sem rolagem horizontal. Em 1280px, validar a transição para a barra lateral.
- Preferência de cor preservada, modo do sistema reativo e combinações claro/escuro verificadas.
- Guia modal com rolagem em telas baixas, foco contido, Escape, retorno do foco e anúncio do progresso.
- Cada rota tem conteúdo específico; trocar de rota fecha e reinicia a ajuda.
- Tutorial de compras explicita armazenamento neste navegador, sem prometer sincronização entre dispositivos.
- Metas de compra não são despesas automáticas; convite de evento não indica pagamento confirmado.
- Recuperação de senha e convites dependem da validade do link e das permissões reais.

Revisão baseada no código das telas existentes e no contexto WDS do repositório, sem alterar regras financeiras ou persistência.
