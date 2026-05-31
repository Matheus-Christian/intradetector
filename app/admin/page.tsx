'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseClient } from '@/lib/supabase';
import { Service, Report, ReportOptions, Setting, FormSchema } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import {
  Loader2,
  LogOut,
  RefreshCw,
  Trash2,
  Sliders,
  BarChart3,
  ListTodo,
  CheckCircle2,
  XCircle,
  Shield,
  ArrowLeft,
  Plus,
  Edit2,
  Globe,
  Wifi,
  Video,
  Signal,
  Filter,
  AlertCircle,
  Layers,
  FormInput
} from 'lucide-react';
import Link from 'next/link';
import IntradetectorLogo from '@/components/intradetector-logo';
import FormBuilder from '@/components/form-builder';

const AVAILABLE_CATEGORIES = ['Redes Sociais', 'Streaming', 'Jogos', 'IPTV & Provedores'];
const COMMON_ICONS = [
  { value: 'MessageSquare', label: 'Mensagens / Social' },
  { value: 'Tv', label: 'Streaming Geral' },
  { value: 'Video', label: 'YouTube / Vídeo' },
  { value: 'Signal', label: 'Twitch / Live' },
  { value: 'Gamepad2', label: 'Jogos' },
  { value: 'Wifi', label: 'Provedores de Internet' },
  { value: 'Globe', label: 'IPTV / Geral' },
];

export default function AdminPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [formSetting, setFormSetting] = useState<Setting | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'reports' | 'analytics' | 'settings'>('reports');

  // Hydration Guard
  const [isMounted, setIsMounted] = useState(false);

  // --- FILTERS STATE (ANALYTICS) ---
  const [filterService, setFilterService] = useState('all');
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
  const [filterTimeRange, setFilterTimeRange] = useState('24h');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area'>('bar');

  // --- SERVICE CRUD STATE ---
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null); // null means adding new service
  const [serviceFormName, setServiceFormName] = useState('');
  const [serviceFormCategory, setServiceFormCategory] = useState('Redes Sociais');
  const [serviceFormIcon, setServiceFormIcon] = useState('Globe');
  const [serviceFormCustomIcon, setServiceFormCustomIcon] = useState('');
  const [serviceFormStatus, setServiceFormStatus] = useState<'normal' | 'warning' | 'critical'>('normal');
  const [isSavingService, setIsSavingService] = useState(false);

  // --- FORM OPTIONS CONFIG STATE ---
  const [formSchema, setFormSchema] = useState<FormSchema>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // --- THRESHOLDS CONFIG STATE ---
  const [thresholdSetting, setThresholdSetting] = useState<Setting | null>(null);
  const [thresholdCritical, setThresholdCritical] = useState<number>(5);
  const [thresholdWarning, setThresholdWarning] = useState<number>(2);
  const [thresholdWindow, setThresholdWindow] = useState<number>(30);
  const [chartWindowHours, setChartWindowHours] = useState<number>(24);
  const [labelNormal, setLabelNormal] = useState<string>('Operando');
  const [labelWarning, setLabelWarning] = useState<string>('Instabilidade');
  const [labelCritical, setLabelCritical] = useState<string>('Queda total');
  const [isSavingThresholds, setIsSavingThresholds] = useState(false);
  const [settingsSubTab, setSettingsSubTab] = useState<'cards' | 'form' | 'rules'>('cards');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Authentication check
  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Acesso negado. Por favor, faça login.');
        router.push('/login');
      } else {
        setIsAuthenticated(true);
        loadData();
      }
    }
    checkAuth();
  }, [router, supabase]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // 1. Fetch Services
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .order('name');
      if (servicesError) throw servicesError;
      setServices(servicesData || []);

      // 2. Fetch Reports (with full service object)
      const { data: reportsData, error: reportsError } = await supabase
        .from('reports')
        .select(`
          *,
          services (
            id,
            name,
            category
          )
        `)
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;
      setReports(reportsData || []);

      // 3. Fetch Settings options (form_schema)
      const { data: settingsData, error: settingsError } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'form_schema')
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

      if (settingsData) {
        setFormSetting(settingsData);
        setFormSchema(settingsData.value as FormSchema);
      }

      // 4. Fetch Status Thresholds Settings
      const { data: thresholdsData, error: thresholdsError } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'status_thresholds')
        .single();

      if (thresholdsError && thresholdsError.code !== 'PGRST116') throw thresholdsError;

      if (thresholdsData) {
        setThresholdSetting(thresholdsData);
        const thresholds = thresholdsData.value;
        setThresholdCritical(thresholds.critical || 5);
        setThresholdWarning(thresholds.warning || 2);
        setThresholdWindow(thresholds.windowMinutes || 30);
        setChartWindowHours(thresholds.chartWindowHours || 24);
        setLabelNormal(thresholds.labelNormal || 'Operando');
        setLabelWarning(thresholds.labelWarning || 'Instabilidade');
        setLabelCritical(thresholds.labelCritical || 'Queda total');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao carregar dados: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Desconectado com sucesso.');
    router.push('/login');
  };

  // --- REPORT MODERATION ---
  const handleDeleteReport = async (id: string) => {
    if (!confirm('Deseja realmente excluir este relato?')) return;

    try {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;

      toast.success('Relato excluído com sucesso.');
      setReports((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) {
      toast.error(`Erro ao excluir: ${err.message}`);
    }
  };

  // --- SERVICE CRUD HANDLERS ---
  const handleOpenAddService = () => {
    setEditingService(null);
    setServiceFormName('');
    setServiceFormCategory('Redes Sociais');
    setServiceFormIcon('Globe');
    setServiceFormCustomIcon('');
    setServiceFormStatus('normal');
    setIsServiceModalOpen(true);
  };

  const handleOpenEditService = (service: Service) => {
    setEditingService(service);
    setServiceFormName(service.name);
    setServiceFormCategory(service.category);
    
    // Check if the icon is custom or standard
    const isStandard = COMMON_ICONS.some(i => i.value === service.icon_name);
    if (isStandard) {
      setServiceFormIcon(service.icon_name || 'Globe');
      setServiceFormCustomIcon('');
    } else {
      setServiceFormIcon('custom');
      setServiceFormCustomIcon(service.icon_name || '');
    }
    
    setServiceFormStatus(service.status);
    setIsServiceModalOpen(true);
  };

  const handleDeleteService = async (id: string) => {
    if (!confirm('ATENÇÃO: Excluir este serviço apagará permanentemente todos os relatos associados a ele. Deseja continuar?')) {
      return;
    }

    try {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;

      toast.success('Serviço excluído com sucesso!');
      loadData();
    } catch (err: any) {
      toast.error(`Erro ao excluir serviço: ${err.message}`);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serviceFormName.trim() || !serviceFormCategory) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    setIsSavingService(true);
    const finalIcon = serviceFormIcon === 'custom' ? serviceFormCustomIcon.trim() : serviceFormIcon;

    const serviceData = {
      name: serviceFormName.trim(),
      category: serviceFormCategory,
      icon_name: finalIcon || 'Globe',
      status: editingService ? editingService.status : 'normal'
    };

    try {
      if (editingService) {
        // Edit Existing
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id);
        
        if (error) throw error;
        toast.success('Serviço atualizado com sucesso!');
      } else {
        // Add New
        const { error } = await supabase
          .from('services')
          .insert(serviceData);
        
        if (error) throw error;
        toast.success('Novo serviço adicionado!');
      }

      setIsServiceModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(`Erro ao salvar serviço: ${err.message}`);
    } finally {
      setIsSavingService(false);
    }
  };

  // --- FORM OPTIONS CONFIG HANDLERS ---
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);

    if (formSchema.length === 0) {
      toast.error('O formulário precisa ter pelo menos um campo.');
      setIsSavingSettings(false);
      return;
    }

    try {
      // Clean empty lines from options before saving
      const cleanedSchema = formSchema.map(field => ({
        ...field,
        options: (field.options || []).map(o => o.trim()).filter(Boolean),
      }));

      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'form_schema',
          value: cleanedSchema,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Esquema do formulário salvo e sincronizado!');
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // --- THRESHOLDS CONFIG HANDLER ---
  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingThresholds(true);

    if (thresholdCritical <= thresholdWarning) {
      toast.error('O limite crítico deve ser maior que o limite de alerta (instabilidade).');
      setIsSavingThresholds(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'status_thresholds',
          value: {
            critical: thresholdCritical,
            warning: thresholdWarning,
            windowMinutes: thresholdWindow,
            chartWindowHours: chartWindowHours,
            labelNormal: labelNormal.trim(),
            labelWarning: labelWarning.trim(),
            labelCritical: labelCritical.trim()
          },
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      toast.success('Regras de cálculo atualizadas! O site público usará as novas regras instantaneamente.');
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSavingThresholds(false);
    }
  };

  // --- FILTER & CHART COMPUTATIONS ---
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // 1. Filter by Service
      if (filterService !== 'all' && r.service_id !== filterService) return false;
      
      // 2. Dynamic Filters
      for (const [key, value] of Object.entries(dynamicFilters)) {
        if (value !== 'all') {
          // Read from legacy column or custom_fields
          const fieldValue = (r as any)[key] ?? r.custom_fields?.[key];
          if (fieldValue !== value) return false;
        }
      }
      
      // 3. Filter by Time Range
      const reportTime = new Date(r.created_at).getTime();
      const now = Date.now();
      if (filterTimeRange === '24h') {
        return now - reportTime <= 24 * 60 * 60 * 1000;
      } else if (filterTimeRange === '7d') {
        return now - reportTime <= 7 * 24 * 60 * 60 * 1000;
      } else if (filterTimeRange === '30d') {
        return now - reportTime <= 30 * 24 * 60 * 60 * 1000;
      }
      return true; // 'all'
    });
  }, [reports, filterService, dynamicFilters, filterTimeRange]);

  // Bar Chart Data (Reports per Service)
  const barChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Initialize counts for services that have reports
    filteredReports.forEach(r => {
      const svcName = r.services?.name || services.find(s => s.id === r.service_id)?.name || 'Serviço Excluído';
      counts[svcName] = (counts[svcName] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, relatos: count }))
      .sort((a, b) => b.relatos - a.relatos);
  }, [services, filteredReports]);

  // Pie Chart Data (Resolved vs Unresolved after reboot)
  const pieChartData = useMemo(() => {
    let resolved = 0;
    let unresolved = 0;

    filteredReports.forEach(r => {
      if (r.is_resolved) {
        resolved += 1;
      } else {
        unresolved += 1;
      }
    });

    return [
      { name: 'Resolvidos pós Reboot', value: resolved, color: '#10b981' },
      { name: 'Não Resolvidos', value: unresolved, color: '#ef4444' }
    ];
  }, [filteredReports]);

  // Timeline Data (Line/Area Chart showing trend over hours/days)
  const timelineData = useMemo(() => {
    if (filterTimeRange === '24h') {
      // Group by hour (24 hours window)
      const hourlyData: Record<string, number> = {};
      const now = new Date();
      
      // Initialize the last 24 hours in the format "HH:00"
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 60 * 60 * 1000);
        const hourStr = `${String(d.getHours()).padStart(2, '0')}:00`;
        hourlyData[hourStr] = 0;
      }

      filteredReports.forEach((r) => {
        const d = new Date(r.created_at);
        const hourStr = `${String(d.getHours()).padStart(2, '0')}:00`;
        if (hourlyData[hourStr] !== undefined) {
          hourlyData[hourStr] += 1;
        }
      });

      return Object.entries(hourlyData).map(([hour, count]) => ({
        label: hour,
        relatos: count,
      }));
    } else {
      // Group by day for 7d, 30d, all
      const dailyData: Record<string, number> = {};
      const now = new Date();
      // Determine days count
      let daysCount = 7;
      if (filterTimeRange === '30d') daysCount = 30;
      else if (filterTimeRange === 'all') daysCount = 60; // default view for all time

      // Initialize the last N days in the format "DD/MM"
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        dailyData[dateStr] = 0;
      }

      filteredReports.forEach((r) => {
        const d = new Date(r.created_at);
        const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (dailyData[dateStr] !== undefined) {
          dailyData[dateStr] += 1;
        }
      });

      return Object.entries(dailyData).map(([date, count]) => ({
        label: date,
        relatos: count,
      }));
    }
  }, [filteredReports, filterTimeRange]);

  if (!isAuthenticated || isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <span className="text-zinc-500 text-sm font-medium">Validando credenciais e carregando dados...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-zinc-950/45 to-black pointer-events-none z-0" />

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IntradetectorLogo size="lg" showTagline={true} />
          <span className="text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full font-semibold mt-3.5">Admin</span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="outline" className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all text-xs font-semibold gap-1.5 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              Ver Site Público
            </Button>
          </Link>
          
          <Button
            onClick={loadData}
            variant="outline"
            className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-all rounded-xl"
            title="Recarregar dados"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button
            onClick={handleLogout}
            className="bg-red-950/30 hover:bg-red-900/40 text-red-400 border border-red-500/10 font-semibold gap-1.5 rounded-xl"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      {/* TAB NAVIGATION */}
      <div className="relative z-10 border-b border-zinc-900 bg-zinc-950/20 backdrop-blur-sm px-6 py-2 flex gap-2">
        <Button
          onClick={() => setActiveTab('reports')}
          variant="ghost"
          className={`rounded-xl text-sm font-semibold transition-all gap-1.5 ${
            activeTab === 'reports'
              ? 'bg-zinc-900 text-white border border-zinc-800'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <ListTodo className="h-4 w-4" />
          Relatos ({reports.length})
        </Button>
        <Button
          onClick={() => setActiveTab('analytics')}
          variant="ghost"
          className={`rounded-xl text-sm font-semibold transition-all gap-1.5 ${
            activeTab === 'analytics'
              ? 'bg-zinc-900 text-white border border-zinc-800'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          Gráficos & Análises
        </Button>
        <Button
          onClick={() => setActiveTab('settings')}
          variant="ghost"
          className={`rounded-xl text-sm font-semibold transition-all gap-1.5 ${
            activeTab === 'settings'
              ? 'bg-zinc-900 text-white border border-zinc-800'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Configurações
        </Button>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 py-8 flex flex-col gap-6">
        
        {/* TAB 1: REPORTS TABLE */}
        {activeTab === 'reports' && (
          <Card className="bg-zinc-950/60 border-zinc-900 text-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold">Relatos Recebidos</CardTitle>
                <CardDescription className="text-zinc-500">Listagem de reclamações técnicas registradas em ordem decrescente.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {reports.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  Nenhum relato recebido até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-zinc-900">
                  <Table className="bg-zinc-950/80">
                    <TableHeader className="bg-zinc-900/50 border-zinc-850">
                      <TableRow className="hover:bg-zinc-900/20">
                        <TableHead className="text-zinc-400 font-semibold">Data</TableHead>
                        <TableHead className="text-zinc-400 font-semibold">Serviço</TableHead>
                        {formSchema.map(f => (
                          <TableHead key={f.id} className="text-zinc-400 font-semibold">{f.label}</TableHead>
                        ))}
                        <TableHead className="text-zinc-400 font-semibold text-center">Resolvido?</TableHead>
                        <TableHead className="text-zinc-400 font-semibold text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => {
                        const dateFormatted = new Date(report.created_at).toLocaleString('pt-BR');
                        const svcName = report.services?.name || 'Serviço Excluído';
                        return (
                          <TableRow key={report.id} className="hover:bg-zinc-900/30 border-zinc-900">
                            <TableCell className="text-zinc-300 text-xs whitespace-nowrap">{dateFormatted}</TableCell>
                            <TableCell className="font-bold text-white text-sm">{svcName}</TableCell>
                            {formSchema.map(f => {
                              const val = (report as any)[f.id] ?? report.custom_fields?.[f.id] ?? '-';
                              return (
                                <TableCell key={f.id} className="text-zinc-300 text-xs max-w-[200px] truncate" title={val}>{val}</TableCell>
                              );
                            })}
                            <TableCell className="text-center">
                              {report.is_resolved ? (
                                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] mx-auto w-fit flex gap-1 items-center justify-center">
                                  <CheckCircle2 className="h-3 w-3" /> Sim
                                </Badge>
                              ) : (
                                <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] mx-auto w-fit flex gap-1 items-center justify-center">
                                  <XCircle className="h-3 w-3" /> Não
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() => handleDeleteReport(report.id)}
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                                title="Excluir relato"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 2: ANALYTICAL CHARTS & FILTERS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* INTERACTIVE FILTER BAR */}
            <Card className="bg-zinc-950/60 border-zinc-900 text-white">
              <CardHeader className="py-4 border-b border-zinc-900 flex flex-row items-center gap-2">
                <Filter className="h-4 w-4 text-indigo-400" />
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-300">Filtros Analíticos</CardTitle>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                {/* Filter: Service */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-semibold">Serviço</Label>
                  <Select value={filterService} onValueChange={(val) => setFilterService(val || 'all')}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectItem value="all">Todos os Serviços</SelectItem>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dynamic Filters from Schema */}
                {formSchema.filter(f => f.type === 'select').slice(0, 3).map(field => (
                  <div key={field.id} className="space-y-1.5">
                    <Label className="text-xs text-zinc-400 font-semibold">{field.label}</Label>
                    <Select 
                      value={dynamicFilters[field.id] || 'all'} 
                      onValueChange={(val) => setDynamicFilters(prev => ({ ...prev, [field.id]: val || 'all' }))}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        <SelectItem value="all">Todas as opções</SelectItem>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}

                {/* Filter: Time Range */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400 font-semibold">Período</Label>
                  <Select value={filterTimeRange} onValueChange={(val) => setFilterTimeRange(val || '24h')}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectItem value="24h">Últimas 24 Horas</SelectItem>
                      <SelectItem value="7d">Últimos 7 Dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 Dias</SelectItem>
                      <SelectItem value="all">Todo o Histórico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* CHARTS CONTAINER */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Primary Dynamic Graph (Bar, Line, Area) */}
              <Card className="bg-zinc-950/60 border-zinc-900 text-white lg:col-span-2">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                  <div>
                    <CardTitle className="text-lg font-bold">Volume de Instabilidade</CardTitle>
                    <CardDescription className="text-zinc-500">
                      Visualização reativa contendo {filteredReports.length} relatos filtrados.
                    </CardDescription>
                  </div>
                  {/* CHART TOGGLE BUTTONS */}
                  <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                    <Button
                      onClick={() => setChartType('bar')}
                      variant="ghost"
                      className={`h-8 px-3 rounded-lg text-xs font-semibold ${
                        chartType === 'bar' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Barras
                    </Button>
                    <Button
                      onClick={() => setChartType('line')}
                      variant="ghost"
                      className={`h-8 px-3 rounded-lg text-xs font-semibold ${
                        chartType === 'line' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Linha
                    </Button>
                    <Button
                      onClick={() => setChartType('area')}
                      variant="ghost"
                      className={`h-8 px-3 rounded-lg text-xs font-semibold ${
                        chartType === 'area' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Área
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="h-[350px] min-h-[300px] pt-4">
                  {isMounted && filteredReports.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'bar' ? (
                        <BarChart data={barChartData} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
                          <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip
                            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            contentStyle={{ backgroundColor: '#09090b', borderColor: '#18181b', borderRadius: '12px' }}
                            labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                          />
                          <Bar dataKey="relatos" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      ) : chartType === 'line' ? (
                        <LineChart data={timelineData} margin={{ top: 20, right: 15, left: -20, bottom: 20 }}>
                          <XAxis dataKey="label" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#09090b', borderColor: '#18181b', borderRadius: '12px' }}
                            labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                          />
                          <Line type="monotone" dataKey="relatos" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', strokeWidth: 1, r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      ) : (
                        <AreaChart data={timelineData} margin={{ top: 20, right: 15, left: -20, bottom: 20 }}>
                          <defs>
                            <linearGradient id="colorRelatos" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="label" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#09090b', borderColor: '#18181b', borderRadius: '12px' }}
                            labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                          />
                          <Area type="monotone" dataKey="relatos" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRelatos)" />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-2">
                      <AlertCircle className="h-8 w-8 text-zinc-600" />
                      <span className="text-xs">Nenhum relato atende aos filtros atuais.</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resolved vs Unresolved Proportion */}
              <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                <CardHeader>
                  <CardTitle className="text-lg font-bold">Reboot Eficácia</CardTitle>
                  <CardDescription className="text-zinc-500">Relatos resolvidos ou não pós reboot no escopo filtrado.</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] min-h-[300px] flex flex-col justify-between pt-4">
                  {isMounted && filteredReports.length > 0 ? (
                    <>
                      <div className="flex-1 h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieChartData}
                              cx="50%"
                              cy="45%"
                              innerRadius={55}
                              outerRadius={75}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {pieChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#09090b', borderColor: '#18181b', borderRadius: '12px' }}
                            />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="text-center text-[10px] text-zinc-500">
                        Proporção calculada para {filteredReports.length} relatos.
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                      Sem dados de proporção.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS (FORM OPTIONS + SERVICE CRUD) */}
        {activeTab === 'settings' && (
          <div className="flex flex-col md:flex-row gap-6 items-start w-full">
            {/* SIDEBAR MENU */}
            <aside className="w-full md:w-64 flex flex-col gap-1.5 bg-zinc-950/40 p-3 rounded-2xl border border-zinc-900/60 md:sticky md:top-24">
              <Button
                onClick={() => setSettingsSubTab('cards')}
                variant="ghost"
                className={`w-full justify-start rounded-xl text-xs font-semibold px-4 py-3 transition-all gap-2 ${
                  settingsSubTab === 'cards'
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/15'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40 border border-transparent'
                }`}
              >
                <Layers className="h-4 w-4" />
                Gerenciamento de Cards
              </Button>
              <Button
                onClick={() => setSettingsSubTab('form')}
                variant="ghost"
                className={`w-full justify-start rounded-xl text-xs font-semibold px-4 py-3 transition-all gap-2 ${
                  settingsSubTab === 'form'
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/15'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40 border border-transparent'
                }`}
              >
                <FormInput className="h-4 w-4" />
                Construtor de Formulários
              </Button>
              <Button
                onClick={() => setSettingsSubTab('rules')}
                variant="ghost"
                className={`w-full justify-start rounded-xl text-xs font-semibold px-4 py-3 transition-all gap-2 ${
                  settingsSubTab === 'rules'
                    ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/15'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900/40 border border-transparent'
                }`}
              >
                <Sliders className="h-4 w-4" />
                Regras de Criticidade
              </Button>
            </aside>

            {/* CONTENT AREA */}
            <div className="flex-1 w-full">
              {settingsSubTab === 'cards' && (
                <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
                    <div>
                      <CardTitle className="text-xl font-bold">Gerenciamento de Serviços (Cards)</CardTitle>
                      <CardDescription className="text-zinc-500">
                        Insira novos cards de serviços, edite nomes, categorias ou altere o status de forma manual se necessário.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleOpenAddService}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-1.5 rounded-xl text-xs py-2 px-4 shadow-lg shadow-indigo-600/10 transition-all self-start sm:self-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Novo Serviço
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {services.length === 0 ? (
                      <div className="text-center py-10 text-zinc-500">
                        Nenhum serviço cadastrado. Adicione um acima.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-zinc-900">
                        <Table className="bg-zinc-950/80">
                          <TableHeader className="bg-zinc-900/50 border-zinc-850">
                            <TableRow className="hover:bg-zinc-900/20">
                              <TableHead className="text-zinc-400 font-semibold">Nome</TableHead>
                              <TableHead className="text-zinc-400 font-semibold">Categoria</TableHead>
                              <TableHead className="text-zinc-400 font-semibold">Ícone</TableHead>
                              <TableHead className="text-zinc-400 font-semibold text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {services.map((service) => {
                              return (
                                <TableRow key={service.id} className="hover:bg-zinc-900/30 border-zinc-900">
                                  <TableCell className="font-bold text-white text-sm">{service.name}</TableCell>
                                  <TableCell className="text-zinc-300 text-xs">{service.category}</TableCell>
                                  <TableCell className="text-zinc-400 text-xs font-mono">{service.icon_name || 'Globe'}</TableCell>
                                  <TableCell className="text-right flex justify-end gap-1.5">
                                    <Button
                                      onClick={() => handleOpenEditService(service)}
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg"
                                      title="Editar Serviço"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      onClick={() => handleDeleteService(service.id)}
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                                      title="Excluir Serviço"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {settingsSubTab === 'form' && (
                <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold">Construtor de Formulário</CardTitle>
                    <CardDescription className="text-zinc-500">
                      Crie e edite os campos que serão exibidos no momento que o usuário for reportar uma instabilidade.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveSettings} className="space-y-6">
                      
                      <FormBuilder schema={formSchema} onChange={setFormSchema} />

                      <div className="flex justify-end pt-4 border-t border-zinc-900">
                        <Button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                          disabled={isSavingSettings}
                        >
                          {isSavingSettings ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Salvando...
                            </span>
                          ) : (
                            'Salvar Formulário'
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              {settingsSubTab === 'rules' && (
                <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-xl font-bold">Regras de Criticidade (Algoritmo Automático)</CardTitle>
                      <CardDescription className="text-zinc-500">
                        Defina quantos relatos em um curto período são necessários para disparar alertas visuais no site público.
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveThresholds} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Window Minutes */}
                        <div className="space-y-2">
                          <Label htmlFor="windowMinutes" className="text-zinc-300 font-semibold text-sm">Janela de Tempo (Minutos)</Label>
                          <Input
                            id="windowMinutes"
                            type="number"
                            min={1}
                            value={thresholdWindow}
                            onChange={(e) => setThresholdWindow(Number(e.target.value))}
                            className="bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500"
                            required
                          />
                          <p className="text-xs text-zinc-500">Janela de criticidade de {thresholdWindow} min.</p>
                        </div>

                        {/* Warning Limit */}
                        <div className="space-y-2">
                          <Label htmlFor="warningLimit" className="text-amber-400 font-semibold text-sm">Alerta: Instabilidade (🟡)</Label>
                          <Input
                            id="warningLimit"
                            type="number"
                            min={1}
                            value={thresholdWarning}
                            onChange={(e) => setThresholdWarning(Number(e.target.value))}
                            className="bg-zinc-900 border-zinc-800 text-amber-400 focus:border-amber-500"
                            required
                          />
                          <p className="text-xs text-zinc-500">Mínimo para card amarelo.</p>
                        </div>

                        {/* Critical Limit */}
                        <div className="space-y-2">
                          <Label htmlFor="criticalLimit" className="text-red-400 font-semibold text-sm">Crítico: Queda Total (🔴)</Label>
                          <Input
                            id="criticalLimit"
                            type="number"
                            min={2}
                            value={thresholdCritical}
                            onChange={(e) => setThresholdCritical(Number(e.target.value))}
                            className="bg-zinc-900 border-zinc-800 text-red-400 focus:border-red-500"
                            required
                          />
                          <p className="text-xs text-zinc-500">Mínimo para card vermelho.</p>
                        </div>

                        {/* Public Chart Window Limit */}
                        <div className="space-y-2">
                          <Label htmlFor="chartWindowHours" className="text-indigo-400 font-semibold text-sm">Janela do Gráfico Público</Label>
                          <Select value={String(chartWindowHours)} onValueChange={(val) => setChartWindowHours(Number(val || '24'))}>
                            <SelectTrigger id="chartWindowHours" className="bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                              <SelectItem value="4">Últimas 4 Horas</SelectItem>
                              <SelectItem value="12">Últimas 12 Horas</SelectItem>
                              <SelectItem value="24">Últimas 24 Horas</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-zinc-500">Exibição na Home pública.</p>
                        </div>
                      </div>

                      <div className="border-t border-zinc-900 pt-6 space-y-4">
                        <h4 className="text-sm font-semibold text-zinc-350 flex items-center gap-1.5">
                          <Sliders className="h-4 w-4 text-indigo-400" />
                          Nomes dos Status nos Cards Públicos
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Status Normal Label */}
                          <div className="space-y-2">
                            <Label htmlFor="labelNormal" className="text-emerald-400 font-semibold text-sm">Status: Normal (🟢)</Label>
                            <Input
                              id="labelNormal"
                              type="text"
                              value={labelNormal}
                              onChange={(e) => setLabelNormal(e.target.value)}
                              className="bg-zinc-900 border-zinc-800 text-emerald-400 focus:border-emerald-500"
                              placeholder="Ex: Operando"
                              required
                            />
                            <p className="text-xs text-zinc-500">Texto para funcionamento normal.</p>
                          </div>

                          {/* Status Warning Label */}
                          <div className="space-y-2">
                            <Label htmlFor="labelWarning" className="text-amber-400 font-semibold text-sm">Status: Instabilidade (🟡)</Label>
                            <Input
                              id="labelWarning"
                              type="text"
                              value={labelWarning}
                              onChange={(e) => setLabelWarning(e.target.value)}
                              className="bg-zinc-900 border-zinc-800 text-amber-400 focus:border-amber-500"
                              placeholder="Ex: Instabilidade"
                              required
                            />
                            <p className="text-xs text-zinc-500">Texto para instabilidade.</p>
                          </div>

                          {/* Status Critical Label */}
                          <div className="space-y-2">
                            <Label htmlFor="labelCritical" className="text-red-400 font-semibold text-sm">Status: Queda Total (🔴)</Label>
                            <Input
                              id="labelCritical"
                              type="text"
                              value={labelCritical}
                              onChange={(e) => setLabelCritical(e.target.value)}
                              className="bg-zinc-900 border-zinc-800 text-red-400 focus:border-red-500"
                              placeholder="Ex: Queda total"
                              required
                            />
                            <p className="text-xs text-zinc-500">Texto para falha total.</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end pt-4 border-t border-zinc-900">
                        <Button
                          type="submit"
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                          disabled={isSavingThresholds}
                        >
                          {isSavingThresholds ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Salvando...
                            </span>
                          ) : (
                            'Salvar Regras'
                          )}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-zinc-900 bg-zinc-950 py-6 px-6 text-center text-xs text-zinc-500 flex flex-col md:flex-row items-center justify-between gap-4 max-w-7xl mx-auto w-full">
        <div>
          &copy; {new Date().getFullYear()} Intradetector. Todos os direitos reservados.
        </div>
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            Painel de Controle Administrador
          </span>
        </div>
      </footer>

      {/* SERVICE ADD/EDIT MODAL */}
      <Dialog open={isServiceModalOpen} onOpenChange={(open) => !open && setIsServiceModalOpen(false)}>
        <DialogContent className="max-w-md w-full bg-zinc-950 border border-zinc-800 text-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-400" />
              <span>{editingService ? 'Editar Serviço Card' : 'Cadastrar Novo Serviço'}</span>
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Configure as propriedades visuais do card público para exibição na grid inicial do Intradetector.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveService} className="space-y-4 mt-4">
            {/* Field: Name */}
            <div className="space-y-1.5">
              <Label htmlFor="serviceName" className="text-zinc-300 text-xs font-semibold">Nome do Serviço *</Label>
              <Input
                id="serviceName"
                value={serviceFormName}
                onChange={(e) => setServiceFormName(e.target.value)}
                placeholder="Ex: Netflix, Discord, Claro Fibra"
                className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500"
                required
              />
            </div>

            {/* Field: Category */}
            <div className="space-y-1.5">
              <Label htmlFor="serviceCategory" className="text-zinc-300 text-xs font-semibold">Categoria *</Label>
              <Select value={serviceFormCategory} onValueChange={(val) => setServiceFormCategory(val || 'Redes Sociais')}>
                <SelectTrigger id="serviceCategory" className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  {AVAILABLE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat} className="hover:bg-zinc-800">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Field: Icon Select */}
            <div className="space-y-1.5">
              <Label htmlFor="serviceIcon" className="text-zinc-300 text-xs font-semibold">Escolher Ícone *</Label>
              <Select value={serviceFormIcon} onValueChange={(val) => setServiceFormIcon(val || 'Globe')}>
                <SelectTrigger id="serviceIcon" className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectValue placeholder="Selecione um ícone padrão" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  {COMMON_ICONS.map((icon) => (
                    <SelectItem key={icon.value} value={icon.value} className="hover:bg-zinc-800">
                      {icon.label} ({icon.value})
                    </SelectItem>
                  ))}
                  <SelectItem value="custom" className="hover:bg-zinc-800 font-semibold text-indigo-400">
                    Digite um ícone personalizado...
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Icon Field (conditional) */}
            {serviceFormIcon === 'custom' && (
              <div className="space-y-1.5">
                <Label htmlFor="customIcon" className="text-zinc-300 text-xs font-semibold">Nome do Ícone do Lucide (Ex: Starlink, Tablet)</Label>
                <Input
                  id="customIcon"
                  value={serviceFormCustomIcon}
                  onChange={(e) => setServiceFormCustomIcon(e.target.value)}
                  placeholder="Ex: ShieldAlert, Signal, etc."
                  className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-550"
                  required
                />
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsServiceModalOpen(false)}
                className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 transition-all"
                disabled={isSavingService}
              >
                {isSavingService ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  'Salvar Serviço'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
