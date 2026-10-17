import React from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useFinanceStore } from '@/stores/financeStore';
import { useWorkspace } from '@/hooks/useWorkspace';
import { buildPendingReminder } from '@/utils/pendingReminders';

export const PendingNotifications: React.FC = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { transactions, settings, initialized, initialize } = useFinanceStore();
  const [day, setDay] = React.useState(() => format(new Date(), 'yyyy-MM-dd'));
  const sessionSignature = React.useRef('');
  React.useEffect(() => {
    const checkDay = () => setDay(format(new Date(), 'yyyy-MM-dd'));
    const timer = window.setInterval(checkDay, 60000);
    window.addEventListener('focus', checkDay);
    return () => { clearInterval(timer); window.removeEventListener('focus', checkDay); };
  }, []);
  React.useEffect(() => { if (user && !initialized) void initialize(); }, [initialize, initialized, user]);
  React.useEffect(() => {
    if (!user || !initialized || !settings.notificationsEnabled) return;
    const reminder = buildPendingReminder(transactions);
    if (!reminder) return;
    const key = `deu-bom:pending-notifications:${user.id}:${currentWorkspace?.id || 'personal'}:${day}`;
    const signature = `${key}:${reminder.signature}`;
    if (sessionSignature.current === signature) return;
    try { if (localStorage.getItem(key) === reminder.signature) return; } catch { /* Still show a session reminder. */ }
    sessionSignature.current = signature;
    try { localStorage.setItem(key, reminder.signature); } catch { /* Keep only session deduplication. */ }
    const supported = 'Notification' in window;
    toast.warning(reminder.title, { description: reminder.description,
      action: supported && Notification.permission === 'default'
        ? { label: 'Permitir alertas', onClick: () => { void Notification.requestPermission(); } } : undefined,
    });
    if (supported && Notification.permission === 'granted') {
      void (async () => {
        try {
          const options = { body: reminder.description, icon: '/icon-192.png', tag: key };
          const worker = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
          if (worker?.active) await worker.showNotification(reminder.title, options);
          else new Notification(reminder.title, options);
        } catch { /* The in-app reminder remains available if the browser rejects native notifications. */ }
      })();
    }
  }, [initialized, settings.notificationsEnabled, transactions, user, currentWorkspace?.id, day]);
  return null;
};
