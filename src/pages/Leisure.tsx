import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Minus,
  Users,
  ShoppingCart,
  Calculator,
  Trash2,
  ChevronDown,
  Check,
  X,
  Baby,
  User,
  Percent,
  ChefHat,
  Pizza,
  PartyPopper,
  Clock,
  Edit,
  Calendar,
  Mail,
  Send,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { BottomNav } from '@/components/BottomNav';
import { CurrencyInput } from '@/components/CurrencyInput';
import { PageIntro } from '@/components/PageIntro';
import { formatCurrency } from '@/utils/currency';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { generateICSFile } from '@/utils/calendarFile';
import { getPublicAppUrl } from '@/utils/appUrl';
import { getFunctionErrorMessage } from '@/utils/errors';
import { EventDeleteModal } from '@/components/EventDeleteModal';

interface Event {
  id: string;
  name: string;
  description?: string;
  eventDate?: string;
  adultsCount: number;
  childrenCount: number;
  childrenPercentage: number;
  totalBudget: number;
  createdAt: string;
  createdBy: string;
}

interface EventItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  category: string;
}

interface Participant {
  id: string;
  name: string;
  email?: string;
  isChild: boolean;
  paid: boolean;
  amountDue: number;
}

type EventType =
  | 'bbq'
  | 'pizza'
  | 'party'
  | 'birthday'
  | 'happyHour'
  | 'dinner'
  | 'trip'
  | 'corporate'
  | 'shower'
  | 'custom';
type Duration = '4h' | '6h' | '8h+';
type ConsumptionMode = 'economy' | 'standard' | 'generous';

interface CalculatedItem {
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  total: number;
  category: string;
}

type EventItemRow = Database['public']['Tables']['event_items']['Row'];
type EventParticipantRow = Database['public']['Tables']['event_participants']['Row'];

const formatEventItems = (rows: EventItemRow[] | null): EventItem[] =>
  (rows || []).map((item) => ({
    id: item.id,
    name: item.name,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unit_price),
    category: item.category || 'outros',
  }));

const formatEventParticipants = (rows: EventParticipantRow[] | null): Participant[] =>
  (rows || []).map((participant) => ({
    id: participant.id,
    name: participant.name,
    email: participant.email || undefined,
    isChild: participant.is_child,
    paid: participant.paid,
    amountDue: Number(participant.amount_due),
  }));

const EVENT_TYPES = [
  { id: 'bbq' as EventType, label: 'Churrasco', icon: ChefHat },
  { id: 'pizza' as EventType, label: 'Pizza', icon: Pizza },
  { id: 'party' as EventType, label: 'Festa', icon: PartyPopper },
  { id: 'birthday' as EventType, label: 'Aniversario', icon: PartyPopper },
  { id: 'happyHour' as EventType, label: 'Happy hour', icon: Users },
  { id: 'dinner' as EventType, label: 'Almoco/jantar', icon: ChefHat },
  { id: 'trip' as EventType, label: 'Viagem', icon: Calendar },
  { id: 'corporate' as EventType, label: 'Empresa', icon: Users },
  { id: 'shower' as EventType, label: 'Cha/evento', icon: Baby },
  { id: 'custom' as EventType, label: 'Personalizado', icon: Calculator },
];

const DURATIONS = [
  { id: '4h' as Duration, label: '4 horas' },
  { id: '6h' as Duration, label: '6 horas' },
  { id: '8h+' as Duration, label: '8+ horas' },
];

const DURATION_MULTIPLIER: Record<Duration, number> = {
  '4h': 0.8,
  '6h': 1.0,
  '8h+': 1.3,
};

const CONSUMPTION_MODES = [
  { id: 'economy' as ConsumptionMode, label: 'Economico', multiplier: 0.85 },
  { id: 'standard' as ConsumptionMode, label: 'Padrao', multiplier: 1 },
  { id: 'generous' as ConsumptionMode, label: 'Generoso', multiplier: 1.2 },
];

const CONSUMPTION_MULTIPLIER: Record<ConsumptionMode, number> = {
  economy: 0.85,
  standard: 1,
  generous: 1.2,
};

const BASE_CONSUMPTION = {
  bbq: {
    items: [
      { name: 'Carne', baseQtyAdult: 0.4, baseQtyChild: 0.2, unit: 'kg', defaultPrice: 50, category: 'carnes' },
      { name: 'Frango', baseQtyAdult: 0.15, baseQtyChild: 0.1, unit: 'kg', defaultPrice: 18, category: 'carnes' },
      { name: 'Linguiça', baseQtyAdult: 0.1, baseQtyChild: 0.05, unit: 'kg', defaultPrice: 25, category: 'carnes' },
      { name: 'Cerveja', baseQtyAdult: 1.5, baseQtyChild: 0, unit: 'L', defaultPrice: 8, category: 'bebidas' },
      { name: 'Refrigerante', baseQtyAdult: 0.3, baseQtyChild: 0.5, unit: 'L', defaultPrice: 6, category: 'bebidas' },
      { name: 'Água', baseQtyAdult: 0.5, baseQtyChild: 0.5, unit: 'L', defaultPrice: 3, category: 'bebidas' },
      { name: 'Pão de alho', baseQtyAdult: 2, baseQtyChild: 1, unit: 'un', defaultPrice: 2, category: 'acompanhamentos' },
      { name: 'Carvão', baseQtyAdult: 0.15, baseQtyChild: 0.1, unit: 'kg', defaultPrice: 15, category: 'outros' },
    ],
  },
  pizza: {
    items: [
      { name: 'Pizza Grande', baseQtyAdult: 0.33, baseQtyChild: 0.2, unit: 'un', defaultPrice: 55, category: 'outros' },
      { name: 'Refrigerante', baseQtyAdult: 0.5, baseQtyChild: 0.5, unit: 'L', defaultPrice: 6, category: 'bebidas' },
      { name: 'Suco', baseQtyAdult: 0.2, baseQtyChild: 0.4, unit: 'L', defaultPrice: 8, category: 'bebidas' },
      { name: 'Água', baseQtyAdult: 0.3, baseQtyChild: 0.3, unit: 'L', defaultPrice: 3, category: 'bebidas' },
    ],
  },
  party: {
    items: [
      { name: 'Salgados', baseQtyAdult: 12, baseQtyChild: 8, unit: 'un', defaultPrice: 0.8, category: 'outros' },
      { name: 'Docinhos', baseQtyAdult: 5, baseQtyChild: 8, unit: 'un', defaultPrice: 1.2, category: 'outros' },
      { name: 'Bolo', baseQtyAdult: 1, baseQtyChild: 1, unit: 'fatia', defaultPrice: 8, category: 'outros' },
      { name: 'Cerveja', baseQtyAdult: 1.2, baseQtyChild: 0, unit: 'L', defaultPrice: 8, category: 'bebidas' },
      { name: 'Refrigerante', baseQtyAdult: 0.4, baseQtyChild: 0.6, unit: 'L', defaultPrice: 6, category: 'bebidas' },
      { name: 'Água', baseQtyAdult: 0.4, baseQtyChild: 0.4, unit: 'L', defaultPrice: 3, category: 'bebidas' },
      { name: 'Suco', baseQtyAdult: 0.2, baseQtyChild: 0.4, unit: 'L', defaultPrice: 8, category: 'bebidas' },
    ],
  },
  birthday: {
    items: [
      { name: 'Salgados', baseQtyAdult: 10, baseQtyChild: 8, unit: 'un', defaultPrice: 0.8, category: 'outros' },
      { name: 'Docinhos', baseQtyAdult: 4, baseQtyChild: 6, unit: 'un', defaultPrice: 1.2, category: 'outros' },
      { name: 'Bolo', baseQtyAdult: 1, baseQtyChild: 1, unit: 'fatia', defaultPrice: 8, category: 'outros' },
      { name: 'Refrigerante', baseQtyAdult: 0.4, baseQtyChild: 0.6, unit: 'L', defaultPrice: 6, category: 'bebidas' },
      { name: 'Agua', baseQtyAdult: 0.3, baseQtyChild: 0.3, unit: 'L', defaultPrice: 3, category: 'bebidas' },
    ],
  },
  happyHour: {
    items: [
      { name: 'Petiscos', baseQtyAdult: 8, baseQtyChild: 4, unit: 'un', defaultPrice: 1.5, category: 'outros' },
      { name: 'Cerveja', baseQtyAdult: 1.4, baseQtyChild: 0, unit: 'L', defaultPrice: 8, category: 'bebidas' },
      { name: 'Refrigerante', baseQtyAdult: 0.25, baseQtyChild: 0.5, unit: 'L', defaultPrice: 6, category: 'bebidas' },
      { name: 'Agua', baseQtyAdult: 0.25, baseQtyChild: 0.3, unit: 'L', defaultPrice: 3, category: 'bebidas' },
    ],
  },
  dinner: {
    items: [
      { name: 'Prato principal', baseQtyAdult: 1, baseQtyChild: 0.6, unit: 'porcao', defaultPrice: 28, category: 'outros' },
      { name: 'Acompanhamento', baseQtyAdult: 1, baseQtyChild: 0.7, unit: 'porcao', defaultPrice: 10, category: 'acompanhamentos' },
      { name: 'Bebida', baseQtyAdult: 0.5, baseQtyChild: 0.5, unit: 'L', defaultPrice: 7, category: 'bebidas' },
      { name: 'Sobremesa', baseQtyAdult: 1, baseQtyChild: 1, unit: 'un', defaultPrice: 8, category: 'outros' },
    ],
  },
  trip: {
    items: [
      { name: 'Alimentacao', baseQtyAdult: 1, baseQtyChild: 0.7, unit: 'dia', defaultPrice: 45, category: 'outros' },
      { name: 'Bebidas', baseQtyAdult: 1, baseQtyChild: 0.7, unit: 'dia', defaultPrice: 12, category: 'bebidas' },
      { name: 'Extras', baseQtyAdult: 1, baseQtyChild: 0.5, unit: 'cota', defaultPrice: 25, category: 'outros' },
    ],
  },
  corporate: {
    items: [
      { name: 'Salgados', baseQtyAdult: 10, baseQtyChild: 6, unit: 'un', defaultPrice: 0.9, category: 'outros' },
      { name: 'Doces', baseQtyAdult: 3, baseQtyChild: 5, unit: 'un', defaultPrice: 1.2, category: 'outros' },
      { name: 'Refrigerante', baseQtyAdult: 0.4, baseQtyChild: 0.5, unit: 'L', defaultPrice: 6, category: 'bebidas' },
      { name: 'Agua', baseQtyAdult: 0.4, baseQtyChild: 0.4, unit: 'L', defaultPrice: 3, category: 'bebidas' },
    ],
  },
  shower: {
    items: [
      { name: 'Salgados', baseQtyAdult: 9, baseQtyChild: 7, unit: 'un', defaultPrice: 0.8, category: 'outros' },
      { name: 'Docinhos', baseQtyAdult: 4, baseQtyChild: 6, unit: 'un', defaultPrice: 1.2, category: 'outros' },
      { name: 'Bolo', baseQtyAdult: 1, baseQtyChild: 1, unit: 'fatia', defaultPrice: 8, category: 'outros' },
      { name: 'Bebidas', baseQtyAdult: 0.5, baseQtyChild: 0.6, unit: 'L', defaultPrice: 7, category: 'bebidas' },
    ],
  },
  custom: {
    items: [
      { name: 'Comida', baseQtyAdult: 1, baseQtyChild: 0.6, unit: 'porcao', defaultPrice: 25, category: 'outros' },
      { name: 'Bebida', baseQtyAdult: 0.6, baseQtyChild: 0.5, unit: 'L', defaultPrice: 7, category: 'bebidas' },
      { name: 'Extras', baseQtyAdult: 1, baseQtyChild: 0.5, unit: 'cota', defaultPrice: 12, category: 'outros' },
    ],
  },
};

const Leisure: React.FC = () => {
  const { user } = useAuth();
  const { currentWorkspace, canEdit, loading: workspaceLoading } = useWorkspace();
  
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [items, setItems] = useState<EventItem[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  
  // View mode: 'calculator' | 'events'
  const [viewMode, setViewMode] = useState<'calculator' | 'events'>('events');
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showParticipantsList, setShowParticipantsList] = useState(false);
  const [showItemsList, setShowItemsList] = useState(false);
  const [expandedEventMetric, setExpandedEventMetric] = useState<
    'people' | 'budget' | 'payments' | 'children' | null
  >(null);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  
  // Form states
  const [showItemForm, setShowItemForm] = useState(false);
  const [showParticipantForm, setShowParticipantForm] = useState(false);
  const [addingParticipant, setAddingParticipant] = useState(false);
  
  const [childrenPercentage, setChildrenPercentage] = useState(50);
  
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemPrice, setItemPrice] = useState(0);
  const [itemCategory, setItemCategory] = useState('outros');
  
  const [participantName, setParticipantName] = useState('');
  const [participantEmail, setParticipantEmail] = useState('');
  const [participantIsChild, setParticipantIsChild] = useState(false);
  const [showEventDeleteModal, setShowEventDeleteModal] = useState(false);

  // Calculator states
  const [eventType, setEventType] = useState<EventType>('bbq');
  const [duration, setDuration] = useState<Duration>('4h');
  const [consumptionMode, setConsumptionMode] = useState<ConsumptionMode>('standard');
  const [adultsCount, setAdultsCount] = useState(10);
  const [childrenCount, setChildrenCount] = useState(5);
  const [calculatedItems, setCalculatedItems] = useState<CalculatedItem[]>([]);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [eventTime, setEventTime] = useState('12:00');
  const [addToCalendar, setAddToCalendar] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [createFinancialExpense, setCreateFinancialExpense] = useState(true);
  const [showCalculatorResult, setShowCalculatorResult] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [savedEventData, setSavedEventData] = useState<{ name: string; date: string; time: string; amount: number } | null>(null);
  const [showAddItemForm, setShowAddItemForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('un');
  const [newItemPrice, setNewItemPrice] = useState(0);

  const loadEvents = useCallback(async () => {
    if (!currentWorkspace) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('workspace_id', currentWorkspace.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedEvents: Event[] = (data || []).map(e => ({
        id: e.id,
        name: e.name,
        description: e.description || undefined,
        eventDate: e.event_date || undefined,
        adultsCount: e.adults_count,
        childrenCount: e.children_count,
        childrenPercentage: Number(e.children_percentage),
        totalBudget: Number(e.total_budget),
        createdAt: e.created_at,
        createdBy: e.created_by,
      }));

      setEvents(formattedEvents);
      
      setSelectedEvent((current) =>
        current && !formattedEvents.some((event) => event.id === current.id) ? null : current
      );
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace]);

  useEffect(() => {
    if (!workspaceLoading && currentWorkspace) {
      loadEvents();
    }
  }, [currentWorkspace, workspaceLoading, loadEvents]);

  const loadEventDetails = useCallback(async (eventId: string) => {
    try {
      const { data: itemsData } = await supabase
        .from('event_items')
        .select('*')
        .eq('event_id', eventId);
      const formattedItems = formatEventItems(itemsData);

      setItems(formattedItems);

      const { data: participantsData } = await supabase
        .from('event_participants')
        .select('*')
        .eq('event_id', eventId);
      const formattedParticipants = formatEventParticipants(participantsData);

      setParticipants(formattedParticipants);
    } catch (error) {
      console.error('Failed to load event details:', error);
    }
  }, []);

  useEffect(() => {
    if (selectedEvent?.id) {
      loadEventDetails(selectedEvent.id);
    } else {
      setItems([]);
      setParticipants([]);
    }
  }, [selectedEvent?.id, loadEventDetails]);

  const refreshEventDetails = async (eventId: string) => {
    const [{ data: itemsData, error: itemsError }, { data: participantsData, error: participantsError }] =
      await Promise.all([
        supabase.from('event_items').select('*').eq('event_id', eventId),
        supabase.from('event_participants').select('*').eq('event_id', eventId),
      ]);

    if (itemsError) throw itemsError;
    if (participantsError) throw participantsError;

    const formattedItems = formatEventItems(itemsData);
    const formattedParticipants = formatEventParticipants(participantsData);

    setItems(formattedItems);
    setParticipants(formattedParticipants);

    return {
      formattedItems,
      formattedParticipants,
    };
  };

  const syncEventTotals = async (
    eventId: string,
    currentItems: EventItem[],
    currentParticipants: Participant[],
    childrenPercentageValue?: number
  ) => {
    const totalBudgetValue = currentItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const adults = currentParticipants.filter((participant) => !participant.isChild);
    const children = currentParticipants.filter((participant) => participant.isChild);
    const effectiveChildrenPercentage =
      childrenPercentageValue ?? selectedEvent?.childrenPercentage ?? childrenPercentage;

    const { error: updateEventError } = await supabase
      .from('events')
      .update({
        total_budget: totalBudgetValue,
        adults_count: adults.length,
        children_count: children.length,
        children_percentage: effectiveChildrenPercentage,
      })
      .eq('id', eventId);

    if (updateEventError) throw updateEventError;

    if (currentParticipants.length > 0) {
      const childMultiplier = effectiveChildrenPercentage / 100;
      const totalUnits = adults.length + children.length * childMultiplier;

      if (totalUnits > 0) {
        const adultShare = totalBudgetValue / totalUnits;
        const childShare = adultShare * childMultiplier;

        for (const participant of currentParticipants) {
          const amount = participant.isChild ? childShare : adultShare;
          const { error: participantError } = await supabase
            .from('event_participants')
            .update({ amount_due: amount })
            .eq('id', participant.id);

          if (participantError) throw participantError;
        }
      }
    }

    const refreshedDetails = await refreshEventDetails(eventId);
    const eventPatch = {
      totalBudget: totalBudgetValue,
      adultsCount: adults.length,
      childrenCount: children.length,
      childrenPercentage: effectiveChildrenPercentage,
    };

    setEvents((currentEvents) =>
      currentEvents.map((event) =>
        event.id === eventId ? { ...event, ...eventPatch } : event
      )
    );

    if (selectedEvent?.id === eventId) {
      setSelectedEvent((current) =>
        current ? { ...current, ...eventPatch } : current
      );
    }

    return refreshedDetails;
  };

  // Calculator functions
  const calculateItems = () => {
    const multiplier =
      DURATION_MULTIPLIER[duration] * CONSUMPTION_MULTIPLIER[consumptionMode];
    const baseItems = BASE_CONSUMPTION[eventType].items;
    
    const items: CalculatedItem[] = baseItems.map((item) => {
      const adultQty = item.baseQtyAdult * adultsCount * multiplier;
      const childQty = item.baseQtyChild * childrenCount * multiplier;
      const totalQty = Math.ceil((adultQty + childQty) * 10) / 10;
      
      return {
        name: item.name,
        quantity: totalQty,
        unit: item.unit,
        pricePerUnit: item.defaultPrice,
        total: totalQty * item.defaultPrice,
        category: item.category,
      };
    });
    
    setCalculatedItems(items);
    setShowCalculatorResult(true);
  };

  const updateItemQuantity = (index: number, newQty: number) => {
    setCalculatedItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity: newQty, total: newQty * item.pricePerUnit }
          : item
      )
    );
  };

  const updateItemPrice = (index: number, newPrice: number) => {
    setCalculatedItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, pricePerUnit: newPrice, total: item.quantity * newPrice }
          : item
      )
    );
  };

  const addCustomItem = () => {
    if (!newItemName || newItemPrice <= 0) return;
    
    const newItem: CalculatedItem = {
      name: newItemName,
      quantity: newItemQuantity,
      unit: newItemUnit,
      pricePerUnit: newItemPrice,
      total: newItemQuantity * newItemPrice,
      category: 'outros',
    };
    
    setCalculatedItems((prev) => [...prev, newItem]);
    setNewItemName('');
    setNewItemQuantity(1);
    setNewItemUnit('un');
    setNewItemPrice(0);
    setShowAddItemForm(false);
  };

  const removeCalculatedItem = (index: number) => {
    setCalculatedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const calculatedTotal = useMemo(() => {
    return calculatedItems.reduce((sum, item) => sum + item.total, 0);
  }, [calculatedItems]);

  const saveCalculationAsEvent = async () => {
    if (!user || !currentWorkspace) return;
    
    const eventLabel = EVENT_TYPES.find((e) => e.id === eventType)?.label || 'Evento';
    const finalName = eventName || `${eventLabel} - ${adultsCount + childrenCount} pessoas`;

    try {
      // Create event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .insert({
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          name: finalName,
          event_date: eventDate || null,
          children_percentage: childrenPercentage,
          adults_count: adultsCount,
          children_count: childrenCount,
          total_budget: calculatedTotal,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Add all calculated items to the event
      if (eventData && calculatedItems.length > 0) {
        const itemsToInsert = calculatedItems.map(item => ({
          event_id: eventData.id,
          name: `${item.name} (${item.unit})`,
          quantity: item.quantity,
          unit_price: item.pricePerUnit,
          category: item.category,
        }));

        await supabase.from('event_items').insert(itemsToInsert);
      }

      const transactionDescription = `${eventLabel}: ${adultsCount} adultos, ${childrenCount} crianças`;

      if (createFinancialExpense) {
        // Find or create an events/leisure category for the transaction.
        let categoryId: string | null = null;
        const { data: existingCategories } = await supabase
          .from('categories')
          .select('id')
          .eq('user_id', user.id)
          .or('name.ilike.%festômetro%,name.ilike.%lazer%,name.ilike.%festa%')
          .limit(1);

        if (existingCategories && existingCategories.length > 0) {
          categoryId = existingCategories[0].id;
        } else {
          const { data: newCategory } = await supabase
            .from('categories')
            .insert({
              user_id: user.id,
              workspace_id: currentWorkspace.id,
              name: 'Eventos',
              type: 'expense',
              color: '#f59e0b',
              icon: 'PartyPopper',
            })
            .select()
            .single();

          if (newCategory) {
            categoryId = newCategory.id;
          }
        }

        await supabase.from('transactions').insert({
          user_id: user.id,
          workspace_id: currentWorkspace.id,
          title: finalName,
          amount: calculatedTotal,
          type: 'expense',
          date: eventDate || format(new Date(), 'yyyy-MM-dd'),
          category_id: categoryId,
          notes: transactionDescription,
          status: 'pending',
        });
      }

      // Generate a native calendar file when requested.
      if (addToCalendar && eventDate) {
        generateICSFile({
          summary: finalName,
          date: eventDate,
          time: eventTime,
          description: `${transactionDescription}\nValor previsto: ${formatCurrency(calculatedTotal)}`,
        });
      }

      toast.success('Evento registrado com sucesso!');
      
      // Reset calculator
      resetCalculator();
      setShowCreateEventModal(false);
      setShowSaveConfirmation(false);
      setSavedEventData(null);
      
      // Reload events and switch to events view
      await loadEvents();
      setViewMode('events');
      
      if (eventData) {
        setSelectedEvent({
          id: eventData.id,
          name: eventData.name,
          description: eventData.description || undefined,
          eventDate: eventData.event_date || undefined,
          adultsCount: eventData.adults_count,
          childrenCount: eventData.children_count,
          childrenPercentage: Number(eventData.children_percentage),
          totalBudget: Number(eventData.total_budget),
          createdAt: eventData.created_at,
          createdBy: eventData.created_by,
        });
      }
    } catch (error) {
      console.error('Failed to save event:', error);
      toast.error('Erro ao salvar evento');
    }
  };

  const handleSaveClick = () => {
    const eventLabel = EVENT_TYPES.find((e) => e.id === eventType)?.label || 'Evento';
    const finalName = eventName || `${eventLabel} - ${adultsCount + childrenCount} pessoas`;
    setSavedEventData({
      name: finalName,
      date: eventDate || format(new Date(), 'yyyy-MM-dd'),
      time: eventTime,
      amount: calculatedTotal,
    });
    setShowSaveConfirmation(true);
  };

  const resetCalculator = () => {
    setShowCalculatorResult(false);
    setCalculatedItems([]);
    setEventName('');
    setEventDate(format(new Date(), 'yyyy-MM-dd'));
    setEventTime('12:00');
    setAddToCalendar(false);
    setAdultsCount(10);
    setChildrenCount(5);
    setEventType('bbq');
      setDuration('4h');
    setConsumptionMode('standard');
    setChildrenPercentage(50);
    setCreateFinancialExpense(true);
    setShowAdvancedOptions(false);
    setEditingIndex(null);
    setShowAddItemForm(false);
    setNewItemName('');
    setNewItemQuantity(1);
    setNewItemUnit('un');
    setNewItemPrice(0);
  };

  const cancelCalculation = () => {
    resetCalculator();
    setShowCreateEventModal(false);
    setViewMode('events');
  };

  const addItem = async () => {
    if (!selectedEvent || !itemName || itemPrice <= 0) return;

    try {
      const { error } = await supabase
        .from('event_items')
        .insert({
          event_id: selectedEvent.id,
          name: itemName,
          quantity: itemQuantity,
          unit_price: itemPrice,
          category: itemCategory,
        });

      if (error) throw error;

      toast.success('Item adicionado!');
      setShowItemForm(false);
      setItemName('');
      setItemQuantity(1);
      setItemPrice(0);
      const { formattedItems, formattedParticipants } = await refreshEventDetails(selectedEvent.id);
      await syncEventTotals(selectedEvent.id, formattedItems, formattedParticipants);
    } catch (error) {
      console.error('Failed to add item:', error);
      toast.error('Erro ao adicionar item');
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      await supabase
        .from('event_items')
        .delete()
        .eq('id', itemId);

      toast.success('Item removido!');
      if (selectedEvent) {
        const { formattedItems, formattedParticipants } = await refreshEventDetails(selectedEvent.id);
        await syncEventTotals(selectedEvent.id, formattedItems, formattedParticipants);
      }
    } catch (error) {
      console.error('Failed to remove item:', error);
      toast.error('Erro ao remover item');
    }
  };

  const addParticipant = async (sendInviteAfterAdd = false) => {
    if (!selectedEvent || !participantName) return;

    setAddingParticipant(true);

    try {
      const { data: insertedParticipant, error } = await supabase
        .from('event_participants')
        .insert({
          event_id: selectedEvent.id,
          name: participantName,
          is_child: participantIsChild,
          email: participantEmail || null,
        })
        .select('*')
        .single();

      if (error) throw error;

      toast.success(
        sendInviteAfterAdd && participantEmail
          ? 'Participante adicionado. Enviando convite...'
          : 'Participante adicionado!'
      );
      setShowParticipantForm(false);
      setParticipantName('');
      setParticipantEmail('');
      setParticipantIsChild(false);
      const { formattedItems, formattedParticipants } = await refreshEventDetails(selectedEvent.id);
      const refreshedDetails = await syncEventTotals(selectedEvent.id, formattedItems, formattedParticipants);

      if (sendInviteAfterAdd && participantEmail && insertedParticipant) {
        const participantForInvite =
          refreshedDetails.formattedParticipants.find(
            (participant) => participant.id === insertedParticipant.id
          ) ||
          formatEventParticipants([insertedParticipant])[0];

        await sendParticipantInvite(participantForInvite);
      }
    } catch (error) {
      console.error('Failed to add participant:', error);
      toast.error('Erro ao adicionar participante');
    } finally {
      setAddingParticipant(false);
    }
  };

  const removeParticipant = async (participantId: string) => {
    try {
      await supabase
        .from('event_participants')
        .delete()
        .eq('id', participantId);

      toast.success('Participante removido!');
      if (selectedEvent) {
        const { formattedItems, formattedParticipants } = await refreshEventDetails(selectedEvent.id);
        await syncEventTotals(selectedEvent.id, formattedItems, formattedParticipants);
      }
    } catch (error) {
      console.error('Failed to remove participant:', error);
      toast.error('Erro ao remover participante');
    }
  };

  const toggleParticipantPaid = async (participant: Participant) => {
    if (!canEdit) {
      toast.error('Sem permissao para alterar pagamentos neste espaco');
      return;
    }

    try {
      const { error } = await supabase
        .from('event_participants')
        .update({ paid: !participant.paid })
        .eq('id', participant.id);

      if (error) throw error;

      if (selectedEvent) {
        await loadEventDetails(selectedEvent.id);
      }

      toast.success(participant.paid ? 'Pagamento marcado como pendente' : 'Pagamento confirmado');
    } catch (error) {
      console.error('Failed to toggle payment:', error);
      toast.error('Erro ao atualizar pagamento');
    }
  };

  const sendParticipantInvite = async (participant: Participant) => {
    if (!selectedEvent) return;
    if (!participant.email) {
      toast.error('Adicione um email para enviar o convite');
      return;
    }

    setSendingInviteId(participant.id);

    try {
      const { data: hostProfile } = await supabase
        .from('profiles')
        .select('display_name, email')
        .eq('id', selectedEvent.createdBy)
        .maybeSingle();

      const hostName =
        hostProfile?.display_name ||
        hostProfile?.email?.split('@')[0] ||
        user?.email?.split('@')[0] ||
        'Anfitriao';
      const hostEmail = hostProfile?.email || user?.email || undefined;

      const { error } = await supabase.functions.invoke('send-event-invite-email', {
        body: {
          email: participant.email,
          participantName: participant.name,
          eventName: selectedEvent.name,
          eventDate: selectedEvent.eventDate,
          eventTime,
          hostName,
          hostEmail,
          amountDue: participant.amountDue,
          appUrl: getPublicAppUrl(),
        },
      });

      if (error) throw error;

      toast.success('Convite enviado!');
    } catch (error) {
      console.error('Failed to send event invite:', error);
      toast.error('Erro ao enviar convite', {
        description: await getFunctionErrorMessage(error, 'Tente novamente em instantes.'),
      });
    } finally {
      setSendingInviteId(null);
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

      toast.success('Evento excluído!');
      setSelectedEvent(null);
      await loadEvents();
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error('Erro ao excluir evento');
    }
  };

  const handleBulkDeleteEvents = async (eventIds: string[]) => {
    try {
      for (const id of eventIds) {
        await supabase.from('events').delete().eq('id', id);
      }
      toast.success(`${eventIds.length} evento(s) excluído(s)!`);
      setShowEventDeleteModal(false);
      if (eventIds.includes(selectedEvent?.id || '')) {
        setSelectedEvent(null);
      }
      await loadEvents();
    } catch (error) {
      console.error('Failed to bulk delete events:', error);
      toast.error('Erro ao excluir eventos');
    }
  };

  const updateChildrenPercentageForEvent = async (percentage: number) => {
    if (!selectedEvent) return;

    setChildrenPercentage(percentage);
    setSelectedEvent({ ...selectedEvent, childrenPercentage: percentage });

    try {
      const { formattedItems, formattedParticipants } = await refreshEventDetails(selectedEvent.id);
      await syncEventTotals(
        selectedEvent.id,
        formattedItems,
        formattedParticipants,
        percentage
      );
    } catch (error) {
      console.error('Failed to update children percentage:', error);
      toast.error('Erro ao recalcular rateio');
    }
  };

  const closeSelectedEvent = () => {
    setSelectedEvent(null);
    setShowParticipantsList(false);
    setShowItemsList(false);
    setExpandedEventMetric(null);
  };

  const toggleSelectedEvent = (event: Event) => {
    if (selectedEvent?.id === event.id) {
      closeSelectedEvent();
      return;
    }

    setSelectedEvent(event);
    setShowParticipantsList(false);
    setShowItemsList(false);
    setExpandedEventMetric(null);
  };

  const totalBudget = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalPaid = participants.filter(p => p.paid).reduce((sum, p) => sum + p.amountDue, 0);
  const totalPending = participants.filter(p => !p.paid).reduce((sum, p) => sum + p.amountDue, 0);
  const adultsInEvent = participants.filter((participant) => !participant.isChild);
  const childrenInEvent = participants.filter((participant) => participant.isChild);
  const paidParticipantsCount = participants.filter((participant) => participant.paid).length;
  const adultShare = adultsInEvent.length > 0 ? adultsInEvent[0]?.amountDue || 0 : 0;
  const childShare = childrenInEvent.length > 0 ? childrenInEvent[0]?.amountDue || 0 : adultShare * (selectedEvent?.childrenPercentage || 0) / 100;
  const eventsTotalBudget = events.reduce((sum, event) => sum + event.totalBudget, 0);
  const eventsPeopleCount = events.reduce(
    (sum, event) => sum + event.adultsCount + event.childrenCount,
    0
  );
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const eventColumns = useMemo(
    () => [
      {
        id: 'upcoming',
        title: 'Proximos',
        events: events.filter((event) => event.eventDate && event.eventDate >= todayDate),
      },
      {
        id: 'planning',
        title: 'Sem data',
        events: events.filter((event) => !event.eventDate),
      },
      {
        id: 'past',
        title: 'Finalizados',
        events: events.filter((event) => event.eventDate && event.eventDate < todayDate),
      },
    ],
    [events, todayDate]
  );

  const itemCategories = [
    { value: 'carnes', label: 'Carnes' },
    { value: 'bebidas', label: 'Bebidas' },
    { value: 'acompanhamentos', label: 'Acompanhamentos' },
    { value: 'descartaveis', label: 'Descartáveis' },
    { value: 'outros', label: 'Outros' },
  ];

  if (workspaceLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <PageIntro
        eyebrow="Festometro"
        title="Eventos e rateios"
        description="Acompanhe eventos criados, valores previstos, participantes e pagamentos sem abrir a criacao de cara."
        actions={
          <button
            onClick={() => {
              resetCalculator();
              setShowCreateEventModal(true);
            }}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Novo evento
          </button>
        }
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">Eventos</p>
            <p className="mt-1 text-lg font-semibold">{events.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">Pessoas</p>
            <p className="mt-1 text-lg font-semibold">{eventsPeopleCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-background/70 px-3 py-2">
            <p className="text-xs text-muted-foreground">Previsto</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(eventsTotalBudget)}</p>
          </div>
        </div>
      </PageIntro>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {viewMode === 'calculator' ? (
          // Calculator View
          !showCalculatorResult ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setViewMode('events')}
                  className="text-sm font-medium text-primary"
                >
                  Voltar para eventos
                </button>
                <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  Novo evento
                </span>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <label className="mb-2 block text-sm font-medium text-muted-foreground">
                  Tipo de evento
                </label>
                <select
                  value={eventType}
                  onChange={(event) => setEventType(event.target.value as EventType)}
                  className="h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground"
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted-foreground">
                  Os itens e quantidades sao sugeridos a partir desse tipo.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-card p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Adultos</p>
                      </div>
                    </div>
                    <div className="min-w-[3rem] rounded-xl bg-muted px-3 py-1.5 text-center text-xl font-bold tabular-nums">
                      {adultsCount}
                    </div>
                  </div>
                  <div className="grid grid-cols-[44px_1fr_44px] gap-2">
                    <button
                      type="button"
                      onClick={() => setAdultsCount(Math.max(0, adultsCount - 1))}
                      className="flex h-10 items-center justify-center rounded-xl border border-border bg-muted text-foreground transition-colors hover:bg-muted/80 active:scale-[0.98]"
                      aria-label="Diminuir adultos"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      value={adultsCount}
                      onChange={(e) =>
                        setAdultsCount(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                      }
                      className="h-10 rounded-xl border border-border bg-background px-4 text-center text-lg font-semibold tabular-nums outline-none transition-colors focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setAdultsCount(adultsCount + 1)}
                      className="flex h-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-colors hover:bg-primary/15 active:scale-[0.98]"
                      aria-label="Aumentar adultos"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-card p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
                        <Baby className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Criancas</p>
                      </div>
                    </div>
                    <div className="min-w-[3rem] rounded-xl bg-muted px-3 py-1.5 text-center text-xl font-bold tabular-nums">
                      {childrenCount}
                    </div>
                  </div>
                  <div className="grid grid-cols-[44px_1fr_44px] gap-2">
                    <button
                      type="button"
                      onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}
                      className="flex h-10 items-center justify-center rounded-xl border border-border bg-muted text-foreground transition-colors hover:bg-muted/80 active:scale-[0.98]"
                      aria-label="Diminuir criancas"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      value={childrenCount}
                      onChange={(e) =>
                        setChildrenCount(Math.max(0, Number.parseInt(e.target.value, 10) || 0))
                      }
                      className="h-10 rounded-xl border border-border bg-background px-4 text-center text-lg font-semibold tabular-nums outline-none transition-colors focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setChildrenCount(childrenCount + 1)}
                      className="flex h-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary transition-colors hover:bg-primary/15 active:scale-[0.98]"
                      aria-label="Aumentar criancas"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-3 block text-sm font-medium text-muted-foreground">
                    <Clock className="mr-2 inline h-4 w-4" />
                    Duracao
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {DURATIONS.map((dur) => (
                      <button
                        key={dur.id}
                        onClick={() => setDuration(dur.id)}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all ${
                          duration === dur.id
                            ? 'border-primary bg-primary/20 text-primary'
                            : 'border-border bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {dur.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-sm font-medium text-muted-foreground">
                    Perfil de consumo
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {CONSUMPTION_MODES.map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setConsumptionMode(mode.id)}
                        className={`rounded-xl border px-3 py-3 text-sm font-medium transition-all ${
                          consumptionMode === mode.id
                            ? 'border-primary bg-primary/20 text-primary'
                            : 'border-border bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-muted rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Total de pessoas</span>
                  <span className="text-xl font-bold">{adultsCount + childrenCount}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4">
                <button
                  onClick={() => setShowAdvancedOptions((current) => !current)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div>
                    <p className="text-sm font-semibold">Opcoes avancadas</p>
                    <p className="text-xs text-muted-foreground">
                      Nome, data, agenda e regra para criancas.
                    </p>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      showAdvancedOptions ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {showAdvancedOptions && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 space-y-4 overflow-hidden"
                    >
                      <div>
                        <label className="mb-2 block text-sm font-medium text-muted-foreground">
                          Nome do evento
                        </label>
                        <input
                          type="text"
                          value={eventName}
                          onChange={(e) => setEventName(e.target.value)}
                          placeholder="Ex: Churrasco de fim de ano"
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground"
                        />
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-muted-foreground">
                            Data
                          </label>
                          <input
                            type="date"
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-muted-foreground">
                            Horario
                          </label>
                          <input
                            type="time"
                            value={eventTime}
                            onChange={(e) => setEventTime(e.target.value)}
                            className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground"
                          />
                        </div>
                      </div>

                      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-muted/50 p-3">
                        <div>
                          <p className="text-sm font-medium">Salvar na agenda do celular</p>
                          <p className="text-xs text-muted-foreground">
                            Gera um convite compativel com a agenda instalada.
                          </p>
                        </div>
                        <span
                          className={`relative h-7 w-12 rounded-full transition-colors ${
                            addToCalendar ? 'bg-primary' : 'bg-muted'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={addToCalendar}
                            onChange={(e) => setAddToCalendar(e.target.checked)}
                            className="sr-only"
                          />
                          <span
                            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              addToCalendar ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </span>
                      </label>

                      <div>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Percentual de criancas</p>
                            <p className="text-xs text-muted-foreground">
                              Criancas pagam {childrenPercentage}% do valor adulto.
                            </p>
                          </div>
                          <div className="min-w-[4rem] rounded-xl bg-primary/10 px-3 py-2 text-center text-sm font-semibold text-primary">
                            {childrenPercentage}%
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="10"
                          value={childrenPercentage}
                          onChange={(e) => setChildrenPercentage(Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={calculateItems}
                disabled={adultsCount + childrenCount === 0}
                className="w-full py-4 rounded-xl font-semibold bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Calculator className="w-5 h-5" />
                Calcular Estimativa
              </button>
            </div>
          ) : (
            // Calculator Results
            <div className="space-y-4">
              {/* Back button */}
              <button
                onClick={() => setShowCalculatorResult(false)}
                className="text-sm text-primary flex items-center gap-1"
              >
                <ChevronDown className="w-4 h-4 rotate-90" />
                Voltar e recalcular
              </button>

              {/* Summary */}
              <div className="bg-muted rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">
                    {adultsCount} adultos + {childrenCount} crianças
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {EVENT_TYPES.find((e) => e.id === eventType)?.label} • {DURATIONS.find((d) => d.id === duration)?.label} • {CONSUMPTION_MODES.find((mode) => mode.id === consumptionMode)?.label}
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Itens Estimados</h3>
                  <button
                    onClick={() => setShowAddItemForm(true)}
                    className="flex items-center gap-1 text-sm text-primary font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </button>
                </div>

                {/* Add Item Form */}
                <AnimatePresence>
                  {showAddItemForm && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-muted rounded-xl p-4 space-y-3"
                    >
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Nome do item"
                        className="w-full px-3 py-2 rounded-lg bg-card border border-border text-foreground placeholder:text-muted-foreground"
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground">Qtd</label>
                          <input
                            type="number"
                            value={newItemQuantity}
                            onChange={(e) => setNewItemQuantity(parseFloat(e.target.value) || 0)}
                            step="0.1"
                            className="w-full mt-1 px-2 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Unidade</label>
                          <select
                            value={newItemUnit}
                            onChange={(e) => setNewItemUnit(e.target.value)}
                            className="w-full mt-1 px-2 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
                          >
                            <option value="un">un</option>
                            <option value="kg">kg</option>
                            <option value="L">L</option>
                            <option value="pacote">pacote</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Preço/un</label>
                          <input
                            type="number"
                            value={newItemPrice}
                            onChange={(e) => setNewItemPrice(parseFloat(e.target.value) || 0)}
                            step="0.01"
                            className="w-full mt-1 px-2 py-2 rounded-lg bg-card border border-border text-foreground text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowAddItemForm(false)}
                          className="flex-1 py-2 rounded-lg bg-card border border-border text-muted-foreground text-sm"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={addCustomItem}
                          disabled={!newItemName || newItemPrice <= 0}
                          className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                        >
                          Adicionar
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {calculatedItems.map((item, index) => (
                  <motion.div
                    key={`${item.name}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-card border border-border rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{item.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                          className="p-2 rounded-lg hover:bg-muted"
                        >
                          <Edit className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => removeCalculatedItem(index)}
                          className="p-2 rounded-lg hover:bg-muted"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                    
                    {editingIndex === index ? (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <div>
                          <label className="text-xs text-muted-foreground">Quantidade ({item.unit})</label>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(index, parseFloat(e.target.value) || 0)}
                            step="0.1"
                            className="w-full mt-1 px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground">Preço por {item.unit}</label>
                          <CurrencyInput
                            value={item.pricePerUnit}
                            onChange={(value) => updateItemPrice(index, value)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {item.quantity.toFixed(1)} {item.unit} × {formatCurrency(item.pricePerUnit)}
                        </span>
                        <span className="font-semibold">{formatCurrency(item.total)}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Total */}
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-lg">Total Estimado</span>
                  <span className="text-2xl font-bold text-primary">{formatCurrency(calculatedTotal)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Custo por pessoa: {formatCurrency(calculatedTotal / (adultsCount + childrenCount || 1))}
                </p>
              </div>

              {/* Decision Section */}
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <h3 className="text-center font-semibold text-lg">Deseja criar esse evento?</h3>

                {!canEdit && (
                  <p className="text-center text-sm text-muted-foreground">
                    Você está como <span className="font-medium">visualizador</span> e não pode salvar eventos neste espaço.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      resetCalculator();
                    }}
                    className="py-4 rounded-xl font-semibold bg-muted text-muted-foreground border border-border flex items-center justify-center gap-2"
                  >
                    <X className="w-5 h-5" />
                    Não
                  </button>
                  <button
                    onClick={() => {
                      if (!canEdit) {
                        toast.error('Sem permissão para salvar neste espaço');
                        return;
                      }
                      handleSaveClick();
                    }}
                    disabled={!canEdit}
                    className="py-4 rounded-xl font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="w-5 h-5" />
                    Sim
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          // Events View
          <>
            {events.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">Quadro de eventos</h2>
                    <p className="text-xs text-muted-foreground">
                      Toque em um card para acompanhar itens, pessoas e pagamentos.
                    </p>
                  </div>
                  {events.length > 1 && (
                    <button
                      onClick={() => setShowEventDeleteModal(true)}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-muted-foreground"
                    >
                      Organizar
                    </button>
                  )}
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  {eventColumns.map((column) => (
                    <div key={column.id} className="rounded-2xl border border-border bg-card/70 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium">{column.title}</p>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {column.events.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {column.events.map((event) => {
                          const peopleCount = event.adultsCount + event.childrenCount;
                          const isSelected = selectedEvent?.id === event.id;

                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => toggleSelectedEvent(event)}
                              className={`w-full rounded-xl border p-3 text-left transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary/10'
                                  : 'border-border bg-background hover:border-primary/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{event.name}</p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {event.eventDate
                                      ? format(new Date(event.eventDate), 'dd/MM/yyyy', { locale: ptBR })
                                      : 'Sem data'}
                                  </p>
                                </div>
                                <p className="shrink-0 text-sm font-semibold">
                                  {formatCurrency(event.totalBudget)}
                                </p>
                              </div>
                              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                <span>{peopleCount} pessoas</span>
                                <span>{event.childrenPercentage}% criancas</span>
                              </div>
                            </button>
                          );
                        })}

                        {column.events.length === 0 && (
                          <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                            Sem eventos aqui
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {events.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <Calculator className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h2 className="text-lg font-semibold mb-2">Nenhum evento criado</h2>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  Crie um evento quando quiser calcular compras, participantes e rateio.
                </p>
                <button
                  onClick={() => {
                    resetCalculator();
                    setShowCreateEventModal(true);
                  }}
                  className="mt-5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                >
                  Criar primeiro evento
                </button>
              </div>
            )}

            {selectedEvent && (
              <>
                <div className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Evento selecionado</p>
                      <h2 className="text-xl font-semibold">{selectedEvent.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedEvent.eventDate
                          ? format(new Date(selectedEvent.eventDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                        : 'Sem data definida'}
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEventMetric((current) => current === 'people' ? null : 'people')
                          }
                          className="rounded-xl bg-muted/60 px-3 py-2 text-center"
                        >
                          <p className="text-xs text-muted-foreground">Adultos</p>
                          <p className="text-base font-semibold">{adultsInEvent.length}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEventMetric((current) => current === 'children' ? null : 'children')
                          }
                          className="rounded-xl bg-muted/60 px-3 py-2 text-center"
                        >
                          <p className="text-xs text-muted-foreground">Criancas</p>
                          <p className="text-base font-semibold">{childrenInEvent.length}</p>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEventMetric((current) => current === 'budget' ? null : 'budget')
                          }
                          className="rounded-xl bg-muted/60 px-3 py-2 text-center"
                        >
                          <p className="text-xs text-muted-foreground">Itens</p>
                          <p className="text-base font-semibold">{items.length}</p>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={closeSelectedEvent}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground"
                        aria-label="Fechar detalhes do evento"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 xl:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => setExpandedEventMetric((current) => current === 'people' ? null : 'people')}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      expandedEventMetric === 'people' ? 'border-primary bg-primary/10' : 'border-border bg-card'
                    }`}
                  >
                    <p className="text-sm text-muted-foreground">Pessoas</p>
                    <p className="mt-1 text-2xl font-bold">{participants.length}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedEventMetric((current) => current === 'budget' ? null : 'budget')}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      expandedEventMetric === 'budget' ? 'border-primary bg-primary/10' : 'border-border bg-card'
                    }`}
                  >
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="mt-1 text-2xl font-bold">{formatCurrency(totalBudget)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedEventMetric((current) => current === 'payments' ? null : 'payments')}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      expandedEventMetric === 'payments' ? 'border-primary bg-primary/10' : 'border-income/20 bg-income/10'
                    }`}
                  >
                    <p className="text-sm text-income">Pago</p>
                    <p className="mt-1 text-2xl font-bold text-income">{formatCurrency(totalPaid)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedEventMetric((current) => current === 'children' ? null : 'children')}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      expandedEventMetric === 'children' ? 'border-primary bg-primary/10' : 'border-border bg-card'
                    }`}
                  >
                    <p className="text-sm text-muted-foreground">Rateio infantil</p>
                    <p className="mt-1 text-2xl font-bold text-primary">{selectedEvent.childrenPercentage}%</p>
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {expandedEventMetric && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border border-border bg-card p-4">
                        {expandedEventMetric === 'people' && (
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-muted/50 p-3">
                              <p className="text-xs text-muted-foreground">Adultos</p>
                              <p className="mt-1 text-lg font-semibold">{adultsInEvent.length}</p>
                            </div>
                            <div className="rounded-xl bg-muted/50 p-3">
                              <p className="text-xs text-muted-foreground">Criancas</p>
                              <p className="mt-1 text-lg font-semibold">{childrenInEvent.length}</p>
                            </div>
                            <div className="rounded-xl bg-muted/50 p-3">
                              <p className="text-xs text-muted-foreground">Itens</p>
                              <p className="mt-1 text-lg font-semibold">{items.length}</p>
                            </div>
                          </div>
                        )}

                        {expandedEventMetric === 'budget' && (
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-muted/50 p-3">
                              <p className="text-xs text-muted-foreground">Por adulto</p>
                              <p className="mt-1 text-lg font-semibold text-primary">{formatCurrency(adultShare)}</p>
                            </div>
                            <div className="rounded-xl bg-muted/50 p-3">
                              <p className="text-xs text-muted-foreground">Por crianca</p>
                              <p className="mt-1 text-lg font-semibold">{formatCurrency(childShare)}</p>
                            </div>
                            <div className="rounded-xl bg-muted/50 p-3">
                              <p className="text-xs text-muted-foreground">Total em itens</p>
                              <p className="mt-1 text-lg font-semibold">{items.length}</p>
                            </div>
                          </div>
                        )}

                        {expandedEventMetric === 'payments' && (
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl bg-muted/50 p-3">
                              <p className="text-xs text-muted-foreground">Pagantes</p>
                              <p className="mt-1 text-lg font-semibold">{paidParticipantsCount}/{participants.length}</p>
                            </div>
                            <div className="rounded-xl bg-income/10 p-3">
                              <p className="text-xs text-income">Pago</p>
                              <p className="mt-1 text-lg font-semibold text-income">{formatCurrency(totalPaid)}</p>
                            </div>
                            <div className="rounded-xl bg-expense/10 p-3">
                              <p className="text-xs text-expense">Pendente</p>
                              <p className="mt-1 text-lg font-semibold text-expense">{formatCurrency(totalPending)}</p>
                            </div>
                          </div>
                        )}

                        {expandedEventMetric === 'children' && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                  <Percent className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">Criancas pagam {selectedEvent.childrenPercentage}%</p>
                                  <p className="text-xs text-muted-foreground">Referencia sobre o valor de adulto.</p>
                                </div>
                              </div>
                              <p className="text-lg font-bold text-primary">{formatCurrency(childShare)}</p>
                            </div>
                            <div className="grid grid-cols-5 gap-2 rounded-xl border border-border bg-background p-1">
                              {[0, 25, 50, 75, 100].map((percentage) => (
                                <button
                                  key={percentage}
                                  type="button"
                                  onClick={() => updateChildrenPercentageForEvent(percentage)}
                                  disabled={!canEdit}
                                  className={`rounded-lg px-2 py-2 text-sm font-semibold transition-all ${
                                    selectedEvent.childrenPercentage === percentage
                                      ? 'bg-primary text-primary-foreground shadow-sm'
                                      : 'text-muted-foreground hover:bg-muted'
                                  } ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
                                >
                                  {percentage}%
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid gap-3 xl:grid-cols-2">
                {/* Participants Section */}
                <section className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-border p-3">
                    <button
                      type="button"
                      onClick={() => setShowParticipantsList((current) => !current)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">Participantes</h3>
                        <p className="text-xs text-muted-foreground">
                          {participants.length} pessoas, {participants.filter((participant) => participant.paid).length} pagas
                        </p>
                      </div>
                      <ChevronDown
                        className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${
                          showParticipantsList ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setShowParticipantForm(true)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
                      >
                        <Plus className="h-4 w-4 text-primary" />
                      </button>
                    )}
                  </div>
                  <AnimatePresence initial={false}>
                    {showParticipantsList && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                  <div className="divide-y divide-border">
                    {participants.map(participant => (
                      <div key={participant.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            participant.isChild ? 'bg-warning/10' : 'bg-primary/10'
                          }`}>
                            {participant.isChild ? (
                              <Baby className="h-4 w-4 text-warning" />
                            ) : (
                              <User className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{participant.name}</p>
                            <button
                              type="button"
                              onClick={() => sendParticipantInvite(participant)}
                              disabled={!participant.email || sendingInviteId === participant.id}
                              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-50"
                              title={participant.email ? 'Enviar convite' : 'Adicione um email para enviar o convite'}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Enviar convite
                            </button>
                            <p className="truncate text-xs text-muted-foreground">
                              {participant.isChild ? 'Criança' : 'Adulto'}
                              {participant.email && ` • ${participant.email}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-right">
                            <p className="text-sm font-medium">{formatCurrency(participant.amountDue)}</p>
                            <p className={`text-xs ${participant.paid ? 'text-income' : 'text-expense'}`}>
                              {participant.paid ? 'Pago' : 'Pendente'}
                            </p>
                          </div>
                                <button
                                  onClick={() => toggleParticipantPaid(participant)}
                                  disabled={!canEdit}
                                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                    participant.paid ? 'bg-primary/10' : 'bg-muted'
                            } ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
                            title={canEdit ? 'Alterar pagamento' : 'Somente editores podem alterar pagamento'}
                                >
                                  <Check className={`h-4 w-4 ${participant.paid ? 'text-primary' : 'text-muted-foreground'}`} />
                                </button>
                                {canEdit && (
                                  <button
                                    onClick={() => removeParticipant(participant.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {participants.length === 0 && (
                      <div className="p-5 text-center text-sm text-muted-foreground">
                        Adicione participantes para calcular a divisão
                      </div>
                    )}
                  </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                {/* Items Section */}
                <section className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-border p-3">
                    <button
                      type="button"
                      onClick={() => setShowItemsList((current) => !current)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ShoppingCart className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold">Itens</h3>
                        <p className="text-xs text-muted-foreground">
                          {items.length} itens, {formatCurrency(totalBudget)}
                        </p>
                      </div>
                      <ChevronDown
                        className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${
                          showItemsList ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setShowItemForm(true)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
                      >
                        <Plus className="h-4 w-4 text-primary" />
                      </button>
                    )}
                  </div>
                  <AnimatePresence initial={false}>
                    {showItemsList && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                  <div className="divide-y divide-border">
                    {items.map(item => (
                      <div key={item.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity}x {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <p className="text-sm font-medium">{formatCurrency(item.quantity * item.unitPrice)}</p>
                          {canEdit && (
                            <button
                              onClick={() => removeItem(item.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && (
                      <div className="p-5 text-center text-sm text-muted-foreground">
                        Adicione itens para calcular o total
                      </div>
                    )}
                  </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
                </div>

                {/* Delete Event */}
                {canEdit && (
                  <div className="space-y-3">
                    <button
                      onClick={() => deleteEvent(selectedEvent.id)}
                      className="w-full py-4 rounded-xl bg-destructive/10 text-destructive font-medium border border-destructive/20"
                    >
                      Excluir Evento Atual
                    </button>
                    {events.length > 1 && (
                      <button
                        onClick={() => setShowEventDeleteModal(true)}
                        className="w-full py-3 rounded-xl bg-muted text-muted-foreground font-medium border border-border"
                      >
                        Gerenciar / Excluir Múltiplos
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Create Event Modal */}
      <AnimatePresence>
        {showCreateEventModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 p-3 backdrop-blur-sm sm:p-6"
            onClick={cancelCalculation}
          >
            <motion.div
              initial={{ y: 28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 28, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              onClick={(event) => event.stopPropagation()}
              className="mx-auto flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Novo evento
                  </p>
                  <h2 className="text-lg font-semibold">
                    {showCalculatorResult ? 'Conferir estimativa' : 'Configurar rateio'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={cancelCalculation}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground"
                  aria-label="Fechar criacao de evento"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="overflow-y-auto px-4 py-4">
                {!showCalculatorResult ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          Nome do evento
                        </label>
                        <input
                          type="text"
                          value={eventName}
                          onChange={(event) => setEventName(event.target.value)}
                          placeholder="Ex: Churrasco de sabado"
                          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          Tipo
                        </label>
                        <select
                          value={eventType}
                          onChange={(event) => setEventType(event.target.value as EventType)}
                          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                        >
                          {EVENT_TYPES.map((type) => (
                            <option key={type.id} value={type.id}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          Adultos
                        </label>
                        <div className="grid h-11 grid-cols-[36px_1fr_36px] overflow-hidden rounded-xl border border-border bg-background">
                          <button type="button" onClick={() => setAdultsCount(Math.max(0, adultsCount - 1))}>
                            <Minus className="mx-auto h-4 w-4" />
                          </button>
                          <input
                            type="number"
                            value={adultsCount}
                            onChange={(event) =>
                              setAdultsCount(Math.max(0, Number.parseInt(event.target.value, 10) || 0))
                            }
                            className="bg-transparent text-center text-sm font-semibold outline-none"
                          />
                          <button type="button" onClick={() => setAdultsCount(adultsCount + 1)}>
                            <Plus className="mx-auto h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          Criancas
                        </label>
                        <div className="grid h-11 grid-cols-[36px_1fr_36px] overflow-hidden rounded-xl border border-border bg-background">
                          <button type="button" onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))}>
                            <Minus className="mx-auto h-4 w-4" />
                          </button>
                          <input
                            type="number"
                            value={childrenCount}
                            onChange={(event) =>
                              setChildrenCount(Math.max(0, Number.parseInt(event.target.value, 10) || 0))
                            }
                            className="bg-transparent text-center text-sm font-semibold outline-none"
                          />
                          <button type="button" onClick={() => setChildrenCount(childrenCount + 1)}>
                            <Plus className="mx-auto h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          Criancas pagam
                        </label>
                        <select
                          value={childrenPercentage}
                          onChange={(event) => setChildrenPercentage(Number(event.target.value))}
                          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                        >
                          {[0, 25, 50, 75, 100].map((value) => (
                            <option key={value} value={value}>
                              {value}%
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          Duracao
                        </label>
                        <select
                          value={duration}
                          onChange={(event) => setDuration(event.target.value as Duration)}
                          className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                        >
                          {DURATIONS.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                          Perfil
                        </label>
                        <div className="grid grid-cols-3 rounded-xl border border-border bg-background p-1">
                          {CONSUMPTION_MODES.map((mode) => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => setConsumptionMode(mode.id)}
                              className={`rounded-lg px-2 py-2 text-xs font-medium transition-all ${
                                consumptionMode === mode.id
                                  ? 'bg-primary text-primary-foreground shadow-sm'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAdvancedOptions((current) => !current)}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-3 text-left"
                    >
                      <span className="text-sm font-medium">Data e agenda</span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          showAdvancedOptions ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    <AnimatePresence>
                      {showAdvancedOptions && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid gap-3 rounded-xl bg-muted/40 p-3 sm:grid-cols-2">
                            <input
                              type="date"
                              value={eventDate}
                              onChange={(event) => setEventDate(event.target.value)}
                              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                            />
                            <input
                              type="time"
                              value={eventTime}
                              onChange={(event) => setEventTime(event.target.value)}
                              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                            />
                            <label className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 sm:col-span-2">
                              <span className="text-sm">Salvar na agenda do celular</span>
                              <input
                                type="checkbox"
                                checked={addToCalendar}
                                onChange={(event) => setAddToCalendar(event.target.checked)}
                                className="h-4 w-4 accent-primary"
                              />
                            </label>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-primary/20 bg-primary/10 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {eventName || `${EVENT_TYPES.find((event) => event.id === eventType)?.label} - ${adultsCount + childrenCount} pessoas`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {adultsCount} adultos, {childrenCount} criancas
                          </p>
                        </div>
                        <p className="text-xl font-bold text-primary">{formatCurrency(calculatedTotal)}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Itens sugeridos</p>
                        <button
                          type="button"
                          onClick={() => setShowAddItemForm(true)}
                          className="text-xs font-medium text-primary"
                        >
                          Adicionar
                        </button>
                      </div>

                      <AnimatePresence>
                        {showAddItemForm && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-[1fr_80px_90px_110px]">
                              <input
                                type="text"
                                value={newItemName}
                                onChange={(event) => setNewItemName(event.target.value)}
                                placeholder="Item"
                                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                              />
                              <input
                                type="number"
                                value={newItemQuantity}
                                onChange={(event) => setNewItemQuantity(parseFloat(event.target.value) || 0)}
                                step="0.1"
                                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                              />
                              <select
                                value={newItemUnit}
                                onChange={(event) => setNewItemUnit(event.target.value)}
                                className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                              >
                                <option value="un">un</option>
                                <option value="kg">kg</option>
                                <option value="L">L</option>
                                <option value="pacote">pacote</option>
                              </select>
                              <button
                                type="button"
                                onClick={addCustomItem}
                                disabled={!newItemName || newItemPrice <= 0}
                                className="h-10 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                              >
                                Incluir
                              </button>
                              <input
                                type="number"
                                value={newItemPrice}
                                onChange={(event) => setNewItemPrice(parseFloat(event.target.value) || 0)}
                                placeholder="Preco"
                                step="0.01"
                                className="h-10 rounded-lg border border-border bg-background px-3 text-sm sm:col-span-4"
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {calculatedItems.map((item, index) => (
                        <div key={`${item.name}-${index}`} className="rounded-xl border border-border bg-background p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{item.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.quantity.toFixed(1)} {item.unit} x {formatCurrency(item.pricePerUnit)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{formatCurrency(item.total)}</p>
                              <button type="button" onClick={() => removeCalculatedItem(index)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-border px-4 py-3">
                {!showCalculatorResult ? (
                  <button
                    type="button"
                    onClick={calculateItems}
                    disabled={adultsCount + childrenCount === 0}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    <Calculator className="h-4 w-4" />
                    Calcular estimativa
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCalculatorResult(false)}
                      className="h-11 rounded-xl border border-border bg-background text-sm font-semibold text-muted-foreground"
                    >
                      Ajustar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEdit) {
                          toast.error('Sem permissao para salvar neste espaco');
                          return;
                        }
                        handleSaveClick();
                      }}
                      disabled={!canEdit}
                      className="h-11 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      Salvar evento
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item Form Modal */}
      <AnimatePresence>
        {showItemForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 p-3 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-6"
            onClick={() => setShowItemForm(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 rounded-t-2xl border border-border bg-card p-4 shadow-2xl sm:static sm:max-w-lg sm:rounded-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Item</p>
                  <h2 className="text-base font-semibold">Adicionar item</h2>
                </div>
                <button
                  onClick={() => setShowItemForm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Ex: Picanha"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Qtd
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(Number(e.target.value))}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Categoria
                    </label>
                    <select
                      value={itemCategory}
                      onChange={(e) => setItemCategory(e.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                    >
                      {itemCategories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Preço Unitário
                  </label>
                  <CurrencyInput
                    value={itemPrice}
                    onChange={setItemPrice}
                    className="h-10 py-0 text-sm"
                  />
                </div>

                <button
                  onClick={addItem}
                  disabled={!itemName || itemPrice <= 0}
                  className="h-11 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Adicionar item
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Participant Form Modal */}
      <AnimatePresence>
        {showParticipantForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] bg-black/50 p-3 backdrop-blur-sm sm:flex sm:items-center sm:justify-center sm:p-6"
            onClick={() => setShowParticipantForm(false)}
          >
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 flex max-h-[calc(100dvh-1.5rem)] flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:static sm:max-h-[min(720px,calc(100dvh-3rem))] sm:max-w-lg sm:rounded-2xl"
            >
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Participante</p>
                  <h2 className="text-base font-semibold">Adicionar participante</h2>
                </div>
                <button
                  onClick={() => setShowParticipantForm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              
              <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    placeholder="Nome do participante"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    <Mail className="mr-1.5 inline h-3.5 w-3.5" />
                    Email opcional
                  </label>
                  <input
                    type="email"
                    value={participantEmail}
                    onChange={(e) => setParticipantEmail(e.target.value)}
                    placeholder="email@exemplo.com"
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-background p-1">
                  <button
                    onClick={() => setParticipantIsChild(false)}
                    className={`rounded-lg py-2 text-sm font-medium transition-all ${
                      !participantIsChild
                        ? 'bg-card shadow-md text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Adulto
                  </button>
                  <button
                    onClick={() => setParticipantIsChild(true)}
                    className={`rounded-lg py-2 text-sm font-medium transition-all ${
                      participantIsChild
                        ? 'bg-card shadow-md text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    Criança
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t border-border bg-card px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3">
                <button
                  onClick={() => addParticipant(Boolean(participantEmail.trim()))}
                  disabled={!participantName || !participantEmail.trim() || addingParticipant}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  Adicionar e enviar convite
                </button>
                <button
                  onClick={() => addParticipant(false)}
                  disabled={!participantName || addingParticipant}
                  className="h-11 w-full rounded-xl border border-border bg-muted text-sm font-semibold text-foreground disabled:opacity-50"
                >
                  {addingParticipant ? 'Adicionando...' : 'Adicionar sem enviar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Confirmation Modal */}
      <AnimatePresence>
        {showSaveConfirmation && savedEventData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowSaveConfirmation(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <PartyPopper className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">Salvar Evento?</h3>
                <p className="text-muted-foreground text-sm">
                  {savedEventData.name}
                </p>
                <p className="text-2xl font-bold text-primary mt-2">
                  {formatCurrency(savedEventData.amount)}
                </p>
                {savedEventData.date && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {format(new Date(savedEventData.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    {savedEventData.time && ` às ${savedEventData.time}`}
                  </p>
                )}
                {addToCalendar && (
                  <p className="text-xs text-primary mt-2 flex items-center justify-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Sera salvo na agenda do celular
                  </p>
                )}
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <div>
                  <p className="text-sm font-medium">Criar despesa no financeiro?</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    O evento sera salvo de qualquer forma. Voce pode ligar ou desligar antes de confirmar.
                  </p>
                </div>
                <span
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                    createFinancialExpense ? 'bg-primary' : 'bg-muted'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={createFinancialExpense}
                    onChange={(e) => setCreateFinancialExpense(e.target.checked)}
                    className="sr-only"
                  />
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      createFinancialExpense ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </span>
              </label>

              <div className="space-y-3">
                <button
                  onClick={() => saveCalculationAsEvent()}
                  className="w-full py-4 rounded-xl font-semibold bg-primary text-primary-foreground flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Salvar Evento
                </button>
                <button
                  onClick={() => setShowSaveConfirmation(false)}
                  className="w-full py-4 rounded-xl font-semibold bg-muted text-muted-foreground border border-border flex items-center justify-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <EventDeleteModal
        isOpen={showEventDeleteModal}
        onClose={() => setShowEventDeleteModal(false)}
        onConfirm={handleBulkDeleteEvents}
        events={events.map(e => ({ id: e.id, name: e.name, eventDate: e.eventDate }))}
      />

      <BottomNav />
    </AppShell>
  );
};

export default Leisure;
