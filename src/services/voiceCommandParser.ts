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
  const match = normalized.match(/\b(\d{1,3})\s*x\b/i);
  if (!match) return undefined;

  const count = Number(match[1]);
  return count >= 2 && count <= 120 ? count : undefined;
};

const cleanTitle = (text: string, amount: number) =>
  normalize(text)
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
  const normalized = normalize(transcript);

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
    const estimatedPrice = parseAmount(transcript);
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
    const amount = parseAmount(transcript);
    const title = cleanTitle(transcript, amount);
    const dayOfMonth = parseDayOfMonth(normalized);
    const installmentCount = parseInstallments(normalized);
    const isSubscription =
      normalized.includes('todo mes') ||
      normalized.includes('todo mês') ||
      normalized.includes('todo dia') ||
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
