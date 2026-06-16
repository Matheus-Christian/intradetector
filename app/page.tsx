'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Service, Report, Setting, FormSchema, ServiceStatus, PingConfig } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ReportModal from '@/components/report-modal';
import * as Icons from 'lucide-react';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import IntradetectorLogo from '@/components/intradetector-logo';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Icon mapper helper
function getServiceIcon(iconName: string, category: string) {
  const IconComponent = (Icons as any)[iconName];
  if (IconComponent) {
    return <IconComponent className="h-6 w-6 transition-transform group-hover:scale-110" />;
  }

  // Fallback icons by category
  switch (category) {
    case 'Redes Sociais':
      return <Icons.MessageSquare className="h-6 w-6 transition-transform group-hover:scale-110" />;
    case 'Streaming':
      return <Icons.Tv className="h-6 w-6 transition-transform group-hover:scale-110" />;
    case 'Jogos':
      return <Icons.Gamepad2 className="h-6 w-6 transition-transform group-hover:scale-110" />;
    default:
      return <Icons.Globe className="h-6 w-6 transition-transform group-hover:scale-110" />;
  }
}

interface ServicePingProps {
  service: Service;
  config: PingConfig;
}

function ServicePing({ service, config }: ServicePingProps) {
  const [latency, setLatency] = useState<number | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'timeout' | 'error'>('loading');

  useEffect(() => {
    if (!service.ping_enabled || !service.ping_address) return;

    const performPing = async () => {
      const address = service.ping_address;
      if (!address) return;

      setStatus('loading');
      const start = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 4000);

      try {
        let pingUrl = address;
        if (!/^https?:\/\//i.test(pingUrl)) {
          pingUrl = `https://${pingUrl}`;
        }
        if (pingUrl.includes('?')) {
          pingUrl = `${pingUrl}&_t=${Date.now()}`;
        } else {
          pingUrl = `${pingUrl}?_t=${Date.now()}`;
        }

        await fetch(pingUrl, {
          mode: 'no-cors',
          cache: 'no-store',
          method: 'HEAD',
          signal: controller.signal,
          credentials: 'omit'
        });

        clearTimeout(timeoutId);
        const end = performance.now();
        const duration = Math.round(end - start);
        setLatency(duration);
        setStatus('success');
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
          setStatus('timeout');
          setLatency(null);
        } else {
          const end = performance.now();
          const duration = Math.round(end - start);
          if (duration < 4000) {
            setLatency(duration);
            setStatus('success');
          } else {
            setStatus('error');
            setLatency(null);
          }
        }
      }
    };

    performPing();

    const intervalSeconds = service.ping_interval || 30;
    const intervalId = setInterval(performPing, intervalSeconds * 1000);

    return () => clearInterval(intervalId);
  }, [service.ping_enabled, service.ping_address, service.ping_interval]);

  if (!service.ping_enabled) return null;

  return (
    <div 
      className="border-t border-zinc-200 dark:border-zinc-900 bg-zinc-50/80 dark:bg-zinc-950/40 px-5 py-2.5 flex items-center justify-between text-[11px] text-zinc-650 dark:text-zinc-400 rounded-b-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5 font-medium text-zinc-650 dark:text-zinc-400">
        <Icons.Activity className="h-3.5 w-3.5 text-zinc-550 dark:text-zinc-500 shrink-0" />
        <span>{config.label || 'Ping Real (Latência)'}</span>
      </div>

      <div className="flex items-center">
        {status === 'loading' && (
          <span className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400">
            <Icons.Loader2 className="h-3 w-3 animate-spin text-zinc-400 dark:text-zinc-500 shrink-0" />
            Medindo...
          </span>
        )}

        {config.mode === 'simple' ? (
          <>
            {status === 'success' && (
              <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20 text-[9px] font-bold px-1.5 py-0 rounded-md flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-emerald-500" />
                Online
              </span>
            )}
            {(status === 'timeout' || status === 'error') && (
              <span className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-500/20 text-[9px] font-bold px-1.5 py-0 rounded-md flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-red-500" />
                Offline
              </span>
            )}
          </>
        ) : (
          <>
            {status === 'timeout' && (
              <span className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-500/20 text-[9px] font-semibold px-1.5 py-0 rounded-md flex items-center gap-1">
                <Icons.XCircle className="h-3 w-3 shrink-0 text-red-500" />
                Esgotado (Offline)
              </span>
            )}

            {status === 'error' && (
              <span className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-500/20 text-[9px] font-semibold px-1.5 py-0 rounded-md flex items-center gap-1">
                <Icons.AlertOctagon className="h-3 w-3 shrink-0 text-red-500" />
                Falha
              </span>
            )}

            {status === 'success' && latency !== null && (
              <>
                {latency < config.threshold_green ? (
                  <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-500/20 text-[9px] font-bold px-1.5 py-0 rounded-md flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                    {latency} ms
                  </span>
                ) : latency < config.threshold_yellow ? (
                  <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-250/50 dark:border-amber-500/20 text-[9px] font-bold px-1.5 py-0 rounded-md flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-amber-500" />
                    {latency} ms
                  </span>
                ) : (
                  <span className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200/50 dark:border-red-500/20 text-[9px] font-bold px-1.5 py-0 rounded-md flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-red-550" />
                    {latency} ms
                  </span>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function HomePage() {
  const supabase = getSupabaseClient();

  const [services, setServices] = useState<Service[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [formSchema, setFormSchema] = useState<FormSchema>([]);
  const [statusThresholds, setStatusThresholds] = useState({
    critical: 5,
    warning: 2,
    windowMinutes: 30,
    chartWindowHours: 24,
    labelNormal: 'Operando',
    labelWarning: 'Instabilidade',
    labelCritical: 'Queda total'
  });
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Auto-refresh clock for stats recalculation
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Network Alert State
  const [networkAlerts, setNetworkAlerts] = useState<any[]>([]);
  const [displayInterval, setDisplayInterval] = useState<number>(10); // minutes
  const [autoCloseInterval, setAutoCloseInterval] = useState<number>(60); // seconds
  const [activeAlert, setActiveAlert] = useState<any | null>(null);
  const [isAlertDetailOpen, setIsAlertDetailOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [alertConfig, setAlertConfig] = useState<any>(null);
  const [showRelatedServices, setShowRelatedServices] = useState<boolean>(true);
  const [pingConfig, setPingConfig] = useState<PingConfig>({
    label: 'Ping Real (Latência)',
    threshold_green: 120,
    threshold_yellow: 250,
    mode: 'threshold'
  });

  const resetTimestamp = useMemo(() => {
    let maxTime = 0;
    
    // 1. From database config lastManualAlertInactiveAt
    if (alertConfig?.lastManualAlertInactiveAt) {
      maxTime = Math.max(maxTime, new Date(alertConfig.lastManualAlertInactiveAt).getTime());
    }
    
    // 2. From all alerts in networkAlerts that are inactive or expired
    networkAlerts.forEach((a: any) => {
      const isExpired = a.expires_at && new Date(a.expires_at).getTime() < Date.now();
      if (!a.is_active) {
        const end = new Date(a.updated_at || a.created_at).getTime();
        if (end > maxTime) maxTime = end;
      } else if (isExpired) {
        const end = new Date(a.expires_at).getTime();
        if (end > maxTime) maxTime = end;
      }
    });
    
    return maxTime;
  }, [networkAlerts, alertConfig]);

  const reportsInWindow = useMemo(() => {
    const windowMs = statusThresholds.windowMinutes * 60 * 1000;
    const cutoff = Date.now() - windowMs;
    
    const activeReports = reports.filter(r => {
      const reportTime = new Date(r.created_at).getTime();
      return reportTime >= cutoff && reportTime > resetTimestamp;
    });

    const uniqueSessions = new Set<string>();
    let fallbackCount = 0;

    activeReports.forEach(r => {
      const sessionId = r.custom_fields?.visitor_session_id;
      if (sessionId) {
        uniqueSessions.add(sessionId);
      } else {
        fallbackCount++;
      }
    });

    return uniqueSessions.size + fallbackCount;
  }, [reports, statusThresholds.windowMinutes, resetTimestamp]);

  const isAutoAlertTriggered = useMemo(() => {
    if (!alertConfig || !alertConfig.autoEnabled) return false;
    
    // Ignorar alerta do tipo automático ao validar se existe alerta manual ativo
    const hasActiveManual = activeAlert !== null && activeAlert.alert_type !== 'Detecção Automática';
    if (hasActiveManual) return false;

    const minReports = alertConfig.autoMinReports ?? 5;
    const percentage = alertConfig.autoPercentage ?? 50;

    const computedPercentage = (reportsInWindow / onlineCount) * 100;

    return reportsInWindow >= minReports && computedPercentage >= percentage;
  }, [reportsInWindow, onlineCount, alertConfig, activeAlert]);

  const resolvedAlert = useMemo(() => {
    if (activeAlert) return activeAlert;
    if (isAutoAlertTriggered && alertConfig) {
      return {
        id: 'auto-alert',
        title: alertConfig.autoTitle || 'Detecção Automática de Instabilidade',
        alert_type: 'Detecção Automática',
        description: alertConfig.autoDescription || 'Alto volume de relatos detectado na rede pública.',
        created_at: new Date().toISOString(),
        is_active: true
      };
    }
    return null;
  }, [activeAlert, isAutoAlertTriggered, alertConfig]);

  // Hydration guard for Recharts
  const [isMounted, setIsMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setIsMounted(true);
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const initialTheme = savedTheme || 'light';
    setTheme(initialTheme);
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Tick the clock every 1 minute to auto-clear expired statuses
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Periodic Alert Triggering
  useEffect(() => {
    if (!resolvedAlert) return;

    const showAlertMessage = () => {
      setIsAlertDetailOpen(true);
      toast.warning(
        <div className="flex flex-col gap-1">
          <span className="font-bold text-amber-500 flex items-center gap-1.5">
            <Icons.AlertTriangle className="h-4 w-4 animate-bounce" />
            {resolvedAlert.title} ({resolvedAlert.alert_type})
          </span>
          <span className="text-xs text-zinc-300">{resolvedAlert.description}</span>
        </div>,
        { duration: 8000 }
      );
    };

    const timer = setTimeout(() => {
      showAlertMessage();
    }, 1000);

    const intervalMs = displayInterval * 60 * 1000;
    const interval = setInterval(() => {
      showAlertMessage();
    }, intervalMs);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [resolvedAlert, displayInterval]);

  // Auto-close alert popup after configured seconds
  useEffect(() => {
    if (!isAlertDetailOpen || autoCloseInterval <= 0) return;

    const timer = setTimeout(() => {
      setIsAlertDetailOpen(false);
      toast.info("O aviso foi fechado automaticamente.", { duration: 3000 });
    }, autoCloseInterval * 1000);

    return () => clearTimeout(timer);
  }, [isAlertDetailOpen, autoCloseInterval]);

  // Sincronizar alertas automáticos com o banco de dados
  useEffect(() => {
    if (!alertConfig || !alertConfig.autoEnabled) return;

    // Apenas sincroniza se não houver alerta manual ativo
    const hasActiveManual = activeAlert !== null && activeAlert.alert_type !== 'Detecção Automática';
    if (hasActiveManual) return;

    const syncAutoAlert = async () => {
      try {
        if (isAutoAlertTriggered) {
          // Se disparado, registra/ativa o alerta automático de forma atômica
          const title = alertConfig.autoTitle || 'Detecção Automática de Instabilidade';
          const description = alertConfig.autoDescription || 'Alto volume de relatos detectado na rede pública.';
          await supabase.rpc('manage_auto_alert', {
            trigger_active: true,
            alert_title: title,
            alert_desc: description
          });
        } else {
          // Se normalizado, desativa qualquer alerta automático ativo na tabela
          const hasActiveAutoInDb = networkAlerts.some((a: any) => {
            const isExpired = a.expires_at && new Date(a.expires_at).getTime() < Date.now();
            return a.is_active && !isExpired && a.alert_type === 'Detecção Automática';
          });
          
          if (hasActiveAutoInDb) {
            await supabase.rpc('manage_auto_alert', {
              trigger_active: false,
              alert_title: '',
              alert_desc: ''
            });
          }
        }
      } catch (err) {
        console.error('Erro ao sincronizar alerta automático:', err);
      }
    };

    syncAutoAlert();
  }, [isAutoAlertTriggered, alertConfig, activeAlert, networkAlerts, supabase]);

  // Fetch initial data
  const fetchData = async () => {
    try {
      setIsLoading(true);

      // 1. Fetch services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .order('name');

      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // 2. Fetch reports from the last 24h
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .gt('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;
      setReports(reportsData || []);

      // 3. Fetch all settings (form options and status thresholds)
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('*');

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      if (settingsData && settingsData.length > 0) {
        const schemaSetting = settingsData.find(s => s.key === 'form_schema');
        if (schemaSetting) setFormSchema(schemaSetting.value as FormSchema);

        const formConfigSetting = settingsData.find(s => s.key === 'form_config');
        if (formConfigSetting) {
          setShowRelatedServices(formConfigSetting.value?.showRelatedServices ?? true);
        }

        const thresholds = settingsData.find(s => s.key === 'status_thresholds');
        if (thresholds) {
          setStatusThresholds({
            critical: thresholds.value.critical || 5,
            warning: thresholds.value.warning || 2,
            windowMinutes: thresholds.value.windowMinutes || 30,
            chartWindowHours: thresholds.value.chartWindowHours || 24,
            labelNormal: thresholds.value.labelNormal || 'Operando',
            labelWarning: thresholds.value.labelWarning || 'Instabilidade',
            labelCritical: thresholds.value.labelCritical || 'Queda total'
          });
        }

        const alertsSetting = settingsData.find(s => s.key === 'network_alerts');
        if (alertsSetting) {
          const alertsList = alertsSetting.value || [];
          setNetworkAlerts(alertsList);
          
          // Find the active alert that has not expired
          const active = alertsList.find((a: any) => {
            const isExpired = a.expires_at && new Date(a.expires_at).getTime() < Date.now();
            return a.is_active && !isExpired;
          });
          setActiveAlert(active || null);
        }

        const alertConfigSetting = settingsData.find(s => s.key === 'network_alert_config');
        if (alertConfigSetting) {
          setAlertConfig(alertConfigSetting.value);
          setDisplayInterval(alertConfigSetting.value?.displayInterval ?? 10);
          setAutoCloseInterval(alertConfigSetting.value?.autoCloseInterval ?? 60);
        }

        const pingConfigSetting = settingsData.find(s => s.key === 'ping_config');
        if (pingConfigSetting) {
          setPingConfig({
            label: pingConfigSetting.value.label || 'Ping Real (Latência)',
            threshold_green: pingConfigSetting.value.threshold_green || 120,
            threshold_yellow: pingConfigSetting.value.threshold_yellow || 250,
            mode: pingConfigSetting.value.mode || 'threshold'
          });
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      toast.error('Erro ao conectar com o banco de dados. Verifique a tabela sql.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // 4. Subscribe to Realtime Reports
    const reportsChannel = supabase
      .channel('public:reports')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'reports' },
        (payload) => {
          const newReport = payload.new as Report;
          setReports((prev) => [newReport, ...prev]);

          // Notify user of new reports
          const serviceName = services.find(s => s.id === newReport.service_id)?.name || 'Um serviço';
          toast.info(`Novo relato de instabilidade registrado para ${serviceName}!`, {
            description: `${newReport.issue_type} em ${newReport.region}`,
            icon: <Icons.AlertTriangle className="h-4 w-4 text-yellow-500" />,
          });
        }
      )
      .subscribe();

    // 5. Subscribe to Realtime Settings (Form options & Thresholds)
    const settingsChannel = supabase
      .channel('public:settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        (payload) => {
          const updatedSetting = payload.new as any;
          if (updatedSetting.key === 'form_schema') {
            setFormSchema(updatedSetting.value as FormSchema);
            toast.success('Campos do formulário atualizados pelo administrador!');
          }
          if (updatedSetting.key === 'form_config') {
            setShowRelatedServices(updatedSetting.value?.showRelatedServices ?? true);
            toast.info('Configurações de formulário atualizadas!');
          }
          if (updatedSetting.key === 'status_thresholds') {
            setStatusThresholds({
              critical: updatedSetting.value.critical || 5,
              warning: updatedSetting.value.warning || 2,
              windowMinutes: updatedSetting.value.windowMinutes || 30,
              chartWindowHours: updatedSetting.value.chartWindowHours || 24,
              labelNormal: updatedSetting.value.labelNormal || 'Operando',
              labelWarning: updatedSetting.value.labelWarning || 'Instabilidade',
              labelCritical: updatedSetting.value.labelCritical || 'Queda total'
            });
            toast.info('Regras de cálculo de instabilidade atualizadas!');
          }
          if (updatedSetting.key === 'network_alerts') {
            const alertsList = updatedSetting.value || [];
            setNetworkAlerts(alertsList);
            const active = alertsList.find((a: any) => {
              const isExpired = a.expires_at && new Date(a.expires_at).getTime() < Date.now();
              return a.is_active && !isExpired;
            });
            setActiveAlert(active || null);
            toast.info('Alertas de rede atualizados!');
          }
          if (updatedSetting.key === 'network_alert_config') {
            setAlertConfig(updatedSetting.value);
            setDisplayInterval(updatedSetting.value?.displayInterval ?? 10);
            setAutoCloseInterval(updatedSetting.value?.autoCloseInterval ?? 60);
            toast.info('Configurações de alerta atualizadas!');
          }
          if (updatedSetting.key === 'ping_config') {
            setPingConfig({
              label: updatedSetting.value.label || 'Ping Real (Latência)',
              threshold_green: updatedSetting.value.threshold_green || 120,
              threshold_yellow: updatedSetting.value.threshold_yellow || 250,
              mode: updatedSetting.value.mode || 'threshold'
            });
            toast.info('Configurações globais de ping atualizadas!');
          }
        }
      )
      .subscribe();

    // 6. Subscribe to Realtime Services (e.g. if the admin edits them)
    const servicesChannel = supabase
      .channel('public:services')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'services' },
        () => {
          fetchData(); // Reload services lists
        }
      )
      .subscribe();

    // 7. Subscribe to Realtime Presence for visitor count
    const presenceChannel = supabase.channel('site_presence');
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const count = Object.keys(state).length;
        setOnlineCount(count > 0 ? count : 1);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const tempUserId = Math.random().toString(36).substring(7);
          await presenceChannel.track({ online_at: new Date().toISOString(), user_id: tempUserId });
        }
      });

    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(servicesChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [services.length, supabase]);

  // DYNAMIC COMPUTATIONS
  // Calculate reports per service in the configured time window (for dynamic status)
  // Calculate reports per service in the last 24 hours (for unstable ranking)
  const serviceStats = useMemo(() => {
    const windowMs = statusThresholds.windowMinutes * 60 * 1000;
    const timeWindowAgo = Date.now() - windowMs;
    const stats: Record<string, { count24h: number; countWindow: number; status: ServiceStatus }> = {};

    // Initialize stats for each service
    services.forEach((s) => {
      stats[s.id] = { count24h: 0, countWindow: 0, status: 'normal' };
    });

    reports.forEach((r) => {
      if (!stats[r.service_id]) return;

      const reportTime = new Date(r.created_at).getTime();
      stats[r.service_id].count24h += 1;

      if (reportTime >= timeWindowAgo) {
        stats[r.service_id].countWindow += 1;
      }
    });

    // Calculate dynamic status based on configured window activity
    Object.keys(stats).forEach((serviceId) => {
      const count = stats[serviceId].countWindow;
      if (count >= statusThresholds.critical) {
        stats[serviceId].status = 'critical';
      } else if (count >= statusThresholds.warning) {
        stats[serviceId].status = 'warning';
      } else {
        stats[serviceId].status = 'normal';
      }
    });

    return stats;
  }, [services, reports, statusThresholds, currentTime]);

  // Aggregate stats
  const totalReports24h = reports.length;

  const mostUnstable = useMemo(() => {
    if (services.length === 0 || reports.length === 0) return null;

    let maxServiceId = '';
    let maxCount = 0;

    Object.entries(serviceStats).forEach(([id, stat]) => {
      if (stat.count24h > maxCount) {
        maxCount = stat.count24h;
        maxServiceId = id;
      }
    });

    if (maxCount === 0) return null;

    const service = services.find((s) => s.id === maxServiceId);
    return service ? { service, count: maxCount } : null;
  }, [services, reports, serviceStats]);

  // Sort services by number of reports (descending)
  const sortedServices = useMemo(() => {
    return [...services].sort((a, b) => {
      const countA = serviceStats[a.id]?.count24h || 0;
      const countB = serviceStats[b.id]?.count24h || 0;
      return countB - countA;
    });
  }, [services, serviceStats]);

  // Hourly timeline for the configured window (for the area chart)
  const hourlyTimeline = useMemo(() => {
    const now = new Date();
    const buckets: Record<string, number> = {};
    const windowHours = statusThresholds.chartWindowHours || 24;

    for (let i = windowHours - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 60 * 1000);
      const label = `${String(d.getHours()).padStart(2, '0')}:00`;
      buckets[label] = 0;
    }

    reports.forEach((r) => {
      const reportTime = new Date(r.created_at).getTime();
      const cutoffTime = now.getTime() - windowHours * 60 * 60 * 1000;
      if (reportTime >= cutoffTime) {
        const d = new Date(r.created_at);
        const label = `${String(d.getHours()).padStart(2, '0')}:00`;
        if (buckets[label] !== undefined) {
          buckets[label] += 1;
        }
      }
    });

    return Object.entries(buckets).map(([hora, relatos]) => ({ hora, relatos }));
  }, [reports, statusThresholds.chartWindowHours]);

  // Aggregate stats based on dynamic window
  const totalReportsInWindow = useMemo(() => {
    const windowHours = statusThresholds.chartWindowHours || 24;
    const cutoffTime = Date.now() - windowHours * 60 * 60 * 1000;
    return reports.filter(r => new Date(r.created_at).getTime() >= cutoffTime).length;
  }, [reports, statusThresholds.chartWindowHours, currentTime]);

  const handleOpenReport = (service: Service) => {
    setSelectedService(service);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-950 dark:text-white flex flex-col font-sans">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/30 dark:from-indigo-950/20 via-zinc-100/10 dark:via-zinc-950/45 to-transparent dark:to-black pointer-events-none z-0" />

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-900 bg-zinc-200/90 dark:bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IntradetectorLogo size="lg" showTagline={true} />
           {resolvedAlert && (
            <button
              onClick={() => setIsAlertDetailOpen(true)}
              className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 border border-amber-500/20 px-3 py-1.5 rounded-full transition-all duration-300 animate-pulse cursor-pointer group shadow-lg shadow-amber-500/5 ml-2"
              title="Clique para ver detalhes do alerta de rede"
            >
              <Icons.AlertTriangle className="h-4 w-4 text-amber-600 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline-block">Alerta de Rede</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 text-zinc-550 hover:text-black dark:text-zinc-400 dark:hover:text-white rounded-xl"
            title="Alternar tema"
          >
            {theme === 'dark' ? <Icons.Sun className="h-4.5 w-4.5" /> : <Icons.Moon className="h-4.5 w-4.5" />}
          </Button>

          <Link href="/admin">
            <Button variant="outline" className="border-zinc-300 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-all text-xs font-semibold gap-1.5 rounded-xl">
              <Icons.Shield className="h-4 w-4" />
              Painel Admin
            </Button>
          </Link>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 py-8 md:py-12 flex flex-col gap-10">
        
        {/* HERO SECTION */}
        <section className="text-center space-y-4 max-w-2xl mx-auto py-4">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-black dark:text-white leading-tight">
            Relatos de falhas em tempo real
          </h2>
        </section>

        {/* AREA CHART — report volume */}
        <section className="max-w-4xl mx-auto w-full">
          <Card className="bg-white/80 dark:bg-zinc-950/60 border-zinc-200 dark:border-zinc-900 shadow-sm backdrop-blur-sm overflow-hidden relative">
            {/* Red ambient glow */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-80 h-40 bg-red-500/5 dark:bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

            <CardContent className="p-5 pt-4">
              {/* Header row */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">
                    Volume de Relatos — Últimas {statusThresholds.chartWindowHours || 24}h
                  </p>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    {isLoading ? (
                      <Icons.Loader2 className="h-5 w-5 animate-spin text-red-500" />
                    ) : (
                      <>
                        <span className="text-2xl font-extrabold text-black dark:text-white">{totalReportsInWindow}</span>
                        <span className="text-xs text-zinc-500 font-medium">relatos</span>
                        {mostUnstable && (
                          <span className="text-[10px] text-red-650 dark:text-red-400 font-semibold flex items-center gap-1 ml-2">
                            <Icons.Flame className="h-3 w-3" />
                            Pico: {mostUnstable.service.name}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Realtime</span>
                </div>
              </div>

              {/* Area Chart */}
              <div className="h-36">
                {isMounted ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={hourlyTimeline} margin={{ top: 4, right: 4, left: -30, bottom: 0 }}>
                      <defs>
                        <linearGradient id="redGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="hora"
                        stroke="#71717a"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        interval={statusThresholds.chartWindowHours <= 4 ? 0 : statusThresholds.chartWindowHours <= 12 ? 2 : 3}
                      />
                      <YAxis
                        stroke="#71717a"
                        fontSize={9}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: theme === 'dark' ? '#09090b' : '#ffffff',
                          borderColor: theme === 'dark' ? '#3f3f46' : '#e4e4e7',
                          borderRadius: '10px',
                          fontSize: '11px',
                        }}
                        labelStyle={{ color: theme === 'dark' ? '#ffffff' : '#000000', fontWeight: 'bold' }}
                        itemStyle={{ color: theme === 'dark' ? '#f87171' : '#dc2626' }}
                        formatter={(value) => [`${value ?? 0} relatos`, '']}
                      />
                      <Area
                        type="monotone"
                        dataKey="relatos"
                        stroke="#ef4444"
                        strokeWidth={2}
                        fill="url(#redGradient)"
                        dot={false}
                        activeDot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <Icons.Loader2 className="h-6 w-6 animate-spin text-red-500/50" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* LOADING STATE FOR SERVICES */}
        {isLoading && services.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Icons.Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <span className="text-zinc-500 text-sm">Carregando painel de serviços...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-900 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-black dark:text-white">Todos os Serviços</span>
                <Badge className="bg-zinc-200 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-800 text-[10px] px-2 py-0.5 rounded-md">
                  {sortedServices.length}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                {isSearchOpen && (
                  <input
                    type="text"
                    autoFocus
                    placeholder="Buscar serviço..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-40 md:w-56 bg-white dark:bg-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-md px-3 text-sm text-black dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-900"
                  onClick={() => {
                    setIsSearchOpen(!isSearchOpen);
                    if (isSearchOpen) setSearchQuery('');
                  }}
                >
                  {isSearchOpen ? <Icons.X className="h-4 w-4" /> : <Icons.Search className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sortedServices
                .filter(s => 
                  s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (s.category && s.category.toLowerCase().includes(searchQuery.toLowerCase()))
                )
                .map((service) => {
                const stats = serviceStats[service.id] || { count24h: 0, count30m: 0, status: 'normal' };
                const currentStatus = stats.status;
                
                // Render styling depending on dynamic status
                let statusColor = 'bg-emerald-500';
                let glowColor = 'hover:border-emerald-500/30 hover:shadow-emerald-500/5';
                let statusLabel = statusThresholds.labelNormal || 'Operando';
                let badgeBg = 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-250/50 dark:border-emerald-500/20';

                if (currentStatus === 'warning') {
                  statusColor = 'bg-amber-500';
                  glowColor = 'hover:border-amber-500/30 hover:shadow-amber-500/5';
                  statusLabel = statusThresholds.labelWarning || 'Instabilidade';
                  badgeBg = 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-250/50 dark:border-emerald-500/20';
                } else if (currentStatus === 'critical') {
                  statusColor = 'bg-red-500';
                  glowColor = 'hover:border-red-500/30 hover:shadow-red-500/5';
                  statusLabel = statusThresholds.labelCritical || 'Queda total';
                  badgeBg = 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-250/50 dark:border-red-500/20';
                }

                return (
                  <Card
                    key={service.id}
                    onClick={() => handleOpenReport(service)}
                    className={`group cursor-pointer bg-white dark:bg-zinc-950/45 border-zinc-200 dark:border-zinc-900 transition-all duration-300 hover:translate-y-[-2px] hover:bg-zinc-50 dark:hover:bg-zinc-950 hover:shadow-md dark:hover:shadow-lg ${glowColor} border flex flex-col`}
                  >
                    <CardContent className="p-5 flex-1 flex items-center justify-between">
                      <div className="flex items-center gap-3.5">
                        <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-xl text-zinc-650 dark:text-zinc-300 group-hover:text-indigo-650 dark:group-hover:text-white transition-colors">
                          {getServiceIcon(service.icon_name, service.category)}
                        </div>
                        <div>
                          <h3 className="font-bold text-black dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-sm md:text-base">
                            {service.name}
                          </h3>
                          <span className="text-[11px] text-zinc-500">{service.category}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        {/* Glowing Status Dot */}
                        <div className="flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            {currentStatus !== 'normal' && (
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${statusColor} opacity-75`}></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-2 w-2 ${statusColor}`}></span>
                          </span>
                          <span className="text-xs text-zinc-700 dark:text-zinc-400 font-medium">{statusLabel}</span>
                        </div>
                        {/* Reports badge if any */}
                        {stats.count24h > 0 && (
                          <Badge className={`${badgeBg} text-[9px] px-1.5 py-0.5 rounded-md`}>
                            {stats.count24h} relatos (24h)
                          </Badge>
                        )}
                      </div>
                    </CardContent>

                    {/* Ping Real-time Monitor */}
                    {service.ping_enabled && (
                      <ServicePing service={service} config={pingConfig} />
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-zinc-200 dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-950 py-8 px-6 text-center text-xs text-zinc-650 dark:text-zinc-400 max-w-7xl mx-auto w-full">
        <p>&copy; {new Date().getFullYear()} Intradetector. Todos os direitos reservados.</p>
      </footer>

      {/* REPORT MODAL */}
      <ReportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        service={selectedService}
        schema={formSchema}
        onSuccess={fetchData}
        activeAlert={resolvedAlert}
        services={services}
        showRelatedServices={showRelatedServices}
      />

      {/* ACTIVE NETWORK ALERT DETAILS MODAL */}
      <Dialog open={isAlertDetailOpen} onOpenChange={(open) => !open && setIsAlertDetailOpen(false)}>
        <DialogContent className="max-w-md w-full bg-white border border-zinc-200 text-black rounded-2xl p-6 overflow-hidden shadow-xl">
          {/* Subtle red ambient glow inside modal */}
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

          {resolvedAlert && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="border-amber-300 text-amber-700 text-[10px] uppercase font-bold tracking-widest flex gap-1 items-center bg-amber-50">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping mr-1" />
                    {resolvedAlert.alert_type}
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-extrabold flex items-center gap-2 text-black leading-tight">
                  <Icons.AlertTriangle className="h-5 w-5 text-amber-500 animate-bounce" />
                  <span>{resolvedAlert.title}</span>
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-[11px] pt-1">
                  Publicado em {new Date(resolvedAlert.created_at).toLocaleString('pt-BR')}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-4 relative z-10">
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 text-zinc-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {resolvedAlert.description}
                </div>

                <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-3.5 flex items-start gap-3">
                  <Icons.Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-snug">
                    <strong>Atenção Operadores:</strong> Registrem qualquer relato técnico de instabilidade correlacionado a este alerta para fins de auditoria e mapeamento de impacto.
                  </p>
                </div>
              </div>

              <div className="flex justify-end mt-6 pt-4 border-t border-zinc-200">
                <Button
                  onClick={() => setIsAlertDetailOpen(false)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-lg shadow-indigo-600/10 text-xs"
                >
                  Entendido
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
