import { test, expect, type Page } from '@playwright/test';

const USER = '11111111-1111-4111-8111-111111111111';
const categories = [
  { id: '22222222-2222-4222-8222-222222222222', user_id: USER, workspace_id: null, name: 'Mercado', icon: 'ShoppingCart', color: '#b15c73', type: 'expense' },
  { id: '33333333-3333-4333-8333-333333333333', user_id: USER, workspace_id: null, name: 'Salário', icon: 'Wallet', color: '#4b70b9', type: 'income' },
];
async function backend(page: Page) {
  const state = { rows: [] as Record<string, unknown>[], writes: [] as Record<string, unknown>[], failRead: false, failWrite: false, notificationsEnabled: false };
  const session = { access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: USER, email: 'teste@example.com', aud: 'authenticated', role: 'authenticated' } };
  await page.addInitScript(() => localStorage.setItem('deu-bom:pwa-install-dismissed', 'true'));
  await page.route('https://supabase.test/**', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const reply = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname.endsWith('/token')) return reply(session);
    if (url.pathname.endsWith('/user')) return reply(session.user);
    if (url.pathname.endsWith('/logout')) return reply({});
    if (url.pathname.endsWith('/profiles')) return reply({ id: USER, current_workspace_id: null, display_name: 'Teste', email: 'teste@example.com', cycle_start_day: 1, currency: 'BRL', locale: 'pt-BR', notifications_enabled: state.notificationsEnabled });
    if (url.pathname.endsWith('/categories')) return reply(categories);
    if (url.pathname.endsWith('/transactions')) {
      if (req.method() === 'GET') return state.failRead ? reply({ message: 'denied' }, 403) : reply(state.rows);
      const input = req.postDataJSON(); state.writes.push(input);
      if (state.failWrite) return reply({ message: 'denied' }, 403);
      if (req.method() === 'POST') {
        const items = (Array.isArray(input) ? input : [input]).map((item) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...item }));
        state.rows.push(...items); return reply(items);
      }
      return reply([]);
    }
    return reply([]);
  });
  return state;
}
async function login(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email', { exact: true }).fill('teste@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('test-password');
  await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
}
async function theme(page: Page, name: string) {
  await page.getByRole('button', { name: 'Alterar tema' }).click();
  await page.getByRole('menuitemradio', { name, exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  if (name !== 'Sistema') await expect(page.locator('html')).toHaveClass(name === 'Escuro' ? /dark/ : /light/);
}
async function voice(page: Page) {
  await page.addInitScript(() => {
    class Recognition {
      lang = ''; interimResults = true; maxAlternatives = 1; continuous = false;
      onresult = null; onend = null; onerror = null;
      start() {
        Object.assign(window, { sendVoice: (text: string, final = true) => {
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: final })] });
          if (final) this.onend?.();
        }, denyVoice: () => { this.onerror?.({ error: 'not-allowed' }); this.onend?.(); } });
      }
      stop() { this.onend?.(); }
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
}

test('temas persistem, acompanham o sistema e mantêm legibilidade/mobile', async ({ page }, info) => {
  await backend(page); await login(page);
  for (const name of ['Claro', 'Escuro']) {
    await theme(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const a = page.getByRole('button', { name: 'Nova receita', exact: true });
    const b = page.getByRole('button', { name: 'Nova despesa', exact: true });
    const style = (el: HTMLElement) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color];
    expect(await a.evaluate(style)).toEqual(await b.evaluate(style));
    expect((await a.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `/tmp/deubom-correct-${info.project.name}-${name}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.reload(); await expect(page.locator('html')).toHaveClass(/dark/);
  await theme(page, 'Sistema');
  await page.emulateMedia({ colorScheme: 'light' }); await expect(page.locator('html')).toHaveClass(/light/);
  await page.emulateMedia({ colorScheme: 'dark' }); await expect(page.locator('html')).toHaveClass(/dark/);
});

test('formulário salva na API e restaura após recarga, sem botão Salvar duplicado', async ({ page }) => {
  const state = await backend(page); await login(page);
  await page.getByRole('button', { name: 'Nova receita', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nova transacao' });
  await expect(dialog.getByRole('button', { name: 'Receita', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByLabel('Descrição').fill('Receita mobile');
  await dialog.getByLabel('Valor', { exact: true }).fill('12345');
  await expect(dialog.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(state.writes.at(-1)).toMatchObject({ type: 'income', title: 'Receita mobile', amount: 123.45, workspace_id: null });
  await page.reload(); await expect(page.getByText('Receita mobile', { exact: true })).toBeVisible();
});

test('falha de gravação preserva os campos e falha de leitura não simula saldo zero', async ({ page }) => {
  const state = await backend(page); await login(page);
  await page.getByRole('button', { name: 'Nova despesa', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Descrição').fill('Preservar formulário');
  await page.getByRole('dialog').getByLabel('Valor', { exact: true }).fill('1000');
  state.failWrite = true;
  await page.getByRole('dialog').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Descrição')).toHaveValue('Preservar formulário');
  await page.getByRole('button', { name: 'Fechar formulário' }).click();
  state.failRead = true; await page.reload();
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  await expect(page.getByText('Saldo confirmado', { exact: true })).toHaveCount(0);
  state.failRead = false; await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByText('Saldo confirmado', { exact: true })).toBeVisible();
});

test('voz da tela inicial revisa o lançamento e altera o tema sem gravar automaticamente', async ({ page }) => {
  await voice(page); const state = await backend(page); await login(page);
  await page.getByRole('button', { name: 'Falar com o app' }).click();
  await page.evaluate(() => (window as unknown as { sendVoice: (text: string) => void }).sendVoice('despesa mercado 35,90 reais'));
  await page.getByRole('button', { name: 'Concluir fala', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Valor', { exact: true })).toHaveValue('35,90');
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Fechar formulário' }).click();
  await page.getByRole('button', { name: 'Falar com o app' }).click();
  await page.evaluate(() => (window as unknown as { sendVoice: (text: string) => void }).sendVoice('tema escuro'));
  await page.getByRole('button', { name: 'Concluir fala', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('voz parcial ou microfone negado não abre um lançamento', async ({ page }) => {
  await voice(page); await backend(page); await login(page);
  await page.getByRole('button', { name: 'Falar com o app' }).click();
  await page.evaluate(() => { const speech = window as unknown as { sendVoice: (text: string, final: boolean) => void; denyVoice: () => void }; speech.sendVoice('despesa mercado 45 reais', false); speech.denyVoice(); });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Permissao do microfone bloqueada. Libere o microfone no navegador.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Falar com o app' })).toHaveAttribute('aria-pressed', 'false');
});

test('atualização avisa sem recarregar formulários e permite adiar', async ({ page }) => {
  let changed = false;
  await page.route('**/version.json*', (route) => changed ? route.fulfill({ json: { version: 'next-release-test' } }) : route.continue());
  await backend(page); await login(page);
  await page.getByRole('button', { name: 'Nova despesa', exact: true }).click();
  await page.getByRole('dialog').getByLabel('Descrição').fill('Não perder');
  changed = true;
  await page.evaluate(() => { window.dispatchEvent(new Event('focus')); navigator.serviceWorker.dispatchEvent(new Event('controllerchange')); });
  await expect(page.getByText('Nova versão disponível')).toBeAttached();
  await expect(page.getByRole('dialog').getByLabel('Descrição')).toHaveValue('Não perder');
  await page.getByRole('button', { name: 'Fechar formulário' }).click();
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Atualizar app', exact: true }).click();
  await expect(page.getByText('Nova versão disponível')).toBeVisible();
  await page.getByRole('button', { name: 'Depois', exact: true }).click();
  await expect(page.getByText('Nova versão disponível')).toHaveCount(0);
});

test('páginas financeiras, compras e configurações não extrapolam a largura mobile', async ({ page }) => {
  await backend(page); await login(page);
  for (const name of ['Claro', 'Escuro']) {
    await theme(page, name);
    for (const path of ['/transactions', '/shopping-list', '/settings', '/analytics']) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Alterar tema' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

test('cores independentes do modo persistem e mantêm contraste em todas as paletas', async ({ page }) => {
  await backend(page); await login(page);
  const primaryColor = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--primary').trim());
  for (const mode of ['Claro', 'Escuro']) {
    await theme(page, mode);
    const seen = new Set<string>();
    for (const [id, name] of [['blue', 'Azul'], ['green', 'Verde'], ['purple', 'Roxo'], ['pink', 'Rosa']]) {
      await page.getByRole('button', { name: 'Alterar tema' }).click();
      await page.getByRole('menuitemradio', { name, exact: true }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
      await expect(page.locator('html')).toHaveAttribute('data-accent', id);
      seen.add(await primaryColor());
      const ratios = await page.evaluate(() => {
        const color = (value: string) => {
          const probe = document.createElement('span'); probe.style.color = value; document.body.append(probe);
          const rgb = getComputedStyle(probe).color.match(/[\d.]+/g)!.slice(0, 3).map(Number); probe.remove();
          const channels = rgb.map((n) => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
          return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
        };
        const ratio = (a: string, b: string) => { const x = color(a), y = color(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
        return [ratio('hsl(var(--primary))', 'hsl(var(--primary-foreground))'), ratio('hsl(var(--primary))', 'hsl(var(--card))')];
      });
      for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    expect(seen.size).toBe(4);
  }
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'pink');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.goto('/settings');
  await page.getByRole('navigation', { name: 'Seções das configurações' }).getByRole('button', { name: 'Aparência', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Rosa', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Azul', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
  await theme(page, 'Sistema');
  await page.emulateMedia({ colorScheme: 'light' });
  const light = await primaryColor();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(primaryColor).not.toBe(light);
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'blue');
});

test('início prioriza saldo e movimentos, preserva detalhes e filtra por mês', async ({ page }, info) => {
  const state = await backend(page);
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const row = { user_id: USER, workspace_id: null, created_at: now.toISOString(), updated_at: now.toISOString(), date: `${month}-15`, category_id: categories[0].id, is_recurring: false };
  state.rows.push(
    { ...row, id: 'a', type: 'income', title: 'Salário do mês', amount: 5000, status: 'completed', category_id: categories[1].id },
    { ...row, id: 'b', type: 'expense', title: 'Mercado da semana', amount: 200, status: 'completed' },
    { ...row, id: 'c', type: 'expense', title: 'Conta a pagar', amount: 300, status: 'pending' },
    { ...row, id: 'd', type: 'income', title: 'Reembolso pendente', amount: 100, status: 'pending', category_id: categories[1].id },
  );
  await login(page);
  const summary = page.getByRole('region', { name: 'Resumo do mês' });
  await expect(summary).toContainText('4.800,00');
  await expect(summary).toContainText('300,00');
  await expect(summary).toContainText('100,00');
  await expect(page.getByRole('heading', { name: 'Últimos movimentos' })).toBeVisible();
  expect((await page.getByRole('heading', { name: 'Últimos movimentos' }).boundingBox())!.y).toBeLessThan(800);
  const more = page.locator('details').filter({ hasText: 'Mais detalhes do mês' });
  await expect(more).not.toHaveAttribute('open');
  await more.locator('summary').click();
  await expect(more).toContainText('4.600,00');
  await expect(more).toContainText('Mercado');
  await more.locator('summary').click();
  for (const name of ['Claro', 'Escuro']) {
    await theme(page, name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => { document.documentElement.style.scrollBehavior = 'auto'; window.scrollTo(0, 0); });
    await expect(page.getByText('Login realizado com sucesso.', { exact: true })).toHaveCount(0);
    await page.screenshot({ path: `/tmp/deubom-appearance-${info.project.name}-${name}.png`, fullPage: true, animations: 'disabled' });
  }
  await page.getByRole('button', { name: 'Mês anterior', exact: true }).click();
  await expect(page.getByText('Nenhum lançamento neste mês')).toBeVisible();
  await expect(page.getByText('Mais detalhes do mês')).toHaveCount(0);
  await page.getByRole('button', { name: 'Próximo mês', exact: true }).click();
  await expect(page.getByText('Salário do mês', { exact: true })).toBeVisible();
  state.rows[0].amount = 1234567890123.45;
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('preferência inválida de cor usa padrão e escolha funciona sem armazenamento', async ({ page }) => {
  await backend(page);
  await page.addInitScript(() => {
    localStorage.setItem('app-accent', 'cor-inexistente');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) { if (key === 'app-accent') throw new DOMException('Blocked', 'SecurityError'); original.call(this, key, value); };
  });
  await login(page);
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'purple');
  await page.getByRole('button', { name: 'Alterar tema' }).click();
  await page.getByRole('menuitemradio', { name: 'Rosa', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'pink');
});

test('tour contextual completo em cada aba, com foco e possibilidade de reabrir', async ({ page }) => {
  await voice(page); const state = await backend(page); await login(page);
  for (const path of ['/', '/transactions', '/shopping-list', '/budgets', '/analytics', '/festometro', '/settings', '/more']) {
    await page.goto(path);
    const trigger = page.getByRole('button', { name: 'Como usar esta tela' });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('status')).toContainText('Passo 1 de');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(dialog.getByRole('button', { name: 'Voltar', exact: true })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Próximo', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('Passo 2 de');
    await dialog.getByRole('button', { name: 'Voltar', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('Passo 1 de');
    while (await dialog.getByRole('button', { name: 'Próximo', exact: true }).count()) await dialog.getByRole('button', { name: 'Próximo', exact: true }).click();
    await dialog.getByRole('button', { name: 'Concluir', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(dialog.getByRole('status')).toContainText('Passo 1 de');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  }
  expect(state.writes).toHaveLength(0);
});

test('navegação de celular e tablet usa página Mais e mantém todas as áreas acessíveis', async ({ page }) => {
  await backend(page); await login(page);
  const compact = page.viewportSize()!.width < 1280;
  const bottom = page.getByRole('navigation', { name: 'Navegação principal', exact: true });
  const desktop = page.getByRole('navigation', { name: 'Navegação principal desktop', exact: true });
  if (compact) {
    await expect(bottom).toBeVisible(); await expect(desktop).toBeHidden();
    await bottom.getByRole('link', { name: 'Mais', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mais opções', exact: true })).toBeVisible();
    const areas = page.getByRole('navigation', { name: 'Todas as áreas' });
    await expect(areas.getByRole('link')).toHaveCount(7);
    await areas.getByRole('link', { name: /Metas/ }).click();
    await expect(page).toHaveURL(/\/budgets$/);
    await expect(bottom.getByRole('link', { name: 'Mais', exact: true })).toHaveClass(/text-primary/);
    await page.getByRole('link', { name: 'Mais opções e configurações' }).click();
    await page.getByRole('navigation', { name: 'Todas as áreas' }).getByRole('link', { name: /Configurações/ }).click();
    await expect(page).toHaveURL(/\/settings$/);
  } else {
    await expect(bottom).toHaveCount(0); await expect(desktop).toBeVisible();
    await desktop.getByRole('link', { name: 'Metas', exact: true }).click();
    await expect(page).toHaveURL(/\/budgets$/);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('microfone do cabeçalho respeita a aba e cancela ao abrir ajuda ou navegar', async ({ page }) => {
  await voice(page); const state = await backend(page); await login(page);
  const toolbar = page.locator('.app-toolbar');
  await expect(toolbar.getByRole('button', { name: 'Falar com o app' })).toBeVisible();
  await page.goto('/shopping-list');
  await toolbar.getByRole('button', { name: 'Falar com o app' }).click();
  await page.evaluate(() => (window as unknown as { sendVoice: (text: string) => void }).sendVoice('cinco unidades de detergente por 5 reais'));
  await page.getByRole('button', { name: 'Concluir fala', exact: true }).click();
  await expect(page.getByLabel('Item', { exact: true })).toHaveValue(/detergente/i);
  await expect(page.getByRole('button', { name: 'Confirmar e adicionar', exact: true })).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.goto('/analytics');
  await toolbar.getByRole('button', { name: 'Falar com o app' }).click();
  await page.evaluate(() => (window as unknown as { sendVoice: (text: string) => void }).sendVoice('despesa mercado 45 reais'));
  await page.getByRole('button', { name: 'Concluir fala', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Valor', { exact: true })).toHaveValue('45,00');
  await page.getByRole('button', { name: 'Fechar formulário' }).click();
  await toolbar.getByRole('button', { name: 'Falar com o app' }).click();
  await toolbar.getByRole('button', { name: 'Como usar esta tela' }).click();
  await page.getByRole('button', { name: 'Fechar tutorial' }).click();
  await expect(toolbar.getByRole('button', { name: 'Falar com o app' })).toHaveAttribute('aria-pressed', 'false');
  await toolbar.getByRole('button', { name: 'Falar com o app' }).click();
  await page.goto('/');
  await expect(toolbar.getByRole('button', { name: 'Falar com o app' })).toHaveAttribute('aria-pressed', 'false');
  expect(state.writes).toHaveLength(0);
});

test('configurações mostram uma seção por vez e perfil é acessível sem cobrir navegação', async ({ page }) => {
  await backend(page); await login(page); await page.goto('/settings');
  const sections = page.getByRole('navigation', { name: 'Seções das configurações' });
  await expect(sections.getByRole('button', { name: 'Perfil', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Exportar JSON', exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Editar meu perfil', exact: true }).click();
  const profile = page.getByRole('dialog', { name: 'Editar meu perfil', exact: true });
  await expect(profile.getByLabel('Nome', { exact: true })).toBeVisible();
  await expect(profile.getByLabel('Email', { exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(profile).toHaveCount(0);
  for (const name of ['Equipe', 'Aparência', 'Dados', 'Perfil']) {
    await sections.getByRole('button', { name, exact: true }).click();
    await expect(sections.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (name === 'Aparência') await expect(page.getByRole('button', { name: 'Rosa', exact: true })).toBeVisible();
    if (name === 'Dados') await expect(page.getByRole('button', { name: /Exportar JSON/ })).toBeVisible();
  }
});

test('voz junta frases separadas e aguarda seis segundos de pausa antes de preparar o cadastro', async ({ page }) => {
  await voice(page); const state = await backend(page); await login(page);
  await page.getByRole('button', { name: 'Falar com o app' }).click();
  await page.clock.install();
  await page.evaluate(() => (window as unknown as { sendVoice: (text: string) => void }).sendVoice('receita três mil reais'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.fastForward(4000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { sendVoice: (text: string) => void }).sendVoice('salário dia cinco de novembro de 2026 repetir doze vezes'));
  await page.clock.fastForward(5000);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.fastForward(1200);
  const dialog = page.getByRole('dialog', { name: 'Nova transacao' });
  await expect(dialog.getByLabel('Descrição')).toHaveValue('salario');
  await expect(dialog.getByLabel('Valor', { exact: true })).toHaveValue('36.000,00');
  await expect(dialog.locator('input[type="date"]').first()).toHaveValue('2026-11-05');
  expect(state.writes).toHaveLength(0);
});

test('cor escolhida também acompanha seleção e salvar nos modais de cadastro', async ({ page }) => {
  await backend(page); await login(page);
  for (const mode of ['Claro', 'Escuro']) {
    await theme(page, mode);
    for (const color of ['Azul', 'Verde', 'Roxo', 'Rosa']) {
      await page.getByRole('button', { name: 'Alterar tema' }).click();
      await page.getByRole('menuitemradio', { name: color, exact: true }).click();
      await page.getByRole('button', { name: 'Nova despesa', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Nova transacao' });
      await dialog.getByLabel('Descrição').fill('Teste paleta');
      await dialog.getByLabel('Valor', { exact: true }).fill('1000');
      const selected = dialog.getByRole('button', { name: 'Despesa', exact: true });
      const save = dialog.getByRole('button', { name: 'Salvar', exact: true });
      const style = (el: HTMLElement) => [getComputedStyle(el).backgroundColor, getComputedStyle(el).color];
      expect(await selected.evaluate(style)).toEqual(await save.evaluate(style));
      const expense = await save.evaluate(style);
      await dialog.getByRole('button', { name: 'Receita', exact: true }).click();
      await expect(dialog.getByRole('button', { name: 'Receita', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => dialog.getByRole('button', { name: 'Receita', exact: true }).evaluate(style)).toEqual(expense);
      expect(await save.evaluate(style)).toEqual(expense);
      await page.getByRole('button', { name: 'Fechar formulário' }).click();
    }
  }
});

test('Agenda informa configuração ausente sem simular conexão Google', async ({ page }) => {
  await backend(page);
  let syncCalls = 0;
  await page.route('**/api/google/**', async (route) => {
    expect(route.request().headers().authorization).toBe('Bearer test-token');
    if (route.request().url().endsWith('/sync')) syncCalls += 1;
    return route.fulfill({ json: { configured: false, connected: false } });
  });
  await login(page); await page.goto('/settings');
  await page.getByRole('navigation', { name: 'Seções das configurações' }).getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByText('Integração aguardando configuração', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Conectar Google', exact: true })).toBeDisabled();
  expect(syncCalls).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Agenda sincroniza conclusão do Google, atualiza o saldo e permite desconectar', async ({ page }) => {
  const state = await backend(page); const now = new Date(); let complete = false; let calls = 0;
  state.rows.push({ id: 'google-row', user_id: USER, workspace_id: null, title: 'Conta Google', amount: 300, type: 'expense', date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`, status: 'pending', category_id: categories[0].id, created_at: now.toISOString(), updated_at: now.toISOString(), is_recurring: false });
  await page.route('**/api/google/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/status')) return route.fulfill({ json: { configured: true, connected: true, accountEmail: 'google@example.test' } });
    if (path.endsWith('/disconnect')) return route.fulfill({ json: { connected: false } });
    if (path.endsWith('/sync')) {
      calls += 1; const changed = complete; complete = false;
      if (changed) { state.rows[0].status = 'completed'; state.rows[0].updated_at = new Date().toISOString(); }
      return route.fulfill({ json: { processed: 1, remaining: 0, completed: changed ? 1 : 0, updated: changed ? 1 : 0, errors: 0, syncAt: new Date().toISOString() } });
    }
    return route.fulfill({ status: 500, json: { error: 'Unexpected route' } });
  });
  await login(page);
  await expect.poll(() => calls).toBeGreaterThan(0);
  await page.goto('/settings');
  await page.getByRole('navigation', { name: 'Seções das configurações' }).getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByText('Google conectado', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sincronizar agora', exact: true })).toBeEnabled();
  complete = true;
  await page.getByRole('button', { name: 'Sincronizar agora', exact: true }).click();
  await expect.poll(() => state.rows[0].status).toBe('completed');
  await expect(page.getByRole('button', { name: 'Sincronizar agora', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Desconectar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Conectar Google', exact: true })).toBeEnabled();
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Resumo do mês' })).toContainText('-R$');
  expect(state.writes).toHaveLength(0);
});

test('lembretes mostram despesas de hoje e próximos vencimentos uma vez por dia', async ({ page }) => {
  const state = await backend(page); state.notificationsEnabled = true;
  const now = new Date(); const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  state.rows.push({ id: 'due-today', user_id: USER, workspace_id: null, title: 'Vence hoje', amount: 100, type: 'expense', date: day, status: 'pending', category_id: categories[0].id, created_at: now.toISOString(), updated_at: now.toISOString(), is_recurring: false });
  await login(page);
  await expect(page.getByText('1 despesa(s) vencem hoje', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
  await expect(page.getByText('1 despesa(s) vencem hoje', { exact: true })).toHaveCount(0);
});
