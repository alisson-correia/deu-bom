import type { TransactionType } from '@/types/finance';

export type ParsedVoiceCommand =
  | {
      kind: 'transaction';
      action: 'add';
      type: TransactionType;
      title: string;
      amount: number;
      recurrenceType: 'none' | 'installment' | 'subscription';
      installmentCount?: number;
      dayOfMonth?: number;
      date?: string;
    }
  | {
      kind: 'shopping';
      action: 'add';
      name: string;
      quantity: number;
      unit: string;
      estimatedPrice: number;
    };

interface ParseVoiceCommandOptions {
  preferredKind?: 'transaction' | 'shopping';
}

const numberWords: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezassete: 17,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
  cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400,
  quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};

const unitAliases: Record<string, string> = {
  unidades: 'un',
  unidade: 'un',
  un: 'un',
  kg: 'kg',
  quilo: 'kg',
  quilos: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  pacote: 'pacote',
  pacotes: 'pacote',
  litro: 'l',
  litros: 'l',
  l: 'l',
  caixa: 'caixa',
  caixas: 'caixa',
  garrafa: 'garrafa',
  garrafas: 'garrafa',
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const spokenNumberPattern = `(?:${Object.keys(numberWords).map(normalize).join('|')}|mil|milhao|milhoes)`;
const spokenPhrasePattern = `${spokenNumberPattern}(?:\\s+(?:e\\s+)?${spokenNumberPattern})*`;
const spokenNumber = (phrase: string) => {
  let total = 0, group = 0;
  for (const word of phrase.split(/\s+/)) {
    if (word === 'e') continue;
    if (word === 'mil') { group = (group || 1) * 1000; continue; }
    if (word === 'milhao' || word === 'milhoes') { total += (group || 1) * 1000000; group = 0; continue; }
    group += numberWords[word] || 0;
  }
  return total + group;
};
const normalizeSpokenNumbers = (text: string) => normalize(text)
  .replace(new RegExp(`\\b(${spokenPhrasePattern})\\s+(reais|real|vezes|meses|parcelas)\\b`, 'g'), (_match, phrase: string, unit: string) => `${spokenNumber(phrase)} ${unit}`)
  .replace(new RegExp(`\\bdia\\s+(${spokenPhrasePattern})\\b`, 'g'), (_match, phrase: string) => `dia ${spokenNumber(phrase)}`);

const months = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const namedDatePattern = `\\bdia\\s+(\\d{1,2})\\s+(?:de\\s+)?(${months.join('|')})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`;
const numericDatePattern = String.raw`\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?\b`;
const parseExplicitDate = (text: string): string | null | undefined => {
  const named = text.match(new RegExp(namedDatePattern));
  const numeric = text.match(new RegExp(numericDatePattern));
  if (!named && !numeric) return undefined;
  const day = Number((named || numeric)![1]);
  const month = named ? months.indexOf(named[2]) + 1 : Number(numeric![2]);
  const year = Number((named || numeric)![3] || new Date().getFullYear());
  const date = new Date(year, month - 1, day);
  if (year < 1900 || date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const numericPattern = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?`;

const parseNumericToken = (value: string) => {
  const normalized = value.trim();

  if (normalized.includes(',')) {
    return Number(normalized.replace(/\./g, '').replace(',', '.'));
  }

  if (/^\d+\.\d{3}$/.test(normalized)) {
    return Number(normalized.replace(/\./g, ''));
  }

  return Number(normalized.replace(',', '.'));
};

const parseAmount = (text: string) => {
  const normalizedText = normalize(text)
    .replace(/\br\s*\$\b/g, 'r$')
    .replace(/\br\s+(\d)/g, 'r$ $1');

  const installmentAmount = normalizedText.match(
    new RegExp(`\\b\\d+\\s*x\\s+de\\s+(${numericPattern})\\b`, 'i')
  );
  if (installmentAmount) return parseNumericToken(installmentAmount[1]);

  const match = normalizedText.match(
    new RegExp(`(?:r\\$|reais|real|valor|por|custa|preco|preço)\\s*(${numericPattern})`, 'i')
  );
  if (!match) {
    const looseMatch = normalizedText.match(
      new RegExp(`\\b(${numericPattern})\\s*(?:reais|real)\\b`, 'i')
    );
    if (looseMatch) return parseNumericToken(looseMatch[1]);

    const candidates = Array.from(
      normalizedText.matchAll(new RegExp(`\\b(${numericPattern})\\b`, 'gi'))
    )
      .filter((candidate) => {
        const index = candidate.index || 0;
        const before = normalizedText.slice(Math.max(0, index - 8), index);
        const after = normalizedText.slice(index + candidate[0].length, index + candidate[0].length + 3);
        if (/\bdi(?:a)?\s*$/i.test(before)) return false;
        if (/^\s*x/i.test(after)) return false;
        return true;
      })
      .map((candidate) => parseNumericToken(candidate[1]))
      .filter((candidate) => Number.isFinite(candidate) && candidate > 0);

    return candidates.length > 0 ? Math.max(...candidates) : 0;
  }

  return parseNumericToken(match[1]);
};

const unitPattern = Object.keys(unitAliases).join('|');
const numberWordPattern = Object.keys(numberWords).join('|');

const parseSpokenNumber = (value?: string) => {
  if (!value) return null;
  const normalized = normalize(value);
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return numberWords[normalized] ?? null;
};

const parseShoppingQuantity = (normalized: string) => {
  const quantityWithUnit = normalized.match(
    new RegExp(`\\b(\\d+|${numberWordPattern})\\s+(${unitPattern})\\b`, 'i')
  );

  if (quantityWithUnit) {
    return {
      quantity: parseSpokenNumber(quantityWithUnit[1]) || 1,
      unit: unitAliases[quantityWithUnit[2]] || 'un',
      raw: quantityWithUnit[0],
    };
  }

  const leadingQuantity = normalized.match(new RegExp(`^(?:adicionar|add|inserir|colocar)?\\s*(\\d+|${numberWordPattern})\\b`, 'i'));

  if (leadingQuantity) {
    return {
      quantity: parseSpokenNumber(leadingQuantity[1]) || 1,
      unit: 'un',
      raw: leadingQuantity[1],
    };
  }

  const trailingQuantity = normalized.match(new RegExp(`\\b(\\d+|${numberWordPattern})$`, 'i'));

  if (trailingQuantity) {
    return {
      quantity: parseSpokenNumber(trailingQuantity[1]) || 1,
      unit: 'un',
      raw: trailingQuantity[1],
    };
  }

  return {
    quantity: 1,
    unit: 'un',
    raw: '',
  };
};

const stripPriceFragments = (value: string) =>
  value
    .replace(/\b(?:por|valor|custa|preco|preço)\s*(?:r\s*\$|reais|real)?\s*\d+(?:[,.]\d{1,2})?\b/gi, ' ')
    .replace(/\b(?:r\s*\$)\s*\d+(?:[,.]\d{1,2})?\b/gi, ' ')
    .replace(/\b\d+(?:[,.]\d{1,2})?\s*(?:reais|real)\b/gi, ' ');

const removeFirstOccurrence = (value: string, target: string) => {
  if (!target) return value;
  return value.replace(new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), ' ');
};

const parseDayOfMonth = (normalized: string) => {
  const match = normalized.match(/\bdi(?:a)?\s+(\d{1,2})\b/i);
  if (!match) return undefined;

  const day = Number(match[1]);
  return day >= 1 && day <= 31 ? day : undefined;
};

const parseInstallments = (normalized: string) => {
  const match = normalized.match(/\b(\d{1,3})\s*x\b/i)
    || normalized.match(/\b(?:repetir|repete|repetindo)(?:\s+mensalmente)?(?:\s+por)?\s+(\d{1,3})\s+(?:vezes|meses)\b/i)
    || normalized.match(/\b(?:por|durante|em)\s+(\d{1,3})\s+(?:meses|parcelas)\b/i)
    || normalized.match(/\b(\d{1,3})\s+parcelas\b/i);
  if (!match) return undefined;

  const count = Number(match[1]);
  return count >= 2 && count <= 120 ? count : undefined;
};

const cleanTitle = (text: string, amount: number) =>
  normalize(text)
    .replace(new RegExp(namedDatePattern, 'g'), ' ')
    .replace(new RegExp(numericDatePattern, 'g'), ' ')
    .replace(/\b(?:repetir|repete|repetindo)(?:\s+mensalmente)?(?:\s+por)?\s+\d{1,3}\s+(?:vezes|meses)\b/gi, ' ')
    .replace(/\b(?:(?:por|durante|em)\s+)?\d{1,3}\s+(?:meses|parcelas)\b/gi, ' ')
    .replace(/\b(?:mensalmente|todos os meses)\b/gi, ' ')
    .replace(/^(adicionar|add|inserir|lancar|registrar)\s+/i, '')
    .replace(/\b(despesa|receita|gasto|entrada|ganho)\b/gi, '')
    .replace(/\b\d{1,3}\s*x\s+de\s+\d+(?:[.,]\d+)?\b/gi, ' ')
    .replace(/\bdi(?:a)?\s+\d{1,2}\b/gi, ' ')
    .replace(/\btodo\s+(?:mes|mês|dia)\b/gi, ' ')
    .replace(new RegExp(`\\b${numericPattern}\\b`, 'gi'), ' ')
    .replace(/\b(r\$|reais|real|valor|por|de|do|da|dos|das|no|na|em|hoje|amanha|ontem)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const parseVoiceCommand = (
  transcript: string,
  options: ParseVoiceCommandOptions = {}
): ParsedVoiceCommand | null => {
  const normalized = normalizeSpokenNumbers(transcript);

  const wantsShopping =
    options.preferredKind === 'shopping' ||
    normalized.includes('lista') ||
    normalized.includes('compra') ||
    normalized.includes('compras') ||
    normalized.includes('mercado');

  const wantsTransaction =
    options.preferredKind === 'transaction' ||
    normalized.includes('despesa') ||
    normalized.includes('gasto') ||
    normalized.includes('receita') ||
    normalized.includes('entrada') ||
    normalized.includes('ganho') ||
    normalized.includes('salario') ||
    normalized.includes('salário') ||
    /\b(gastei|paguei|recebi|ganhei)\b/.test(normalized);

  if (wantsShopping && !wantsTransaction) {
    const estimatedPrice = parseAmount(normalized);
    const parsedQuantity = parseShoppingQuantity(normalized);
    const withoutPrice = stripPriceFragments(normalized);
    const withoutQuantity = removeFirstOccurrence(withoutPrice, parsedQuantity.raw);
    const name = withoutQuantity
      .replace(/^(adicionar|add|inserir|colocar)\s+/i, '')
      .replace(/\b(na|no|a|o|os|as|lista|de|do|da|dos|das|compras|compra|mercado|para)\b/g, ' ')
      .replace(new RegExp(`\\b(${unitPattern})\\b`, 'gi'), ' ')
      .replace(/\br\s*\$|\$|reais|real/gi, ' ')
      .replace(/\b\d+(?:[,.]\d{1,2})?\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) return null;

    return {
      kind: 'shopping',
      action: 'add',
      name,
      quantity: parsedQuantity.quantity,
      unit: parsedQuantity.unit,
      estimatedPrice,
    };
  }

  if (wantsTransaction) {
    const type: TransactionType =
      normalized.includes('receita') ||
      normalized.includes('entrada') ||
      normalized.includes('ganho') ||
      normalized.includes('salario') ||
      normalized.includes('salário') || /\b(recebi|ganhei)\b/.test(normalized)
        ? 'income'
        : 'expense';
    const amount = parseAmount(normalized);
    const title = cleanTitle(normalized, amount);
    const dayOfMonth = parseDayOfMonth(normalized);
    const date = parseExplicitDate(normalized);
    if (date === null) return null;
    const installmentCount = parseInstallments(normalized);
    const isSubscription =
      normalized.includes('todo mes') ||
      normalized.includes('todo mês') ||
      normalized.includes('todo dia') ||
      normalized.includes('mensalmente') || normalized.includes('todos os meses') ||
      (type === 'income' && normalized.includes('salario'));
    const recurrenceType = installmentCount
      ? 'installment'
      : isSubscription
        ? 'subscription'
        : 'none';

    if (!amount || !title) return null;

    return {
      kind: 'transaction',
      action: 'add',
      type,
      title,
      amount,
      recurrenceType,
      installmentCount,
      dayOfMonth,
      date,
    };
  }

  return null;
};


export function parseVoiceTheme(transcript: string): 'light' | 'dark' | 'system' | null {
  const text = normalize(transcript);
  if (!/^(?:(?:mudar|alterar|ativar|usar|mude)(?: para)?\s+)?(?:o\s+|a\s+)?(?:tema|modo|aparencia)\b/.test(text)) return null;
  if (/\b(escuro|escura)\b/.test(text)) return 'dark';
  if (/\b(claro|clara)\b/.test(text)) return 'light';
  if (/\b(sistema|automatico|automatica)\b/.test(text)) return 'system';
  return null;
}
