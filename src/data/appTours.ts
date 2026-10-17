export interface AppTourStep {
  title: string;
  description: string;
  cue: string;
}

export interface AppTourDefinition {
  title: string;
  steps: AppTourStep[];
}

export const appTours: Record<string, AppTourDefinition> = {
  '/': {
    title: 'Sua visão geral',
    steps: [
      { title: 'Escolha o mês', description: 'Use as setas do mês para consultar o período desejado. Os valores e movimentos acompanham essa seleção.', cue: 'Mês → Resumo' },
      { title: 'Entenda seu saldo', description: 'O saldo confirmado considera os lançamentos concluídos. A pagar e A receber mostram o que ainda está pendente.', cue: 'Confirmado ≠ Pendente' },
      { title: 'Registre um movimento', description: 'Escolha Despesa ou Receita para preencher o lançamento. Pelo microfone, diga o que deseja registrar e revise os dados antes de salvar.', cue: 'Registrar → Revisar → Salvar' },
      { title: 'Acompanhe os recentes', description: 'Toque em um movimento para editar. Use Ver todos para consultar a lista completa e seus filtros.', cue: 'Recentes → Ver todos' },
    ],
  },
  '/transactions': {
    title: 'Seus lançamentos',
    steps: [
      { title: 'Encontre o que procura', description: 'Selecione o mês e use a busca e os filtros para encontrar receitas, despesas e pendências.', cue: 'Período → Filtros → Lista' },
      { title: 'Confira antes de salvar', description: 'Ao criar ou editar, confira valor, categoria, data e situação. Pendente e concluído têm efeitos diferentes no saldo confirmado.', cue: 'Valor · Data · Situação' },
      { title: 'Cuide das séries', description: 'Em lançamentos recorrentes ou parcelados, leia o alcance oferecido antes de confirmar uma alteração ou exclusão.', cue: 'Um lançamento ou uma série?' },
    ],
  },
  '/shopping-list': {
    title: 'Sua lista de compras',
    steps: [
      { title: 'Monte sua lista', description: 'Adicione o nome do item, a quantidade e, se quiser, o preço para acompanhar a previsão de gasto.', cue: 'Item + Quantidade + Preço' },
      { title: 'Experimente a voz', description: 'Toque no microfone, permita o acesso se solicitado e revise o item reconhecido antes de adicioná-lo.', cue: 'Falar → Conferir → Adicionar' },
      { title: 'Marque durante a compra', description: 'Marque os itens conforme comprar e ajuste os preços quando necessário. A lista fica salva neste navegador; ela não é sincronizada com outros dispositivos.', cue: 'Lista salva neste navegador' },
    ],
  },
  '/festometro': {
    title: 'Eventos e rateios',
    steps: [
      { title: 'Planeje um evento', description: 'Use Novo evento para começar. Preencha os dados do encontro e confira as opções de estimativa disponíveis.', cue: 'Evento → Planejamento' },
      { title: 'Organize participantes e itens', description: 'Abra o evento para consultar participantes, itens e valores. As ações de edição dependem da sua permissão.', cue: 'Participantes + Itens' },
      { title: 'Acompanhe os pagamentos', description: 'Confira o rateio e a situação dos pagamentos antes de alterá-los. Um convite não confirma que alguém já pagou.', cue: 'Rateio → Conferência' },
    ],
  },
  '/budgets': {
    title: 'Metas de compra',
    steps: [
      { title: 'Defina o que quer comprar', description: 'Crie uma meta com nome, valor e planejamento. Esta tela organiza compras futuras, sem registrar uma despesa automaticamente.', cue: 'Objetivo → Valor → Prazo' },
      { title: 'Revise suas possibilidades', description: 'Consulte os valores e a janela de compra apresentados para decidir quando a compra faz sentido no seu planejamento.', cue: 'Planejar antes de comprar' },
      { title: 'Mantenha as metas atuais', description: 'Edite uma meta quando seus planos mudarem. Excluir a meta remove esse planejamento; confira antes de confirmar.', cue: 'Revisar → Atualizar' },
    ],
  },
  '/analytics': {
    title: 'Análise financeira',
    steps: [
      { title: 'Escolha o recorte', description: 'Ajuste o período e os filtros disponíveis. Os números e gráficos mostram os lançamentos que atendem a esse recorte.', cue: 'Filtros → Resultados' },
      { title: 'Compare os movimentos', description: 'Observe receitas, despesas e a evolução mensal. Confira também as categorias com maior participação nas despesas.', cue: 'Evolução · Categorias' },
      { title: 'Interprete os dados', description: 'Se não houver resultados, revise os filtros ou registre lançamentos. Os gráficos refletem seus dados; não são uma garantia de saldo futuro.', cue: 'Dados registrados → Análise' },
    ],
  },
  '/settings': {
    title: 'Suas configurações',
    steps: [
      { title: 'Confira o contexto da equipe', description: 'Abra a seção Equipe para ver o workspace ativo e as opções de acesso. Trocar de workspace muda o conjunto de dados financeiros exibido.', cue: 'Workspace → Dados da equipe' },
      { title: 'Personalize a aparência', description: 'Abra Aparência para escolher claro, escuro ou o padrão do sistema e sua cor de destaque. A aparência fica salva neste navegador.', cue: 'Modo + Cor de destaque' },
      { title: 'Conecte sua agenda', description: 'Abra Agenda para autorizar sua conta Google e sincronizar tarefas e lembretes. Se a integração ainda não estiver configurada, o painel informa isso sem impedir o uso do app.', cue: 'Agenda → Conectar Google' },
      { title: 'Cuide dos seus dados', description: 'Use Perfil para sua conta e Dados para importar, exportar ou limpar informações. Leia as confirmações com atenção antes de excluir informações ou realizar ações permanentes.', cue: 'Conferir antes de confirmar' },
    ],
  },
  '/more': {
    title: 'Todos os recursos',
    steps: [
      { title: 'Encontre cada área', description: 'Esta tela reúne os atalhos para as áreas do app. Toque no recurso desejado para abrir sua página.', cue: 'Mais → Escolha uma área' },
      { title: 'Navegue com facilidade', description: 'No celular e tablet, a barra inferior dá acesso às áreas principais e ao menu Mais. A ajuda no topo explica a tela que você estiver usando.', cue: 'Navegação → Ajuda da tela' },
    ],
  },
  '/auth': {
    title: 'Acesso à sua conta',
    steps: [
      { title: 'Entre ou crie sua conta', description: 'Use seu email e senha para entrar. Para começar, escolha o cadastro e preencha os campos solicitados.', cue: 'Entrar ou Cadastrar' },
      { title: 'Confira seu email', description: 'Se o cadastro pedir confirmação, abra a mensagem recebida. Use a recuperação de senha se já tiver conta e não lembrar a senha.', cue: 'Email → Confirmação' },
    ],
  },
  '/auth/confirm': {
    title: 'Confirmação de email',
    steps: [
      { title: 'Aguarde a confirmação', description: 'Esta página verifica o link recebido por email. Leia a mensagem exibida para saber se a confirmação foi concluída.', cue: 'Link → Verificação' },
      { title: 'Continue pelo resultado', description: 'Use a ação apresentada para continuar. Se o link estiver inválido, volte ao acesso e solicite um novo quando essa opção estiver disponível.', cue: 'Resultado → Próximo acesso' },
    ],
  },
  '/accept-invite': {
    title: 'Convite para colaborar',
    steps: [
      { title: 'Confira o convite', description: 'Leia o nome da equipe e a função oferecida. Confirme que reconhece o convite antes de continuar.', cue: 'Equipe + Permissão' },
      { title: 'Use o email convidado', description: 'Entre ou crie uma conta com o email do convite. A página apresenta o resultado da aceitação; se houver erro, siga as opções exibidas.', cue: 'Email correto → Acesso à equipe' },
    ],
  },
  '/calendar-event': {
    title: 'Convite da agenda',
    steps: [
      { title: 'Abra o arquivo da agenda', description: 'Esta tela gera um arquivo de calendário. Abra o arquivo baixado no aplicativo de agenda que você utiliza.', cue: 'Arquivo → Seu calendário' },
      { title: 'Confira antes de adicionar', description: 'Verifique data, horário e título no calendário antes de salvar. Se precisar, use Gerar convite da agenda para baixar novamente.', cue: 'Conferir → Adicionar à agenda' },
    ],
  },
  '/reset-password': {
    title: 'Redefinição de senha',
    steps: [
      { title: 'Use um link válido', description: 'Abra esta página pelo link de recuperação recebido por email. Se ele estiver inválido ou expirado, solicite outro pela tela de acesso.', cue: 'Email de recuperação → Link' },
      { title: 'Escolha sua nova senha', description: 'Preencha os campos solicitados e confirme a alteração. Aguarde a mensagem de sucesso antes de voltar a entrar.', cue: 'Nova senha → Confirmação' },
    ],
  },
};

export const fallbackAppTour: AppTourDefinition = {
  title: 'Ajuda do app',
  steps: [
    { title: 'Encontre sua área', description: 'Use a navegação do app para voltar a uma área conhecida. Em uma página não encontrada, utilize a opção de retorno exibida.', cue: 'Navegação → Início' },
    { title: 'Ajuda em cada tela', description: 'O botão de interrogação apresenta um passo a passo da página atual. Você pode fechar e reabrir a ajuda quando precisar.', cue: '? → Guia da tela' },
  ],
};
