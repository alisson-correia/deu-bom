import { test, expect, type Page } from '@playwright/test';

const USER = '11111111-1111-4111-8111-111111111111';
const categories = [
  { id: '22222222-2222-4222-8222-222222222222', user_id: USER, workspace_id: null, name: 'Mercado', icon: 'ShoppingCart', color: '#b15c73', type: 'expense' },
  { id: '33333333-3333-4333-8333-333333333333', user_id: USER, workspace_id: null, name: 'Salário', icon: 'Wallet', color: '#4b70b9', type: 'income' },
];
async function backend(page: Page) {
  const state = { rows: [] as Record<string, unknown>[], writes: [] as Record<string, unknown>[], failRead: false, failWrite: false };
  const session = { access_token: 'test-token', refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: USER, email: 'teste@example.com', aud: 'authenticated', role: 'authenticated' } };
  await page.addInitScript(() => localStorage.setItem('deu-bom:pwa-install-dismissed', 'true'));
  await page.route('https://supabase.test/**', async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const reply = (value: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname.endsWith('/token')) return reply(session);
    if (url.pathname.endsWith('/user')) return reply(session.user);
    if (url.pathname.endsWith('/logout')) return reply({});
    if (url.pathname.endsWith('/profiles')) return reply({ id: USER, current_workspace_id: null, display_name: 'Teste', email: 'teste@example.com', cycle_start_day: 1, currency: 'BRL', locale: 'pt-BR', notifications_enabled: false });
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
  await expect(page.getByRole('heading', { name: 'Como esta sua grana agora', exact: true })).toBeVisible();
}
async function theme(page: Page, name: string) {
  await page.getByRole('button', { name: 'Alterar tema' }).click();
  await page.getByRole('menuitemradio', { name, exact: true }).click();
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
    await page.screenshot({ path: `/tmp/deubom-correct-${info.project.name}-${name}.png`, fullPage: true });
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
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog').getByLabel('Valor', { exact: true })).toHaveValue('35,90');
  expect(state.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Fechar formulário' }).click();
  await page.getByRole('button', { name: 'Falar com o app' }).click();
  await page.evaluate(() => (window as unknown as { sendVoice: (text: string) => void }).sendVoice('tema escuro'));
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
