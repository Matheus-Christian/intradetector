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
  FormInput,
  Activity,
  Eye,
  PanelLeftClose,
  PanelLeft,
  Menu
} from 'lucide-react';
import * as Icons from 'lucide-react';
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

// Helper to render category icon
function renderCategoryIcon(iconName: string) {
  const IconComponent = (Icons as any)[iconName];
  if (IconComponent) {
    return <IconComponent className="h-4 w-4 text-indigo-400" />;
  }
  return <Icons.Globe className="h-4 w-4 text-indigo-400" />;
}

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

  // Sidebar fold/unfold state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  // Hydration Guard
  const [isMounted, setIsMounted] = useState(false);

  // --- FILTERS STATE (ANALYTICS) ---
  const [filterService, setFilterService] = useState('all');
  const [dynamicFilters, setDynamicFilters] = useState<Record<string, string>>({});
  const [filterTimeRange, setFilterTimeRange] = useState('24h');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16);
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16);
  });
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
  const [searchServicesQuery, setSearchServicesQuery] = useState('');

  const filteredServices = useMemo(() => {
    if (!searchServicesQuery.trim()) return services;
    const q = searchServicesQuery.toLowerCase();
    return services.filter(s => 
      s.name.toLowerCase().includes(q) || 
      (s.category && s.category.toLowerCase().includes(q))
    );
  }, [services, searchServicesQuery]);

  // --- FORM OPTIONS CONFIG STATE ---
  const [formSchema, setFormSchema] = useState<FormSchema>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [showRelatedServices, setShowRelatedServices] = useState<boolean>(true);

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
  const [settingsSubTab, setSettingsSubTab] = useState<'cards' | 'form' | 'rules' | 'alerts' | 'logs' | 'users'>('cards');
  const [actionLogs, setActionLogs] = useState<any[]>([]);

  // --- USER MANAGEMENT & RBAC STATE ---
  const [currentUserProfile, setCurrentUserProfile] = useState<any | null>(null);
  const [adminUsersList, setAdminUsersList] = useState<any[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userFormEmail, setUserFormEmail] = useState('');
  const [userFormName, setUserFormName] = useState('');
  const [userFormPassword, setUserFormPassword] = useState('');
  const [userFormRole, setUserFormRole] = useState<'superadmin' | 'admin'>('admin');
  const [userFormPermissions, setUserFormPermissions] = useState<Record<string, boolean | 'read' | 'write' | 'none'>>({
    cards: false,
    form: false,
    rules: false,
    alerts: false,
    logs: false
  });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [searchUsersQuery, setSearchUsersQuery] = useState('');

  const filteredUsers = useMemo(() => {
    if (!searchUsersQuery.trim()) return adminUsersList;
    const q = searchUsersQuery.toLowerCase();
    return adminUsersList.filter(u => 
      (u.email && u.email.toLowerCase().includes(q)) || 
      (u.name && u.name.toLowerCase().includes(q))
    );
  }, [adminUsersList, searchUsersQuery]);

  const userGreeting = useMemo(() => {
    if (!currentUserProfile) return '';
    const rawName = currentUserProfile.name || currentUserProfile.email || '';
    if (!rawName) return 'Usuário';
    const namePart = rawName.includes('@') ? rawName.split('@')[0] : rawName;
    const firstName = namePart.split(' ')[0];
    return firstName.charAt(0).toUpperCase() + firstName.slice(1);
  }, [currentUserProfile]);

  const hasWriteAccess = (tab: 'cards' | 'form' | 'rules' | 'alerts' | 'logs') => {
    if (!currentUserProfile) return false;
    if (currentUserProfile.role === 'superadmin') return true;
    const perm = currentUserProfile.permissions?.[tab];
    return perm === 'write';
  };

  const hasReadAccess = (tab: 'cards' | 'form' | 'rules' | 'alerts' | 'logs') => {
    if (!currentUserProfile) return false;
    if (currentUserProfile.role === 'superadmin') return true;
    const perm = currentUserProfile.permissions?.[tab];
    return perm === 'read' || perm === 'write' || perm === true;
  };

  // --- ALERT MANAGEMENT STATE ---
  const [networkAlerts, setNetworkAlerts] = useState<any[]>([]);
  const [displayInterval, setDisplayInterval] = useState<number>(10); // default 10 mins
  const [autoCloseInterval, setAutoCloseInterval] = useState<number>(60); // default 60 seconds
  const [isSavingAlertsConfig, setIsSavingAlertsConfig] = useState(false);
  const [autoAlertEnabled, setAutoAlertEnabled] = useState<boolean>(false);
  const [autoAlertPercentage, setAutoAlertPercentage] = useState<number>(50);
  const [autoAlertMinReports, setAutoAlertMinReports] = useState<number>(5);
  const [autoAlertTitle, setAutoAlertTitle] = useState<string>('Detecção Automática de Instabilidade');
  const [autoAlertDescription, setAutoAlertDescription] = useState<string>('Alto volume de relatos detectado na rede pública.');
  const [lastManualAlertInactiveAt, setLastManualAlertInactiveAt] = useState<string | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any | null>(null); // null means new alert

  const hasActiveManualAlert = useMemo(() => {
    return networkAlerts.some((a: any) => {
      const isExpired = a.expires_at && new Date(a.expires_at).getTime() < Date.now();
      return a.is_active && !isExpired;
    });
  }, [networkAlerts]);
  
  // Alert form fields
  const [alertFormTitle, setAlertFormTitle] = useState('');
  const [alertFormType, setAlertFormType] = useState('Instabilidade Geral');
  const [alertFormDescription, setAlertFormDescription] = useState('');
  const [alertFormExpirationType, setAlertFormExpirationType] = useState<'manual' | 'scheduled'>('manual');
  const [alertFormExpiresAt, setAlertFormExpiresAt] = useState('');
  const [isSavingAlert, setIsSavingAlert] = useState(false);
  
  // --- ANALYTICS VIEW SUBTAB & REPORT GENERATION STATES ---
  const [analyticsSubTab, setAnalyticsSubTab] = useState<'alerts' | 'custom'>('alerts');
  const [selectedAlertIds, setSelectedAlertIds] = useState<string[]>([]);
  const [isAlertsReportGenerated, setIsAlertsReportGenerated] = useState<boolean>(false);
  const [reportFilterService, setReportFilterService] = useState<string>('all');
  const [reportFilterIssue, setReportFilterIssue] = useState<string>('all');
  const [reportFilterRegion, setReportFilterRegion] = useState<string>('all');
  const [reportFilterConnection, setReportFilterConnection] = useState<string>('all');

  // --- SERVICE CATEGORIES STATE ---
  const [categoriesList, setCategoriesList] = useState<any[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormIcon, setCategoryFormIcon] = useState('Globe');
  const [categoryFormCustomIcon, setCategoryFormCustomIcon] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

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

      // Fetch form config for showRelatedServices toggle
      const { data: formConfigSettingData } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'form_config')
        .single();

      if (formConfigSettingData) {
        setShowRelatedServices(formConfigSettingData.value?.showRelatedServices ?? true);
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
      }

      // Fetch network alerts
      const { data: alertsSettingData } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'network_alerts')
        .single();

      if (alertsSettingData) {
        setNetworkAlerts(alertsSettingData.value || []);
      }

      // Fetch network alert display config
      const { data: alertConfigSettingData } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'network_alert_config')
        .single();

      if (alertConfigSettingData) {
        setDisplayInterval(alertConfigSettingData.value?.displayInterval ?? 10);
        setAutoCloseInterval(alertConfigSettingData.value?.autoCloseInterval ?? 60);
        setAutoAlertEnabled(alertConfigSettingData.value?.autoEnabled ?? false);
        setAutoAlertPercentage(alertConfigSettingData.value?.autoPercentage ?? 50);
        setAutoAlertMinReports(alertConfigSettingData.value?.autoMinReports ?? 5);
        setAutoAlertTitle(alertConfigSettingData.value?.autoTitle ?? 'Detecção Automática de Instabilidade');
        setAutoAlertDescription(alertConfigSettingData.value?.autoDescription ?? 'Alto volume de relatos detectado na rede pública.');
        setLastManualAlertInactiveAt(alertConfigSettingData.value?.lastManualAlertInactiveAt ?? null);
      }

      // Fetch dynamic service categories
      const { data: categoriesSettingData } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'service_categories')
        .single();

      let loadedCategories = [];
      if (categoriesSettingData) {
        loadedCategories = categoriesSettingData.value || [];
      } else {
        // Seed default categories if not initialized yet
        loadedCategories = [
          { id: 'redes-sociais', name: 'Redes Sociais', icon_name: 'MessageSquare' },
          { id: 'streaming', name: 'Streaming', icon_name: 'Tv' },
          { id: 'jogos', name: 'Jogos', icon_name: 'Gamepad2' },
          { id: 'iptv-provedores', name: 'IPTV & Provedores', icon_name: 'Globe' }
        ];
        await supabase.from('settings').upsert({
          key: 'service_categories',
          value: loadedCategories,
          updated_at: new Date().toISOString()
        });
      }
      setCategoriesList(loadedCategories);

      // 5. Fetch Action Logs
      const { data: logsData, error: logsError } = await supabase
        .from('action_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError && logsError.code !== 'PGRST116') {
        console.warn('Tabela action_logs não encontrada ou não migrada ainda.');
      } else if (logsData) {
        setActionLogs(logsData);
      }

      // 6. Fetch Admin Profiles
      const { data: adminUsersSetting } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'admin_users')
        .single();

      let usersList: any[] = [];
      if (adminUsersSetting) {
        usersList = adminUsersSetting.value || [];
      }
      setAdminUsersList(usersList);

      const { data: { session } } = await supabase.auth.getSession();
      const currentUserEmail = session?.user?.email;

      if (currentUserEmail) {
        let profile = usersList.find((u: any) => u.email.toLowerCase() === currentUserEmail.toLowerCase());
        
        if (!profile) {
          profile = {
            email: currentUserEmail,
            role: 'superadmin',
            permissions: { cards: true, form: true, rules: true, alerts: true, logs: true }
          };
          usersList = [...usersList, profile];
          
          await supabase.from('settings').upsert({
            key: 'admin_users',
            value: usersList,
            updated_at: new Date().toISOString()
          });
          setAdminUsersList(usersList);
        }
        setCurrentUserProfile(profile);

        // If the profile is admin, automatically set settingsSubTab to the first allowed tab only if the current tab is not allowed
        if (profile.role === 'admin') {
          const allowedTabs = Object.entries(profile.permissions || {})
            .filter(([_, allowed]) => allowed && allowed !== 'none')
            .map(([tab]) => tab);
          
          const isCurrentTabAllowed = allowedTabs.includes(settingsSubTab);
          if (!isCurrentTabAllowed && allowedTabs.length > 0) {
            const tabMap: Record<string, 'cards' | 'form' | 'rules' | 'alerts' | 'logs' | 'users'> = {
              cards: 'cards',
              form: 'form',
              rules: 'rules',
              alerts: 'alerts',
              logs: 'logs'
            };
            const firstAllowedTab = tabMap[allowedTabs[0]];
            if (firstAllowedTab) {
              setSettingsSubTab(firstAllowedTab);
            }
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao carregar dados: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const logAction = async (action: string, details: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || 'Sistema';
      
      await supabase
        .from('action_logs')
        .insert({
          user_email: email,
          action,
          details
        });
    } catch (err) {
      console.error('Falha de log:', err);
    }
  };

  const handleLogout = async () => {
    await logAction('Logout no Painel', 'Usuário realizou logout com sucesso do painel administrativo.');
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

      await logAction('Excluir relato', `ID do relato deletado: ${id}`);
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
    const firstCategory = categoriesList.length > 0 ? categoriesList[0].name : 'Redes Sociais';
    setServiceFormCategory(firstCategory);
    setServiceFormStatus('normal');
    setIsServiceModalOpen(true);
  };

  const handleOpenEditService = (service: Service) => {
    setEditingService(service);
    setServiceFormName(service.name);
    setServiceFormCategory(service.category);
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

      await logAction('Excluir card de serviço', `ID do serviço: ${id}`);
      toast.success('Serviço excluído com sucesso!');
      loadData();
    } catch (err: any) {
      toast.error(`Erro ao excluir serviço: ${err.message}`);
    }
  };

  // --- CATEGORIES CRUD HANDLERS ---
  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormName('');
    setCategoryFormIcon('Globe');
    setCategoryFormCustomIcon('');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCategoryFormName(cat.name);
    
    const isStandard = COMMON_ICONS.some(i => i.value === cat.icon_name);
    if (isStandard) {
      setCategoryFormIcon(cat.icon_name || 'Globe');
      setCategoryFormCustomIcon('');
    } else {
      setCategoryFormIcon('custom');
      setCategoryFormCustomIcon(cat.icon_name || '');
    }
    
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (catToDelete: any) => {
    const hasServices = services.some(s => s.category.toLowerCase() === catToDelete.name.toLowerCase());
    if (hasServices) {
      toast.error(`Não é possível excluir a categoria "${catToDelete.name}" porque existem serviços cadastrados nela. Altere a categoria desses serviços antes.`);
      return;
    }

    if (!confirm(`Deseja realmente excluir a categoria "${catToDelete.name}"?`)) {
      return;
    }

    const updatedCategories = categoriesList.filter(c => c.id !== catToDelete.id);

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'service_categories',
          value: updatedCategories,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      await logAction('Excluir categoria', `Categoria: ${catToDelete.name}`);
      toast.success('Categoria excluída com sucesso!');
      setCategoriesList(updatedCategories);
    } catch (err: any) {
      toast.error(`Erro ao excluir categoria: ${err.message}`);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryFormName.trim()) {
      toast.error('Preencha o nome da categoria.');
      return;
    }

    setIsSavingCategory(true);
    const finalIcon = categoryFormIcon === 'custom' ? categoryFormCustomIcon.trim() : categoryFormIcon;

    const newCategory = {
      id: editingCategory ? editingCategory.id : crypto.randomUUID(),
      name: categoryFormName.trim(),
      icon_name: finalIcon || 'Globe'
    };

    let updatedCategories = [];
    if (editingCategory) {
      updatedCategories = categoriesList.map(c => c.id === editingCategory.id ? newCategory : c);
    } else {
      const isDuplicate = categoriesList.some(c => c.name.toLowerCase() === newCategory.name.toLowerCase());
      if (isDuplicate) {
        toast.error('Já existe uma categoria com este nome.');
        setIsSavingCategory(false);
        return;
      }
      updatedCategories = [...categoriesList, newCategory];
    }

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'service_categories',
          value: updatedCategories,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      if (editingCategory) {
        const oldName = editingCategory.name;
        const newName = newCategory.name;
        const oldIcon = editingCategory.icon_name;
        const newIcon = newCategory.icon_name;

        if (oldName !== newName || oldIcon !== newIcon) {
          const { error: serviceUpdateError } = await supabase
            .from('services')
            .update({ category: newName, icon_name: newIcon })
            .eq('category', oldName);
          
          if (serviceUpdateError) throw serviceUpdateError;
        }
      }

      await logAction(
        editingCategory ? 'Editar categoria' : 'Criar categoria',
        `Categoria: ${newCategory.name}, Ícone: ${newCategory.icon_name}`
      );
      toast.success(editingCategory ? 'Categoria atualizada com sucesso!' : 'Nova categoria criada!');
      setCategoriesList(updatedCategories);
      setIsCategoryModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(`Erro ao salvar categoria: ${err.message}`);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serviceFormName.trim() || !serviceFormCategory) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    setIsSavingService(true);
    
    // Resolve service icon resolved dynamically from its category
    const matchedCategory = categoriesList.find(c => c.name === serviceFormCategory);
    const finalIcon = matchedCategory ? matchedCategory.icon_name : 'Globe';

    const serviceData = {
      name: serviceFormName.trim(),
      category: serviceFormCategory,
      icon_name: finalIcon,
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
        await logAction('Editar card de serviço', `Serviço: ${serviceData.name} (${serviceData.category})`);
        toast.success('Serviço atualizado com sucesso!');
      } else {
        // Add New
        const { error } = await supabase
          .from('services')
          .insert(serviceData);
        
        if (error) throw error;
        await logAction('Criar card de serviço', `Serviço: ${serviceData.name} (${serviceData.category})`);
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

      // Upsert form configuration setting (showRelatedServices)
      const { error: configError } = await supabase
        .from('settings')
        .upsert({
          key: 'form_config',
          value: { showRelatedServices },
          updated_at: new Date().toISOString()
        });

      if (configError) throw configError;

      await logAction('Atualizar Construtor de Formulário', `Campos: ${cleanedSchema.map(f => f.label).join(', ')}, Permitir Multisserviço: ${showRelatedServices}`);
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
      await logAction('Atualizar Regras de Criticidade', `Crítico: ${thresholdCritical}, Alerta: ${thresholdWarning}, Janela: ${thresholdWindow}m, Janela Gráfico: ${chartWindowHours}h`);
      toast.success('Regras de cálculo atualizadas! O site público usará as novas regras instantaneamente.');
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSavingThresholds(false);
    }
  };

  // --- ALERT MANAGEMENT HANDLERS ---
  const handleSaveAlertConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAlertsConfig(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'network_alert_config',
          value: { 
            displayInterval, 
            autoCloseInterval,
            autoEnabled: autoAlertEnabled,
            autoPercentage: autoAlertPercentage,
            autoMinReports: autoAlertMinReports,
            autoTitle: autoAlertTitle,
            autoDescription: autoAlertDescription,
            lastManualAlertInactiveAt
          },
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      await logAction('Configurar Alertas', `Intervalo: ${displayInterval}m, Auto-fechar: ${autoCloseInterval}s, Auto-Habilitado: ${autoAlertEnabled}`);
      toast.success('Configurações de alerta salvas!');
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setIsSavingAlertsConfig(false);
    }
  };

  const handleSaveAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertFormTitle.trim() || !alertFormDescription.trim()) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    setIsSavingAlert(true);
    const newAlert = {
      id: editingAlert ? editingAlert.id : crypto.randomUUID(),
      title: alertFormTitle.trim(),
      alert_type: alertFormType,
      description: alertFormDescription.trim(),
      is_active: editingAlert ? editingAlert.is_active : true,
      expires_at: alertFormExpirationType === 'scheduled' ? new Date(alertFormExpiresAt).toISOString() : null,
      created_at: editingAlert ? editingAlert.created_at : new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let updatedAlerts = [];
    if (editingAlert) {
      updatedAlerts = networkAlerts.map(a => a.id === editingAlert.id ? newAlert : a);
    } else {
      updatedAlerts = [newAlert, ...networkAlerts];
    }

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'network_alerts',
          value: updatedAlerts,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      await logAction(
        editingAlert ? 'Editar Alerta de Rede' : 'Criar Alerta de Rede',
        `Título: ${newAlert.title}, Tipo: ${newAlert.alert_type}`
      );
      toast.success(editingAlert ? 'Alerta atualizado com sucesso!' : 'Novo alerta de rede criado!');
      setNetworkAlerts(updatedAlerts);
      setIsAlertModalOpen(false);
    } catch (err: any) {
      toast.error(`Erro ao salvar alerta: ${err.message}`);
    } finally {
      setIsSavingAlert(false);
    }
  };

  const handleToggleAlertActive = async (id: string, currentStatus: boolean) => {
    const updatedAlerts = networkAlerts.map(a => {
      if (a.id === id) {
        return { ...a, is_active: !currentStatus, updated_at: new Date().toISOString() };
      }
      return a;
    });

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'network_alerts',
          value: updatedAlerts,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      if (currentStatus) {
        const inactiveTime = new Date().toISOString();
        setLastManualAlertInactiveAt(inactiveTime);
        await supabase
          .from('settings')
          .upsert({
            key: 'network_alert_config',
            value: { 
              displayInterval, 
              autoCloseInterval,
              autoEnabled: autoAlertEnabled,
              autoPercentage: autoAlertPercentage,
              autoMinReports: autoAlertMinReports,
              autoTitle: autoAlertTitle,
              autoDescription: autoAlertDescription,
              lastManualAlertInactiveAt: inactiveTime
            },
            updated_at: new Date().toISOString()
          });
      }

      toast.success(currentStatus ? 'Alerta desativado!' : 'Alerta ativado!');
      setNetworkAlerts(updatedAlerts);
    } catch (err: any) {
      toast.error(`Erro ao alterar status: ${err.message}`);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    const alertToDelete = networkAlerts.find(a => a.id === id);
    if (!alertToDelete) return;

    if (!confirm('Deseja realmente deletar este alerta do histórico?')) return;

    const updatedAlerts = networkAlerts.filter(a => a.id !== id);

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'network_alerts',
          value: updatedAlerts,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      const isExpired = alertToDelete.expires_at && new Date(alertToDelete.expires_at).getTime() < Date.now();
      const wasActive = alertToDelete.is_active && !isExpired;

      if (wasActive) {
        const inactiveTime = new Date().toISOString();
        setLastManualAlertInactiveAt(inactiveTime);
        await supabase
          .from('settings')
          .upsert({
            key: 'network_alert_config',
            value: { 
              displayInterval, 
              autoCloseInterval,
              autoEnabled: autoAlertEnabled,
              autoPercentage: autoAlertPercentage,
              autoMinReports: autoAlertMinReports,
              autoTitle: autoAlertTitle,
              autoDescription: autoAlertDescription,
              lastManualAlertInactiveAt: inactiveTime
            },
            updated_at: new Date().toISOString()
          });
      }

      toast.success('Alerta deletado com sucesso!');
    } catch (err: any) {
      toast.error(`Erro ao deletar alerta: ${err.message}`);
    }
  };

  // --- USER CRUD HANDLERS ---
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormEmail('');
    setUserFormName('');
    setUserFormPassword('');
    setUserFormRole('admin');
    setUserFormPermissions({ cards: false, form: false, rules: false, alerts: false, logs: false });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: any) => {
    setEditingUser(user);
    setUserFormEmail(user.email);
    setUserFormName(user.name || '');
    setUserFormPassword('');
    setUserFormRole(user.role);
    setUserFormPermissions(user.permissions || { cards: false, form: false, rules: false, alerts: false, logs: false });
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userFormEmail.trim()) {
      toast.error('O e-mail é obrigatório.');
      return;
    }
    if (!userFormName.trim()) {
      toast.error('O nome é obrigatório.');
      return;
    }
    if (!editingUser && !userFormPassword.trim()) {
      toast.error('A senha é obrigatória para novos usuários.');
      return;
    }

    setIsSavingUser(true);
    try {
      let updatedList = [...adminUsersList];

      if (editingUser) {
        // EDITING USER
        updatedList = adminUsersList.map(u => {
          if (u.email.toLowerCase() === editingUser.email.toLowerCase()) {
            return {
              ...u,
              name: userFormName.trim(),
              role: userFormRole,
              permissions: userFormRole === 'superadmin' 
                ? { cards: true, form: true, rules: true, alerts: true, logs: true }
                : userFormPermissions
            };
          }
          return u;
        });
        
        const { error } = await supabase.from('settings').upsert({
          key: 'admin_users',
          value: updatedList,
          updated_at: new Date().toISOString()
        });
        if (error) throw error;
        
        await logAction('Editar Usuário', `Editou permissões e nome do usuário ${userFormEmail}.`);
        toast.success('Usuário atualizado com sucesso!');
      } else {
        // CREATING NEW USER
        const { createBrowserClient } = await import('@supabase/ssr');
        const tempSupabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false } }
        );

        const { error: signUpError } = await tempSupabase.auth.signUp({
          email: userFormEmail.trim(),
          password: userFormPassword.trim()
        });

        if (signUpError) throw new Error(`Erro no Supabase Auth: ${signUpError.message}`);

        const newUser = {
          email: userFormEmail.trim().toLowerCase(),
          name: userFormName.trim(),
          role: userFormRole,
          permissions: userFormRole === 'superadmin'
            ? { cards: true, form: true, rules: true, alerts: true, logs: true }
            : userFormPermissions
        };
        
        updatedList = [...updatedList, newUser];

        const { error: dbError } = await supabase.from('settings').upsert({
          key: 'admin_users',
          value: updatedList,
          updated_at: new Date().toISOString()
        });
        if (dbError) throw dbError;

        await logAction('Criar Usuário', `Criou novo usuário administrativo: ${userFormEmail}.`);
        toast.success('Novo usuário administrativo criado com sucesso!');
      }

      setAdminUsersList(updatedList);
      setIsUserModalOpen(false);
    } catch (err: any) {
      toast.error(`Falha ao salvar usuário: ${err.message}`);
      console.error(err);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleDeleteUser = async (email: string) => {
    if (email.toLowerCase() === currentUserProfile?.email.toLowerCase()) {
      toast.error('Você não pode excluir o seu próprio perfil!');
      return;
    }

    if (!confirm(`Deseja realmente remover o usuário administrador ${email}? Ele perderá o acesso ao painel imediatamente.`)) {
      return;
    }

    try {
      const updatedList = adminUsersList.filter(u => u.email.toLowerCase() !== email.toLowerCase());

      const { error } = await supabase.from('settings').upsert({
        key: 'admin_users',
        value: updatedList,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;

      await logAction('Remover Usuário', `Removeu o acesso do usuário: ${email}.`);
      toast.success('Usuário removido com sucesso!');
      setAdminUsersList(updatedList);
    } catch (err: any) {
      toast.error(`Falha ao remover usuário: ${err.message}`);
      console.error(err);
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
      } else if (filterTimeRange === 'custom') {
        const startMs = customStartDate ? new Date(customStartDate).getTime() : 0;
        const endMs = customEndDate ? new Date(customEndDate).getTime() : Infinity;
        return reportTime >= startMs && reportTime <= endMs;
      }
      return true; // 'all'
    });
  }, [reports, filterService, dynamicFilters, filterTimeRange, customStartDate, customEndDate]);

  const reportsInTimeRange = useMemo(() => {
    return reports.filter((r) => {
      const reportTime = new Date(r.created_at).getTime();
      const now = Date.now();
      if (filterTimeRange === '24h') {
        return now - reportTime <= 24 * 60 * 60 * 1000;
      } else if (filterTimeRange === '7d') {
        return now - reportTime <= 7 * 24 * 60 * 60 * 1000;
      } else if (filterTimeRange === '30d') {
        return now - reportTime <= 30 * 24 * 60 * 60 * 1000;
      } else if (filterTimeRange === 'custom') {
        const startMs = customStartDate ? new Date(customStartDate).getTime() : 0;
        const endMs = customEndDate ? new Date(customEndDate).getTime() : Infinity;
        return reportTime >= startMs && reportTime <= endMs;
      }
      return true; // 'all'
    });
  }, [reports, filterTimeRange, customStartDate, customEndDate]);

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
    } else if (filterTimeRange === 'custom') {
      const startMs = customStartDate ? new Date(customStartDate).getTime() : 0;
      const endMs = customEndDate ? new Date(customEndDate).getTime() : Date.now();
      
      const diffMs = endMs - startMs;
      const diffHours = diffMs / (60 * 60 * 1000);

      if (diffHours <= 48) {
        // Group by hour
        const hourlyData: Record<string, number> = {};
        const current = new Date(startMs);
        const end = new Date(endMs);
        
        let safetyCounter = 0;
        while (current <= end && safetyCounter < 100) {
          const hourStr = `${String(current.getHours()).padStart(2, '0')}:00`;
          hourlyData[hourStr] = 0;
          current.setHours(current.getHours() + 1);
          safetyCounter++;
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
        // Group by day
        const dailyData: Record<string, number> = {};
        const current = new Date(startMs);
        const end = new Date(endMs);

        let safetyCounter = 0;
        while (current <= end && safetyCounter < 100) {
          const dateStr = `${String(current.getDate()).padStart(2, '0')}/${String(current.getMonth() + 1).padStart(2, '0')}`;
          dailyData[dateStr] = 0;
          current.setDate(current.getDate() + 1);
          safetyCounter++;
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
  }, [filteredReports, filterTimeRange, customStartDate, customEndDate]);

  // --- ALERT ANALYTICS MEMOIZED SELECTORS ---
  // 1. Calculate reports count per alert during its active window
  const reportsCountPerAlert = useMemo(() => {
    const counts: Record<string, number> = {};
    networkAlerts.forEach(alert => {
      const start = new Date(alert.created_at).getTime();
      let end = Date.now();
      if (alert.expires_at) {
        end = new Date(alert.expires_at).getTime();
      } else if (!alert.is_active) {
        end = new Date(alert.updated_at || alert.created_at).getTime();
      }
      
      const count = reports.filter(r => {
        const rTime = new Date(r.created_at).getTime();
        return rTime >= start && rTime <= end;
      }).length;
      
      counts[alert.id] = count;
    });
    return counts;
  }, [networkAlerts, reports]);

  // 2. Memoize selected alerts objects
  const selectedAlerts = useMemo(() => {
    return networkAlerts.filter(a => selectedAlertIds.includes(a.id));
  }, [networkAlerts, selectedAlertIds]);

  // 3. Aggregate all reports from selected alerts
  const reportsInSelectedAlerts = useMemo(() => {
    if (selectedAlerts.length === 0) return [];
    
    return reports.filter(r => {
      const rTime = new Date(r.created_at).getTime();
      return selectedAlerts.some(alert => {
        const start = new Date(alert.created_at).getTime();
        let end = Date.now();
        if (alert.expires_at) {
          end = new Date(alert.expires_at).getTime();
        } else if (!alert.is_active) {
          end = new Date(alert.updated_at || alert.created_at).getTime();
        }
        return rTime >= start && rTime <= end;
      });
    });
  }, [reports, selectedAlerts]);

  // 3. Filter reports within selected alert report view
  const filteredReportsInReportView = useMemo(() => {
    return reportsInSelectedAlerts.filter(r => {
      if (reportFilterService !== 'all' && r.service_id !== reportFilterService) return false;
      
      if (reportFilterIssue !== 'all') {
        const issueVal = r.issue_type ?? r.custom_fields?.issue_type;
        if (issueVal !== reportFilterIssue) return false;
      }
      
      if (reportFilterRegion !== 'all') {
        const regionVal = r.region ?? r.custom_fields?.region;
        if (regionVal !== reportFilterRegion) return false;
      }

      if (reportFilterConnection !== 'all') {
        const connVal = r.connection_type ?? r.custom_fields?.connection_type;
        if (connVal !== reportFilterConnection) return false;
      }
      
      return true;
    });
  }, [reportsInSelectedAlerts, reportFilterService, reportFilterIssue, reportFilterRegion, reportFilterConnection]);

  // 4. Bar chart data for top services in selected alerts reports
  const selectedAlertsBarChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredReportsInReportView.forEach(r => {
      const svcName = r.services?.name || services.find(s => s.id === r.service_id)?.name || 'Serviço Excluído';
      counts[svcName] = (counts[svcName] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, relatos: count }))
      .sort((a, b) => b.relatos - a.relatos)
      .slice(0, 5);
  }, [services, filteredReportsInReportView]);

  // 5. Horizontal bar chart data for top issues in selected alerts reports
  const selectedAlertsIssuesChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredReportsInReportView.forEach(r => {
      const issue = r.issue_type ?? r.custom_fields?.issue_type ?? 'Outros';
      counts[issue] = (counts[issue] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, relatos: count }))
      .sort((a, b) => b.relatos - a.relatos)
      .slice(0, 5);
  }, [filteredReportsInReportView]);

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

          {currentUserProfile && (
            <span className="text-xs text-zinc-400 select-none mr-1 hidden md:inline">
              Bem-vindo(a), <span className="font-semibold text-zinc-250">{userGreeting}</span>
            </span>
          )}

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
      <div className="relative z-10 border-b border-zinc-900 bg-zinc-950/20 backdrop-blur-sm px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex gap-2">
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
                            <TableCell className="font-bold text-white text-sm">
                              <div className="flex flex-col items-start gap-1">
                                <span>{svcName}</span>
                                {report.custom_fields?.active_alert && (
                                  <div className="flex flex-wrap gap-1">
                                    {String(report.custom_fields.active_alert).split(' | ').map((tag, idx) => (
                                      <Badge key={idx} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] px-1.5 py-0 rounded-md w-fit font-medium whitespace-nowrap">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </TableCell>
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
          <div className="flex flex-col lg:flex-row gap-6 items-start relative z-10 animate-in fade-in duration-300 w-full">
            {/* SIDEBAR NAVIGATION MENU */}
            <aside className={`shrink-0 transition-all duration-300 sticky top-24 z-40 hidden lg:block ${isSidebarOpen ? 'w-64' : 'w-[76px]'}`}>
              <div 
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
                className={`flex flex-col gap-1.5 bg-zinc-950/70 p-3 rounded-2xl border border-zinc-900 transition-all duration-300 ease-in-out backdrop-blur-md
                  ${(isSidebarOpen || isSidebarHovered) ? 'w-64 shadow-2xl border-zinc-800' : 'w-[76px]'}
                `}
              >
                {/* Cabeçalho do Menu */}
                <div className={`flex items-center mb-3 transition-all duration-300 ${(isSidebarOpen || isSidebarHovered) ? 'justify-between px-2' : 'justify-center'}`}>
                  {(isSidebarOpen || isSidebarHovered) ? (
                    <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 animate-in fade-in duration-300 whitespace-nowrap overflow-hidden">
                      Menu de Análise
                    </span>
                  ) : null}
                  <Button
                    onClick={() => setIsSidebarOpen(prev => !prev)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900/50 shrink-0"
                    title={isSidebarOpen ? "Recolher menu" : "Fixar menu"}
                  >
                    <Menu className="h-4.5 w-4.5" />
                  </Button>
                </div>

                {/* Opções */}
                <Button
                  onClick={() => {
                    setAnalyticsSubTab('alerts');
                    setIsAlertsReportGenerated(false);
                  }}
                  variant="ghost"
                  className={`w-full rounded-xl text-xs font-semibold py-5 transition-all duration-200 flex items-center ${
                    (isSidebarOpen || isSidebarHovered) ? 'justify-start px-4 gap-3' : 'justify-center px-0 gap-0'
                  } ${
                    analyticsSubTab === 'alerts'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                  }`}
                  title="Análise por Alertas"
                >
                  <Activity className="h-4 w-4 shrink-0" />
                  <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${(isSidebarOpen || isSidebarHovered) ? 'w-auto opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                    Análise por Alertas
                  </span>
                </Button>

                <Button
                  onClick={() => setAnalyticsSubTab('custom')}
                  variant="ghost"
                  className={`w-full rounded-xl text-xs font-semibold py-5 transition-all duration-200 flex items-center ${
                    (isSidebarOpen || isSidebarHovered) ? 'justify-start px-4 gap-3' : 'justify-center px-0 gap-0'
                  } ${
                    analyticsSubTab === 'custom'
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                  }`}
                  title="Análise personalizada"
                >
                  <Sliders className="h-4 w-4 shrink-0" />
                  <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${(isSidebarOpen || isSidebarHovered) ? 'w-auto opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                    Análise personalizada
                  </span>
                </Button>
              </div>
            </aside>

            {/* Mobile Sidebar (stacks or collapses) */}
            <div className="w-full lg:hidden block mb-4">
              <div className="bg-zinc-950/70 p-3 rounded-2xl border border-zinc-900 flex flex-col gap-1.5 w-full">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                    Menu de Análise
                  </span>
                  <Button
                    onClick={() => setIsSidebarOpen(prev => !prev)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900/50 shrink-0"
                    title={isSidebarOpen ? "Recolher menu" : "Expandir menu"}
                  >
                    <Menu className="h-4.5 w-4.5" />
                  </Button>
                </div>
                {isSidebarOpen && (
                  <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-4 duration-200">
                    <Button
                      onClick={() => {
                        setAnalyticsSubTab('alerts');
                        setIsAlertsReportGenerated(false);
                      }}
                      variant="ghost"
                      className={`w-full justify-start rounded-xl text-xs font-semibold gap-3 py-5 px-4 transition-all duration-200 flex items-center ${
                        analyticsSubTab === 'alerts'
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                      }`}
                    >
                      <Activity className="h-4 w-4 shrink-0" />
                      Análise por Alertas
                    </Button>
                    <Button
                      onClick={() => setAnalyticsSubTab('custom')}
                      variant="ghost"
                      className={`w-full justify-start rounded-xl text-xs font-semibold gap-3 py-5 px-4 transition-all duration-200 flex items-center ${
                        analyticsSubTab === 'custom'
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                      }`}
                    >
                      <Sliders className="h-4 w-4 shrink-0" />
                      Análise personalizada
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 min-w-0 w-full space-y-6">
              {analyticsSubTab === 'custom' ? (
                <div className="space-y-6 animate-in fade-in-50 duration-300">
                  {/* INTERACTIVE FILTER BAR */}
                  <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                    <CardHeader className="py-4 border-b border-zinc-900 flex flex-row items-center gap-2">
                      <Filter className="h-4 w-4 text-indigo-400" />
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-300">Filtros Analíticos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
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
                              <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Conditional Custom Date/Time Selectors */}
                      {filterTimeRange === 'custom' && (
                        <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-zinc-900/60 animate-in fade-in-50 duration-200">
                          <div className="space-y-1.5 flex-1">
                            <Label className="text-xs text-zinc-400 font-semibold">Data e Hora Inicial (De)</Label>
                            <Input
                              type="datetime-local"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="bg-zinc-900 border-zinc-800 text-white text-xs h-9 focus:border-indigo-500"
                            />
                          </div>
                          <div className="space-y-1.5 flex-1">
                            <Label className="text-xs text-zinc-400 font-semibold">Data e Hora Final (Até)</Label>
                            <Input
                              type="datetime-local"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="bg-zinc-900 border-zinc-800 text-white text-xs h-9 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* GENERAL METRICS ROW */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in-50 duration-200">
                    {/* Metric 1 */}
                    <Card className="bg-zinc-950/60 border-zinc-900 p-5 flex flex-col justify-between">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total de Relatos</span>
                      <span className="text-3xl font-extrabold text-white mt-2">{reportsInTimeRange.length}</span>
                      <span className="text-[10px] text-zinc-400 mt-1">no período selecionado</span>
                    </Card>
                    {/* Metric 2 */}
                    <Card className="bg-zinc-950/60 border-zinc-900 p-5 flex flex-col justify-between">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Relatos Filtrados</span>
                      <span className="text-3xl font-extrabold text-indigo-400 mt-2">{filteredReports.length}</span>
                      <span className="text-[10px] text-zinc-400 mt-1">com filtros aplicados</span>
                    </Card>
                    {/* Metric 3 */}
                    <Card className="bg-zinc-950/60 border-zinc-900 p-5 flex flex-col justify-between">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Serviços Afetados</span>
                      <span className="text-3xl font-extrabold text-amber-500 mt-2">
                        {new Set(filteredReports.map(r => r.service_id)).size}
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-1">plataformas impactadas</span>
                    </Card>
                    {/* Metric 4 */}
                    <Card className="bg-zinc-950/60 border-zinc-900 p-5 flex flex-col justify-between">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Eficácia de Reboot</span>
                      <span className="text-3xl font-extrabold text-emerald-500 mt-2">
                        {filteredReports.length > 0 
                          ? `${Math.round((filteredReports.filter(r => r.is_resolved).length / filteredReports.length) * 100)}%`
                          : '0%'
                        }
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-1">resolvidos pós reboot</span>
                    </Card>
                  </div>

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
                          <div className="h-full flex flex-col items-center justify-center text-zinc-550 gap-2">
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
                          <div className="h-full flex items-center justify-center text-zinc-550 text-xs">
                            Sem dados de proporção.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* LIST OF FILTERED REPORTS */}
                  <Card className="bg-zinc-950/60 border-zinc-900 text-white mt-6">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg font-bold">Relatos Filtrados</CardTitle>
                        <CardDescription className="text-zinc-500">
                          Lista contendo os {filteredReports.length} relatos que correspondem aos filtros selecionados acima.
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {filteredReports.length === 0 ? (
                        <div className="text-center py-12 text-zinc-550">
                          Nenhum relato atende aos filtros selecionados.
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
                              {filteredReports.map((report) => {
                                const dateFormatted = new Date(report.created_at).toLocaleString('pt-BR');
                                const svcName = report.services?.name || services.find(s => s.id === report.service_id)?.name || 'Serviço Excluído';
                                return (
                                  <TableRow key={report.id} className="hover:bg-zinc-900/30 border-zinc-900">
                                    <TableCell className="text-zinc-300 text-xs whitespace-nowrap">{dateFormatted}</TableCell>
                                    <TableCell className="font-bold text-white text-sm">
                                      <div className="flex flex-col items-start gap-1">
                                        <span>{svcName}</span>
                                        {report.custom_fields?.active_alert && (
                                          <div className="flex flex-wrap gap-1">
                                            {String(report.custom_fields.active_alert).split(' | ').map((tag, idx) => (
                                              <Badge key={idx} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] px-1.5 py-0 rounded-md w-fit font-medium whitespace-nowrap">
                                                {tag}
                                              </Badge>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </TableCell>
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
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in-50 duration-300">
                  {!isAlertsReportGenerated ? (
                    /* ALERTS LIST VIEW (SELECTION) */
                    <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
                        <div>
                          <CardTitle className="text-xl font-bold">Análise por Alertas</CardTitle>
                          <CardDescription className="text-zinc-550 mt-1">
                            Selecione um ou mais alarmes do histórico para gerar um relatório consolidado de todos os relatos recebidos durante suas vigências.
                          </CardDescription>
                        </div>
                        <Button
                          disabled={selectedAlertIds.length === 0}
                          onClick={() => {
                            setIsAlertsReportGenerated(true);
                            setReportFilterService('all');
                            setReportFilterIssue('all');
                            setReportFilterRegion('all');
                            setReportFilterConnection('all');
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold gap-1.5 rounded-xl text-xs py-2 px-4 shadow-lg shadow-indigo-600/10 transition-all self-start sm:self-auto"
                        >
                          <Sliders className="h-4 w-4" />
                          Gerar Relatório Analítico ({selectedAlertIds.length})
                        </Button>
                      </CardHeader>
                      <CardContent className="pt-6">
                        {networkAlerts.length === 0 ? (
                          <div className="text-center py-10 text-zinc-500 text-xs">
                            Nenhum alerta de instabilidade registrado.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-zinc-900">
                            <Table className="bg-zinc-950/80">
                              <TableHeader className="bg-zinc-900/50 border-zinc-850">
                                <TableRow className="hover:bg-zinc-900/20">
                                  <TableHead className="w-12 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedAlertIds.length === networkAlerts.length && networkAlerts.length > 0}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedAlertIds(networkAlerts.map(a => a.id));
                                        } else {
                                          setSelectedAlertIds([]);
                                        }
                                      }}
                                      className="rounded border-zinc-800 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                    />
                                  </TableHead>
                                  <TableHead className="text-zinc-400 font-semibold">Alerta</TableHead>
                                  <TableHead className="text-zinc-400 font-semibold">Tipo</TableHead>
                                  <TableHead className="text-zinc-400 font-semibold">Período de Vigência</TableHead>
                                  <TableHead className="text-zinc-400 font-semibold text-center">Relatos</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {networkAlerts.map((alert) => {
                                  const createdDate = new Date(alert.created_at).toLocaleString('pt-BR');
                                  const isExpired = alert.expires_at && new Date(alert.expires_at).getTime() < Date.now();
                                  const isActive = alert.is_active && !isExpired;
                                  const count = reportsCountPerAlert[alert.id] || 0;
                                  const isSelected = selectedAlertIds.includes(alert.id);

                                  return (
                                    <TableRow 
                                      key={alert.id} 
                                      className={`hover:bg-zinc-900/30 border-zinc-900 transition-colors cursor-pointer ${
                                        isSelected ? 'bg-indigo-900/5 hover:bg-indigo-900/10 border-l border-l-indigo-500' : ''
                                      }`}
                                      onClick={() => {
                                        setSelectedAlertIds(prev =>
                                          prev.includes(alert.id)
                                            ? prev.filter(id => id !== alert.id)
                                            : [...prev, alert.id]
                                        );
                                      }}
                                    >
                                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            setSelectedAlertIds(prev =>
                                              e.target.checked
                                                ? [...prev, alert.id]
                                                : prev.filter(id => id !== alert.id)
                                            );
                                          }}
                                          className="rounded border-zinc-800 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                                        />
                                      </TableCell>
                                      <TableCell className="font-bold text-white text-sm">
                                        {alert.title}
                                        <div className="text-[10px] text-zinc-500 font-normal mt-0.5">Criado em: {createdDate}</div>
                                      </TableCell>
                                      <TableCell className="text-zinc-300 text-xs">
                                        <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-[10px]">
                                          {alert.alert_type}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-zinc-400 text-xs">
                                        <div className="flex flex-col gap-0.5">
                                          <div><span className="text-zinc-500 text-[10px]">Início:</span> {createdDate}</div>
                                          <div>
                                            <span className="text-zinc-500 text-[10px]">Término:</span>{' '}
                                            {alert.expires_at ? (
                                              new Date(alert.expires_at).toLocaleString('pt-BR')
                                            ) : !alert.is_active ? (
                                              new Date(alert.updated_at || alert.created_at).toLocaleString('pt-BR')
                                            ) : (
                                              <span className="text-emerald-400 font-semibold">Ativo (em vigência)</span>
                                            )}
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge className="bg-zinc-900 border border-zinc-850 text-zinc-300 text-xs px-2 py-0.5 rounded-full font-bold">
                                          {count} relatos
                                        </Badge>
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
                  ) : (
                    /* ALERTS REPORT DASHBOARD VIEW */
                    <div className="space-y-6 animate-in zoom-in-95 duration-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <Button 
                            onClick={() => setIsAlertsReportGenerated(false)}
                            variant="outline"
                            className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white rounded-xl text-xs gap-1.5 h-9 animate-in slide-in-from-left duration-200"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Voltar para Seleção
                          </Button>
                          <div>
                            <h2 className="text-xl font-bold text-white">Relatório Analítico por Alertas</h2>
                            <p className="text-xs text-zinc-500">Métricas consolidadas do(s) alarme(s) selecionado(s).</p>
                          </div>
                        </div>
                      </div>

                      {/* SELECTED ALERTS LABELS */}
                      <Card className="bg-zinc-950/45 border-zinc-900 p-4 flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-zinc-400 font-semibold mr-1">Escopo de Análise:</span>
                        {networkAlerts.filter(a => selectedAlertIds.includes(a.id)).map(alert => (
                          <Badge key={alert.id} className="bg-indigo-600/10 text-indigo-400 border border-indigo-500/25 px-2.5 py-0.5 text-xs font-semibold rounded-md">
                            {alert.title}
                          </Badge>
                        ))}
                      </Card>

                      {/* GENERAL METRICS ROW */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Metric 1 */}
                        <Card className="bg-zinc-950/60 border-zinc-900 p-5 flex flex-col justify-between">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Total de Relatos</span>
                          <span className="text-3xl font-extrabold text-white mt-2">{reportsInSelectedAlerts.length}</span>
                          <span className="text-[10px] text-zinc-400 mt-1">no escopo dos alarmes</span>
                        </Card>
                        {/* Metric 2 */}
                        <Card className="bg-zinc-950/60 border-zinc-900 p-5 flex flex-col justify-between">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Relatos Filtrados</span>
                          <span className="text-3xl font-extrabold text-indigo-400 mt-2">{filteredReportsInReportView.length}</span>
                          <span className="text-[10px] text-zinc-400 mt-1">com filtros aplicados</span>
                        </Card>
                        {/* Metric 3 */}
                        <Card className="bg-zinc-950/60 border-zinc-900 p-5 flex flex-col justify-between">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Serviços Afetados</span>
                          <span className="text-3xl font-extrabold text-amber-500 mt-2">
                            {new Set(filteredReportsInReportView.map(r => r.service_id)).size}
                          </span>
                          <span className="text-[10px] text-zinc-400 mt-1">plataformas impactadas</span>
                        </Card>
                        {/* Metric 4 */}
                        <Card className="bg-zinc-950/60 border-zinc-900 p-5 flex flex-col justify-between">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Eficácia de Reboot</span>
                          <span className="text-3xl font-extrabold text-emerald-500 mt-2">
                            {filteredReportsInReportView.length > 0 
                              ? `${Math.round((filteredReportsInReportView.filter(r => r.is_resolved).length / filteredReportsInReportView.length) * 100)}%`
                              : '0%'
                            }
                          </span>
                          <span className="text-[10px] text-zinc-400 mt-1">resolvidos pós reboot</span>
                        </Card>
                      </div>

                      {/* INLINE DYNAMIC FILTERS BAR */}
                      <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                        <CardHeader className="py-3.5 border-b border-zinc-900 flex flex-row items-center gap-2">
                          <Filter className="h-4 w-4 text-indigo-400" />
                          <CardTitle className="text-xs font-bold uppercase tracking-wider text-zinc-300">Filtros do Relatório</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            {/* Filter: Service */}
                            <div className="space-y-1">
                              <Label className="text-[11px] text-zinc-400 font-semibold">Serviço</Label>
                              <Select value={reportFilterService} onValueChange={(val) => setReportFilterService(val || 'all')}>
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9">
                                  <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                  <SelectItem value="all">Todos os Serviços</SelectItem>
                                  {services.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Filter: Issue Type */}
                            <div className="space-y-1">
                              <Label className="text-[11px] text-zinc-400 font-semibold">Problema</Label>
                              <Select value={reportFilterIssue} onValueChange={(val) => setReportFilterIssue(val || 'all')}>
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9">
                                  <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                  <SelectItem value="all">Todos os Problemas</SelectItem>
                                  {formSchema.find(f => f.id === 'issue_type')?.options?.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Filter: Region */}
                            <div className="space-y-1">
                              <Label className="text-[11px] text-zinc-400 font-semibold">Região</Label>
                              <Select value={reportFilterRegion} onValueChange={(val) => setReportFilterRegion(val || 'all')}>
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9">
                                  <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                  <SelectItem value="all">Todas as Regiões</SelectItem>
                                  {formSchema.find(f => f.id === 'region')?.options?.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Filter: Connection Type */}
                            <div className="space-y-1">
                              <Label className="text-[11px] text-zinc-400 font-semibold">Meio de Transmissão</Label>
                              <Select value={reportFilterConnection} onValueChange={(val) => setReportFilterConnection(val || 'all')}>
                                <SelectTrigger className="bg-zinc-900 border-zinc-800 text-xs h-9">
                                  <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                  <SelectItem value="all">Todos os Meios</SelectItem>
                                  {formSchema.find(f => f.id === 'connection_type')?.options?.map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* MINI CHARTS CONTAINER */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Mini Chart 1: Services Distribution */}
                        <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-zinc-300">Serviços Mais Impactados</CardTitle>
                          </CardHeader>
                          <CardContent className="h-56 pt-2">
                            {isMounted && selectedAlertsBarChartData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={selectedAlertsBarChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                                  <XAxis dataKey="name" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                                  <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#18181b', borderRadius: '10px', fontSize: '10px' }} />
                                  <Bar dataKey="relatos" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                                Sem dados estatísticos
                              </div>
                            )}
                          </CardContent>
                        </Card>

                        {/* Mini Chart 2: Issues Distribution */}
                        <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-zinc-300">Principais Sintomas / Problemas</CardTitle>
                          </CardHeader>
                          <CardContent className="h-56 pt-2">
                            {isMounted && selectedAlertsIssuesChartData.length > 0 ? (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={selectedAlertsIssuesChartData} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 5 }}>
                                  <XAxis type="number" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} allowDecimals={false} />
                                  <YAxis dataKey="name" type="category" stroke="#888888" fontSize={9} width={90} tickLine={false} axisLine={false} />
                                  <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#18181b', borderRadius: '10px', fontSize: '10px' }} />
                                  <Bar dataKey="relatos" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            ) : (
                              <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                                Sem dados de sintomas
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>

                      {/* DETAIL REPORT TABLE */}
                      <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                        <CardHeader>
                          <CardTitle className="text-base font-bold">Detalhamento dos Relatos no Escopo</CardTitle>
                          <CardDescription className="text-xs text-zinc-500 flex flex-col md:flex-row justify-between md:items-center gap-3">
                            <span>Exibindo {filteredReportsInReportView.length} relatos que caíram nas janelas ativas selecionadas.</span>
                            {selectedAlerts.length > 1 && (
                              <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 rounded-lg w-fit">
                                * Relatos em períodos sobrepostos são unificados para evitar duplicidade.
                              </span>
                            )}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          {filteredReportsInReportView.length === 0 ? (
                            <div className="text-center py-10 text-zinc-500 text-xs">
                              Nenhum relato encontrado para a combinação atual de filtros.
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-lg border border-zinc-900">
                              <Table className="bg-zinc-950/80">
                                <TableHeader className="bg-zinc-900/50 border-zinc-850">
                                  <TableRow className="hover:bg-zinc-900/20">
                                    <TableHead className="text-zinc-400 font-semibold text-xs">Data</TableHead>
                                    <TableHead className="text-zinc-400 font-semibold text-xs">Serviço</TableHead>
                                    {formSchema.map(f => (
                                      <TableHead key={f.id} className="text-zinc-400 font-semibold text-xs">{f.label}</TableHead>
                                    ))}
                                    <TableHead className="text-zinc-400 font-semibold text-xs text-center">Resolvido?</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {filteredReportsInReportView.map((report) => {
                                    const dateFormatted = new Date(report.created_at).toLocaleString('pt-BR');
                                    const svcName = report.services?.name || services.find(s => s.id === report.service_id)?.name || 'Serviço Excluído';
                                    
                                    // Find matching selected alerts whose active period includes this report
                                    const matchingAlerts = selectedAlerts.filter(alert => {
                                      const start = new Date(alert.created_at).getTime();
                                      let end = Date.now();
                                      if (alert.expires_at) {
                                        end = new Date(alert.expires_at).getTime();
                                      } else if (!alert.is_active) {
                                        end = new Date(alert.updated_at || alert.created_at).getTime();
                                      }
                                      const rTime = new Date(report.created_at).getTime();
                                      return rTime >= start && rTime <= end;
                                    });

                                    return (
                                      <TableRow key={report.id} className="hover:bg-zinc-900/30 border-zinc-900">
                                        <TableCell className="text-zinc-300 text-[11px] whitespace-nowrap">{dateFormatted}</TableCell>
                                        <TableCell className="font-bold text-white text-xs">
                                          <div className="flex flex-col items-start gap-1">
                                            <span>{svcName}</span>
                                            {matchingAlerts.length > 0 && (
                                              <div className="flex flex-wrap gap-1">
                                                {matchingAlerts.map(alert => (
                                                  <Badge key={alert.id} className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 text-[9px] px-1.5 py-0 rounded-md w-fit font-medium whitespace-nowrap" title={alert.title}>
                                                    {alert.title.length > 15 ? alert.title.slice(0, 15) + '...' : alert.title}
                                                  </Badge>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </TableCell>
                                        {formSchema.map(f => {
                                          const val = (report as any)[f.id] ?? report.custom_fields?.[f.id] ?? '-';
                                          return (
                                            <TableCell key={f.id} className="text-zinc-300 text-[11px] max-w-[150px] truncate" title={val}>{val}</TableCell>
                                          );
                                        })}
                                        <TableCell className="text-center">
                                          {report.is_resolved ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] mx-auto w-fit flex gap-1 items-center justify-center">
                                              <CheckCircle2 className="h-3 w-3" /> Sim
                                            </Badge>
                                          ) : (
                                            <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] mx-auto w-fit flex gap-1 items-center justify-center">
                                              <XCircle className="h-3 w-3" /> Não
                                            </Badge>
                                          )}
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SETTINGS (FORM OPTIONS + SERVICE CRUD) */}
        {activeTab === 'settings' && (
          <div className="flex flex-col lg:flex-row gap-6 items-start relative z-10 animate-in fade-in duration-300 w-full">
            {/* SIDEBAR NAVIGATION MENU */}
            <aside className={`shrink-0 transition-all duration-300 sticky top-24 z-40 hidden lg:block ${isSidebarOpen ? 'w-64' : 'w-[76px]'}`}>
              <div 
                onMouseEnter={() => setIsSidebarHovered(true)}
                onMouseLeave={() => setIsSidebarHovered(false)}
                className={`flex flex-col gap-1.5 bg-zinc-950/70 p-3 rounded-2xl border border-zinc-900 transition-all duration-300 ease-in-out backdrop-blur-md
                  ${(isSidebarOpen || isSidebarHovered) ? 'w-64 shadow-2xl border-zinc-800' : 'w-[76px]'}
                `}
              >
                {/* Cabeçalho do Menu */}
                <div className={`flex items-center mb-3 transition-all duration-300 ${(isSidebarOpen || isSidebarHovered) ? 'justify-between px-2' : 'justify-center'}`}>
                  {(isSidebarOpen || isSidebarHovered) ? (
                    <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 animate-in fade-in duration-300 whitespace-nowrap overflow-hidden">
                      Configurações
                    </span>
                  ) : null}
                  <Button
                    onClick={() => setIsSidebarOpen(prev => !prev)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900/50 shrink-0"
                    title={isSidebarOpen ? "Recolher menu" : "Fixar menu"}
                  >
                    <Menu className="h-4.5 w-4.5" />
                  </Button>
                </div>

                {/* Opções */}
                {hasReadAccess('cards') && (
                  <Button
                    onClick={() => setSettingsSubTab('cards')}
                    variant="ghost"
                    className={`w-full rounded-xl text-xs font-semibold py-5 transition-all duration-200 flex items-center ${
                      (isSidebarOpen || isSidebarHovered) ? 'justify-start px-4 gap-3' : 'justify-center px-0 gap-0'
                    } ${
                      settingsSubTab === 'cards'
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                    }`}
                    title="Gerenciamento de Cards"
                  >
                    <Layers className="h-4 w-4 shrink-0" />
                    <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${(isSidebarOpen || isSidebarHovered) ? 'w-auto opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                      Gerenciamento de Cards
                    </span>
                  </Button>
                )}

                {hasReadAccess('form') && (
                  <Button
                    onClick={() => setSettingsSubTab('form')}
                    variant="ghost"
                    className={`w-full rounded-xl text-xs font-semibold py-5 transition-all duration-200 flex items-center ${
                      (isSidebarOpen || isSidebarHovered) ? 'justify-start px-4 gap-3' : 'justify-center px-0 gap-0'
                    } ${
                      settingsSubTab === 'form'
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                    }`}
                    title="Construtor de Formulários"
                  >
                    <FormInput className="h-4 w-4 shrink-0" />
                    <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${(isSidebarOpen || isSidebarHovered) ? 'w-auto opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                      Construtor de Formulários
                    </span>
                  </Button>
                )}

                {hasReadAccess('alerts') && (
                  <Button
                    onClick={() => setSettingsSubTab('alerts')}
                    variant="ghost"
                    className={`w-full rounded-xl text-xs font-semibold py-5 transition-all duration-200 flex items-center ${
                      (isSidebarOpen || isSidebarHovered) ? 'justify-start px-4 gap-3' : 'justify-center px-0 gap-0'
                    } ${
                      settingsSubTab === 'alerts'
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                    }`}
                    title="Gerenciar Alertas"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${(isSidebarOpen || isSidebarHovered) ? 'w-auto opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                      Gerenciar Alertas
                    </span>
                  </Button>
                )}

                {hasReadAccess('logs') && (
                  <Button
                    onClick={() => setSettingsSubTab('logs')}
                    variant="ghost"
                    className={`w-full rounded-xl text-xs font-semibold py-5 transition-all duration-200 flex items-center ${
                      (isSidebarOpen || isSidebarHovered) ? 'justify-start px-4 gap-3' : 'justify-center px-0 gap-0'
                    } ${
                      settingsSubTab === 'logs'
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                    }`}
                    title="Logs de Auditoria"
                  >
                    <Activity className="h-4 w-4 shrink-0" />
                    <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${(isSidebarOpen || isSidebarHovered) ? 'w-auto opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                      Logs de Auditoria
                    </span>
                  </Button>
                )}

                {currentUserProfile?.role === 'superadmin' && (
                  <Button
                    onClick={() => setSettingsSubTab('users')}
                    variant="ghost"
                    className={`w-full rounded-xl text-xs font-semibold py-5 transition-all duration-200 flex items-center ${
                      (isSidebarOpen || isSidebarHovered) ? 'justify-start px-4 gap-3' : 'justify-center px-0 gap-0'
                    } ${
                      settingsSubTab === 'users'
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                    }`}
                    title="Gerenciamento de Usuários"
                  >
                    <Shield className="h-4 w-4 shrink-0" />
                    <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${(isSidebarOpen || isSidebarHovered) ? 'w-auto opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}>
                      Gerenciamento de Usuários
                    </span>
                  </Button>
                )}
              </div>
            </aside>

            {/* Mobile Sidebar (stacks or collapses) */}
            <div className="w-full lg:hidden block mb-4">
              <div className="bg-zinc-950/70 p-3 rounded-2xl border border-zinc-900 flex flex-col gap-1.5 w-full">
                <div className="flex items-center justify-between px-2 mb-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                    Configurações
                  </span>
                  <Button
                    onClick={() => setIsSidebarOpen(prev => !prev)}
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900/50 shrink-0"
                    title={isSidebarOpen ? "Recolher menu" : "Expandir menu"}
                  >
                    <Menu className="h-4.5 w-4.5" />
                  </Button>
                </div>
                {isSidebarOpen && (
                  <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-4 duration-200">
                    {hasReadAccess('cards') && (
                      <Button
                        onClick={() => setSettingsSubTab('cards')}
                        variant="ghost"
                        className={`w-full justify-start rounded-xl text-xs font-semibold gap-3 py-5 px-4 transition-all duration-200 flex items-center ${
                          settingsSubTab === 'cards'
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                        }`}
                      >
                        <Layers className="h-4 w-4 shrink-0" />
                        Gerenciamento de Cards
                      </Button>
                    )}
                    {hasReadAccess('form') && (
                      <Button
                        onClick={() => setSettingsSubTab('form')}
                        variant="ghost"
                        className={`w-full justify-start rounded-xl text-xs font-semibold gap-3 py-5 px-4 transition-all duration-200 flex items-center ${
                          settingsSubTab === 'form'
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                        }`}
                      >
                        <FormInput className="h-4 w-4 shrink-0" />
                        Construtor de Formulários
                      </Button>
                    )}
                    {hasReadAccess('alerts') && (
                      <Button
                        onClick={() => setSettingsSubTab('alerts')}
                        variant="ghost"
                        className={`w-full justify-start rounded-xl text-xs font-semibold gap-3 py-5 px-4 transition-all duration-200 flex items-center ${
                          settingsSubTab === 'alerts'
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                        }`}
                      >
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        Gerenciar Alertas
                      </Button>
                    )}
                    {hasReadAccess('logs') && (
                      <Button
                        onClick={() => setSettingsSubTab('logs')}
                        variant="ghost"
                        className={`w-full justify-start rounded-xl text-xs font-semibold gap-3 py-5 px-4 transition-all duration-200 flex items-center ${
                          settingsSubTab === 'logs'
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                        }`}
                      >
                        <Activity className="h-4 w-4 shrink-0" />
                        Logs de Auditoria
                      </Button>
                    )}
                    {currentUserProfile?.role === 'superadmin' && (
                      <Button
                        onClick={() => setSettingsSubTab('users')}
                        variant="ghost"
                        className={`w-full justify-start rounded-xl text-xs font-semibold gap-3 py-5 px-4 transition-all duration-200 flex items-center ${
                          settingsSubTab === 'users'
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/10'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
                        }`}
                      >
                        <Shield className="h-4 w-4 shrink-0" />
                        Gerenciamento de Usuários
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 min-w-0 w-full space-y-6">
              {settingsSubTab === 'cards' && (
                <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <CardTitle className="text-xl font-bold">Gerenciamento de Serviços (Cards)</CardTitle>
                        {!hasWriteAccess('cards') && (
                          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-md font-semibold select-none flex gap-1 items-center">
                            <Eye className="h-3 w-3" /> Apenas Visualização
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-zinc-500 mt-1">
                        Insira novos cards de serviços, edite nomes, categorias ou altere o status de forma manual se necessário.
                      </CardDescription>
                    </div>
                    {hasWriteAccess('cards') && (
                      <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
                        <Button
                          onClick={handleOpenAddCategory}
                          variant="outline"
                          className="border-zinc-800 hover:bg-zinc-900 text-zinc-300 hover:text-white font-semibold gap-1.5 rounded-xl text-xs py-2 px-4 transition-all"
                        >
                          <Sliders className="h-4 w-4 text-indigo-400" />
                          Gerenciar Categorias
                        </Button>
                        <Button
                          onClick={handleOpenAddService}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-1.5 rounded-xl text-xs py-2 px-4 shadow-lg shadow-indigo-600/10 transition-all"
                        >
                          <Plus className="h-4 w-4" />
                          Novo Serviço
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="pt-6">
                    {services.length === 0 ? (
                      <div className="text-center py-10 text-zinc-500">
                        Nenhum serviço cadastrado. Adicione um acima.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* SEARCH INPUT BAR */}
                        <div className="relative w-full max-w-sm">
                          <Icons.Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-550" />
                          <Input
                            type="text"
                            placeholder="Buscar serviços por nome ou categoria..."
                            value={searchServicesQuery}
                            onChange={(e) => setSearchServicesQuery(e.target.value)}
                            className="pl-9 bg-zinc-900/40 border-zinc-900 focus:border-zinc-800 text-zinc-200 placeholder-zinc-550 text-xs rounded-xl"
                          />
                          {searchServicesQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchServicesQuery('')}
                              className="absolute right-3 top-2.5 hover:text-white text-zinc-500 transition-colors"
                              title="Limpar pesquisa"
                            >
                              <Icons.X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {filteredServices.length === 0 ? (
                          <div className="text-center py-12 text-zinc-550 border border-zinc-900 rounded-xl bg-zinc-950/30 text-xs">
                            Nenhum serviço correspondente encontrado para a pesquisa.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-zinc-900">
                            <Table className="bg-zinc-950/80">
                              <TableHeader className="bg-zinc-900/50 border-zinc-850">
                                <TableRow className="hover:bg-zinc-900/20">
                                  <TableHead className="text-zinc-400 font-semibold">Nome</TableHead>
                                  <TableHead className="text-zinc-400 font-semibold">Categoria</TableHead>
                                  <TableHead className="text-zinc-400 font-semibold">Ícone</TableHead>
                                  {hasWriteAccess('cards') && (
                                    <TableHead className="text-zinc-400 font-semibold text-right">Ações</TableHead>
                                  )}
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredServices.map((service) => {
                                  return (
                                    <TableRow key={service.id} className="hover:bg-zinc-900/30 border-zinc-900">
                                      <TableCell className="font-bold text-white text-sm">{service.name}</TableCell>
                                      <TableCell className="text-zinc-300 text-xs">{service.category}</TableCell>
                                      <TableCell className="text-zinc-400 text-xs font-mono">{service.icon_name || 'Globe'}</TableCell>
                                      {hasWriteAccess('cards') && (
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
                                      )}
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {settingsSubTab === 'form' && (
                <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                  <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <CardTitle className="text-xl font-bold">Construtor de Formulário</CardTitle>
                      {!hasWriteAccess('form') && (
                        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-md font-semibold select-none flex gap-1 items-center">
                          <Eye className="h-3 w-3" /> Apenas Visualização
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="text-zinc-550 mt-1">
                      Crie e edite os campos que serão exibidos no momento que o usuário for reportar uma instabilidade.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSaveSettings} className="space-y-6">
                      
                      <FormBuilder schema={formSchema} onChange={hasWriteAccess('form') ? setFormSchema : () => {}} />

                      {/* CONFIGURAÇÃO DE EXIBIÇÃO DE SERVIÇOS RELACIONADOS */}
                      <div className="p-4 bg-zinc-900/35 border border-zinc-900 rounded-xl space-y-4 pt-4 mt-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1 pr-4">
                            <Label htmlFor="showRelatedServices" className="text-sm font-semibold text-zinc-200 cursor-pointer">
                              Permitir Relatos Correlacionados (Multisserviço)
                            </Label>
                            <p className="text-xs text-zinc-500">
                              Exibe a opção "Relacionar com outros serviços afetados?" no formulário público, permitindo a correlação de múltiplos serviços em um único envio.
                            </p>
                          </div>
                          <input
                            id="showRelatedServices"
                            type="checkbox"
                            checked={showRelatedServices}
                            disabled={!hasWriteAccess('form')}
                            onChange={(e) => setShowRelatedServices(e.target.checked)}
                            className="rounded border-zinc-800 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 h-5 w-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </div>
                      </div>

                      {hasWriteAccess('form') && (
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
                      )}
                    </form>
                  </CardContent>
                </Card>
              )}

              {settingsSubTab === 'alerts' && (
                <div className="space-y-6">
                  {/* REGRAS DE CRITICIDADE */}
                  <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <CardTitle className="text-xl font-bold">Regras de Criticidade (Algoritmo Automático)</CardTitle>
                        {!hasWriteAccess('alerts') && (
                          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-md font-semibold select-none flex gap-1 items-center">
                            <Eye className="h-3 w-3" /> Apenas Visualização
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-zinc-550 mt-1">
                        Defina quantos relatos em um curto período são necessários para disparar alertas visuais no site público.
                      </CardDescription>
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
                              disabled={!hasWriteAccess('alerts')}
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
                              disabled={!hasWriteAccess('alerts')}
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
                              className="bg-zinc-900 border-zinc-800 text-red-450 focus:border-red-500"
                              disabled={!hasWriteAccess('alerts')}
                              required
                            />
                            <p className="text-xs text-zinc-500">Mínimo para card vermelho.</p>
                          </div>

                          {/* Public Chart Window Limit */}
                          <div className="space-y-2">
                            <Label htmlFor="chartWindowHours" className="text-indigo-400 font-semibold text-sm">Janela do Gráfico Público</Label>
                            <Select 
                              value={String(chartWindowHours)} 
                              onValueChange={(val) => setChartWindowHours(Number(val || '24'))}
                              disabled={!hasWriteAccess('alerts')}
                            >
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
                                className="bg-zinc-900 border-zinc-800 text-emerald-400 focus:border-emerald-550"
                                placeholder="Ex: Operando"
                                disabled={!hasWriteAccess('alerts')}
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
                                disabled={!hasWriteAccess('alerts')}
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
                                className="bg-zinc-900 border-zinc-800 text-red-450 focus:border-red-500"
                                placeholder="Ex: Queda total"
                                disabled={!hasWriteAccess('alerts')}
                                required
                              />
                              <p className="text-xs text-zinc-500">Texto para falha total.</p>
                            </div>
                          </div>
                        </div>

                        {hasWriteAccess('alerts') && (
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
                        )}
                      </form>
                    </CardContent>
                  </Card>

                  {/* CONFIG DISPLAY INTERVAL */}
                  <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <CardTitle className="text-xl font-bold">Configurações de Exibição de Alertas</CardTitle>
                        {!hasWriteAccess('alerts') && (
                          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-md font-semibold select-none flex gap-1 items-center">
                            <Eye className="h-3 w-3" /> Apenas Visualização
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-zinc-500 mt-1">
                        Ajuste o intervalo de tempo para a re-exibição do alerta na interface pública para os usuários.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSaveAlertConfig} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="displayInterval" className="text-zinc-300 font-semibold text-sm">
                              Intervalo de Exibição (Minutos)
                            </Label>
                            <Input
                              id="displayInterval"
                              type="number"
                              min={1}
                              value={displayInterval}
                              onChange={(e) => setDisplayInterval(Number(e.target.value))}
                              className="bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500"
                              disabled={!hasWriteAccess('alerts')}
                              required
                            />
                            <p className="text-xs text-zinc-555 mt-1">
                              O alerta ativo irá reaparecer como popup para o usuário a cada {displayInterval} minutos.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="autoCloseInterval" className="text-zinc-300 font-semibold text-sm">
                              Auto-fechamento do Alerta (Segundos)
                            </Label>
                            <Input
                              id="autoCloseInterval"
                              type="number"
                              min={0}
                              value={autoCloseInterval}
                              onChange={(e) => setAutoCloseInterval(Number(e.target.value))}
                              className="bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500"
                              disabled={!hasWriteAccess('alerts')}
                              required
                            />
                            <p className="text-xs text-zinc-555 mt-1">
                              O alerta irá fechar automaticamente após {autoCloseInterval} segundos (use 0 para desabilitar).
                            </p>
                          </div>
                        </div>

                        {hasWriteAccess('alerts') && (
                          <div className="flex justify-end pt-2">
                            <Button
                              type="submit"
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                              disabled={isSavingAlertsConfig}
                            >
                              {isSavingAlertsConfig ? 'Salvando...' : 'Salvar Configuração'}
                            </Button>
                          </div>
                        )}
                      </form>
                    </CardContent>
                  </Card>

                  {/* DETECÇÃO AUTOMÁTICA DE ALERTAS */}
                  <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <CardTitle className="text-xl font-bold flex items-center gap-2">
                          <Activity className="h-5 w-5 text-indigo-400" />
                          Detecção Automática de Alertas
                        </CardTitle>
                        {!hasWriteAccess('alerts') && (
                          <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-md font-semibold select-none flex gap-1 items-center">
                            <Eye className="h-3 w-3" /> Apenas Visualização
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-zinc-500 mt-1">
                        Configure as regras para geração automática de sinal de alerta com base na porcentagem de acessos simultâneos relatando instabilidade.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSaveAlertConfig} className="space-y-6">
                        
                        {/* Toggle & Informative Warning */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3.5 bg-zinc-900/30 border border-zinc-900 rounded-xl">
                            <div className="space-y-1 pr-4">
                              <Label htmlFor="autoAlertEnabled" className="text-sm font-semibold text-zinc-200 cursor-pointer">
                                Ativar Detecção Automática
                              </Label>
                              <p className="text-xs text-zinc-500">
                                Monitora relatos públicos em tempo real em relação ao número de usuários online.
                              </p>
                            </div>
                            <input
                              id="autoAlertEnabled"
                              type="checkbox"
                              checked={autoAlertEnabled && !hasActiveManualAlert}
                              disabled={!hasWriteAccess('alerts') || hasActiveManualAlert}
                              onChange={(e) => setAutoAlertEnabled(e.target.checked)}
                              className="rounded border-zinc-800 bg-zinc-900 text-indigo-600 focus:ring-indigo-500 h-5 w-5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </div>

                          {/* Mensagem explicativa de intertravamento */}
                          {hasActiveManualAlert ? (
                            <div className="p-3.5 bg-amber-500/5 border border-amber-500/10 rounded-xl text-xs flex gap-2.5 text-amber-400 leading-relaxed">
                              <AlertCircle className="h-5 w-5 shrink-0 animate-pulse" />
                              <div>
                                <strong>Detecção automática suspensa temporariamente:</strong> Há um alerta manual ativo no momento. 
                                O sistema desabilitou o alerta automático e reativará sua execução de forma totalmente automática assim que o alerta manual for desativado ou expirar.
                              </div>
                            </div>
                          ) : (
                            <div className="p-3.5 bg-zinc-900/30 border border-zinc-900 rounded-xl text-xs flex gap-2.5 text-zinc-400 leading-relaxed">
                              <AlertCircle className="h-5 w-5 shrink-0 text-zinc-500" />
                              <div>
                                <strong>Nota de Convivência de Alertas:</strong> A detecção automática é suspensa automaticamente se houver um alerta manual ativo. 
                                Ela será reativada de forma automática assim que o alerta manual for desativado ou expirar.
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Numeric Thresholds */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-zinc-900">
                          <div className="space-y-2">
                            <Label htmlFor="autoAlertPercentage" className="text-zinc-300 font-semibold text-sm">
                              Porcentagem Mínima de Acessos (%)
                            </Label>
                            <Input
                              id="autoAlertPercentage"
                              type="number"
                              min={1}
                              max={100}
                              value={autoAlertPercentage}
                              onChange={(e) => setAutoAlertPercentage(Number(e.target.value))}
                              className="bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500"
                              disabled={!hasWriteAccess('alerts') || hasActiveManualAlert}
                              required
                            />
                            <p className="text-xs text-zinc-500">
                              % mínima de visitantes concorrentes enviando relatos (ex: 50%).
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="autoAlertMinReports" className="text-zinc-300 font-semibold text-sm">
                              Volume Mínimo de Relatos (X)
                            </Label>
                            <Input
                              id="autoAlertMinReports"
                              type="number"
                              min={1}
                              value={autoAlertMinReports}
                              onChange={(e) => setAutoAlertMinReports(Number(e.target.value))}
                              className="bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500"
                              disabled={!hasWriteAccess('alerts') || hasActiveManualAlert}
                              required
                            />
                            <p className="text-xs text-zinc-500">
                              Quantidade bruta mínima de relatos no período (ex: 5 relatos).
                            </p>
                          </div>
                        </div>

                        {/* Title and Description */}
                        <div className="space-y-4 pt-4 border-t border-zinc-900">
                          <div className="space-y-2">
                            <Label htmlFor="autoAlertTitle" className="text-zinc-300 font-semibold text-sm">
                              Título do Alerta Automático
                            </Label>
                            <Input
                              id="autoAlertTitle"
                              type="text"
                              value={autoAlertTitle}
                              onChange={(e) => setAutoAlertTitle(e.target.value)}
                              placeholder="Ex: Instabilidade Geral na Rede"
                              className="bg-zinc-900 border-zinc-800 text-white focus:border-indigo-500"
                              disabled={!hasWriteAccess('alerts') || hasActiveManualAlert}
                              required
                            />
                            <p className="text-xs text-zinc-555">
                              Título que será exibido no aviso visual público.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="autoAlertDescription" className="text-zinc-300 font-semibold text-sm">
                              Descrição Informativa do Alerta Automático
                            </Label>
                            <textarea
                              id="autoAlertDescription"
                              rows={3}
                              value={autoAlertDescription}
                              onChange={(e) => setAutoAlertDescription(e.target.value)}
                              placeholder="Ex: Identificamos um pico elevado de relatos em nossa rede..."
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-white text-sm focus:border-indigo-500 focus:outline-none placeholder-zinc-500"
                              disabled={!hasWriteAccess('alerts') || hasActiveManualAlert}
                              required
                            />
                            <p className="text-xs text-zinc-555">
                              Mensagem informativa que instrui operadores a acionar o COR ou plantonista do CGR.
                            </p>
                          </div>
                        </div>

                        {hasWriteAccess('alerts') && (
                          <div className="flex justify-end pt-4 border-t border-zinc-900">
                            <Button
                              type="submit"
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
                              disabled={isSavingAlertsConfig}
                            >
                              {isSavingAlertsConfig ? 'Salvando...' : 'Salvar Detecção Automática'}
                            </Button>
                          </div>
                        )}
                      </form>
                    </CardContent>
                  </Card>

                  {/* ALERTS HISTORY & CRUD */}
                  <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <CardTitle className="text-xl font-bold">Alertas de Instabilidade de Rede</CardTitle>
                          {!hasWriteAccess('alerts') && (
                            <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded-md font-semibold select-none flex gap-1 items-center">
                              <Eye className="h-3 w-3" /> Apenas Visualização
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-zinc-550 mt-1">
                          Crie e gerencie alertas temporários ou contínuos que serão exibidos com destaque na interface pública.
                        </CardDescription>
                      </div>
                      {hasWriteAccess('alerts') && (
                        <Button
                          onClick={() => {
                            setEditingAlert(null);
                            setAlertFormTitle('');
                            setAlertFormType('Instabilidade Geral');
                            setAlertFormDescription('');
                            setAlertFormExpirationType('manual');
                            setAlertFormExpiresAt('');
                            setIsAlertModalOpen(true);
                          }}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-1.5 rounded-xl text-xs py-2 px-4 shadow-lg shadow-indigo-600/10 transition-all self-start sm:self-auto"
                        >
                          <Plus className="h-4 w-4" />
                          Criar Alerta
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="pt-6">
                      {networkAlerts.length === 0 ? (
                        <div className="text-center py-10 text-zinc-550 text-xs">
                          Nenhum alerta de instabilidade criado até o momento.
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-lg border border-zinc-900">
                          <Table className="bg-zinc-950/80">
                            <TableHeader className="bg-zinc-900/50 border-zinc-850">
                              <TableRow className="hover:bg-zinc-900/20">
                                <TableHead className="text-zinc-400 font-semibold">Alerta</TableHead>
                                <TableHead className="text-zinc-400 font-semibold">Tipo</TableHead>
                                <TableHead className="text-zinc-400 font-semibold">Descrição</TableHead>
                                <TableHead className="text-zinc-400 font-semibold">Expiração</TableHead>
                                <TableHead className="text-zinc-400 font-semibold text-center">Status</TableHead>
                                {hasWriteAccess('alerts') && (
                                  <TableHead className="text-zinc-400 font-semibold text-right">Ações</TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {networkAlerts.map((alert) => {
                                const createdDate = new Date(alert.created_at).toLocaleString('pt-BR');
                                
                                // Check if expired
                                const isExpired = alert.expires_at && new Date(alert.expires_at).getTime() < Date.now();
                                const isActive = alert.is_active && !isExpired;

                                return (
                                  <TableRow key={alert.id} className="hover:bg-zinc-900/30 border-zinc-900">
                                    <TableCell className="font-bold text-white text-sm">
                                      {alert.title}
                                      <div className="text-[10px] text-zinc-500 font-normal mt-0.5">Criado em: {createdDate}</div>
                                    </TableCell>
                                    <TableCell className="text-zinc-300 text-xs">
                                      <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 text-[10px]">
                                        {alert.alert_type}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-zinc-400 text-xs max-w-[250px] truncate" title={alert.description}>
                                      {alert.description}
                                    </TableCell>
                                    <TableCell className="text-zinc-400 text-xs">
                                      {alert.alert_type === 'Detecção Automática' ? (
                                        <span className="text-indigo-400 font-semibold">Automático</span>
                                      ) : alert.expires_at ? (
                                        <span>Expirará: {new Date(alert.expires_at).toLocaleString('pt-BR')}</span>
                                      ) : (
                                        <span className="text-zinc-500">Desativação manual</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                      {isActive ? (
                                        <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] mx-auto w-fit flex gap-1 items-center justify-center">
                                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse mr-1" /> Ativo
                                        </Badge>
                                      ) : isExpired ? (
                                        <Badge className="bg-zinc-900 text-zinc-500 border border-zinc-800 text-[10px] mx-auto w-fit flex gap-1 items-center justify-center">
                                          Expirado
                                        </Badge>
                                      ) : (
                                        <Badge className="bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] mx-auto w-fit flex gap-1 items-center justify-center">
                                          Inativo
                                        </Badge>
                                      )}
                                    </TableCell>
                                    {hasWriteAccess('alerts') && (
                                      <TableCell className="text-right whitespace-nowrap">
                                        <div className="flex justify-end items-center gap-1.5">
                                          {alert.alert_type !== 'Detecção Automática' && (
                                            <>
                                              <Button
                                                onClick={() => handleToggleAlertActive(alert.id, alert.is_active)}
                                                variant="ghost"
                                                size="sm"
                                                className={`text-xs px-2.5 py-1 rounded-lg border h-8 ${
                                                  alert.is_active
                                                    ? 'border-red-500/20 text-red-450 hover:bg-red-500/10'
                                                    : 'border-emerald-500/20 text-emerald-450 hover:bg-emerald-500/10'
                                                }`}
                                                disabled={isExpired}
                                                title={alert.is_active ? 'Desativar alerta' : 'Ativar alerta'}
                                              >
                                                {alert.is_active ? 'Desativar' : 'Ativar'}
                                              </Button>
                                              
                                              <Button
                                                onClick={() => {
                                                  setEditingAlert(alert);
                                                  setAlertFormTitle(alert.title);
                                                  setAlertFormType(alert.alert_type);
                                                  setAlertFormDescription(alert.description);
                                                  setAlertFormExpirationType(alert.expires_at ? 'scheduled' : 'manual');
                                                  setAlertFormExpiresAt(alert.expires_at ? new Date(new Date(alert.expires_at).getTime() - new Date().getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16) : '');
                                                  setIsAlertModalOpen(true);
                                                }}
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg"
                                                title="Editar Alerta"
                                              >
                                                <Edit2 className="h-3.5 w-3.5" />
                                              </Button>
                                            </>
                                          )}
 
                                          <Button
                                            onClick={() => handleDeleteAlert(alert.id)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                                            title="Excluir Alerta"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {settingsSubTab === 'logs' && (
                <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold">Logs de Auditoria</CardTitle>
                    <CardDescription className="text-zinc-500">
                      Histórico de ações realizadas por administradores no painel em tempo real.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {actionLogs.length === 0 ? (
                      <div className="text-center py-12 text-zinc-550 text-xs">
                        Nenhum log registrado ou tabela de auditoria não configurada.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-zinc-900">
                        <Table className="bg-zinc-950/80">
                          <TableHeader className="bg-zinc-900/50 border-zinc-850">
                            <TableRow className="hover:bg-zinc-900/20">
                              <TableHead className="text-zinc-400 font-semibold">Data</TableHead>
                              <TableHead className="text-zinc-400 font-semibold">Usuário</TableHead>
                              <TableHead className="text-zinc-400 font-semibold">Ação</TableHead>
                              <TableHead className="text-zinc-400 font-semibold">Detalhes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {actionLogs.map((log) => {
                              const dateFormatted = new Date(log.created_at).toLocaleString('pt-BR');
                              return (
                                <TableRow key={log.id} className="hover:bg-zinc-900/30 border-zinc-900">
                                  <TableCell className="text-zinc-300 text-xs whitespace-nowrap">{dateFormatted}</TableCell>
                                  <TableCell className="font-semibold text-white text-xs whitespace-nowrap">{log.user_email}</TableCell>
                                  <TableCell className="text-indigo-400 font-semibold text-xs whitespace-nowrap">{log.action}</TableCell>
                                  <TableCell className="text-zinc-400 text-xs whitespace-normal break-words min-w-[250px] max-w-xs md:max-w-md lg:max-w-xl" title={log.details}>{log.details}</TableCell>
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

              {currentUserProfile?.role === 'superadmin' && settingsSubTab === 'users' && (
                <Card className="bg-zinc-950/60 border-zinc-900 text-white">
                  <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
                    <div>
                      <CardTitle className="text-xl font-bold">Gerenciamento de Usuários</CardTitle>
                      <CardDescription className="text-zinc-500">
                        Cadastre novos administradores e operadores, defina seus níveis de acesso e permissões personalizadas.
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleOpenAddUser}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-1.5 rounded-xl text-xs py-2 px-4 shadow-lg shadow-indigo-600/10 transition-all self-start sm:self-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Novo Usuário
                    </Button>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {adminUsersList.length === 0 ? (
                      <div className="text-center py-10 text-zinc-550 text-xs">
                        Nenhum usuário administrativo cadastrado.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* SEARCH INPUT BAR */}
                        <div className="relative w-full max-w-sm">
                          <Icons.Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-550" />
                          <Input
                            type="text"
                            placeholder="Buscar usuários por nome ou e-mail..."
                            value={searchUsersQuery}
                            onChange={(e) => setSearchUsersQuery(e.target.value)}
                            className="pl-9 bg-zinc-900/40 border-zinc-900 focus:border-zinc-800 text-zinc-200 placeholder-zinc-550 text-xs rounded-xl"
                          />
                          {searchUsersQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchUsersQuery('')}
                              className="absolute right-3 top-2.5 hover:text-white text-zinc-500 transition-colors"
                              title="Limpar pesquisa"
                            >
                              <Icons.X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {filteredUsers.length === 0 ? (
                          <div className="text-center py-12 text-zinc-550 border border-zinc-900 rounded-xl bg-zinc-950/30 text-xs">
                            Nenhum usuário correspondente encontrado para a pesquisa.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-zinc-900">
                            <Table className="bg-zinc-950/80">
                              <TableHeader className="bg-zinc-900/50 border-zinc-850">
                                <TableRow className="hover:bg-zinc-900/20">
                                  <TableHead className="text-zinc-400 font-semibold">Nome</TableHead>
                                  <TableHead className="text-zinc-400 font-semibold">Usuário (E-mail)</TableHead>
                                  <TableHead className="text-zinc-400 font-semibold">Cargo</TableHead>
                                  <TableHead className="text-zinc-400 font-semibold">Permissões Permitidas</TableHead>
                                  <TableHead className="text-zinc-400 font-semibold text-right">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredUsers.map((user) => {
                                  const isSelf = user.email.toLowerCase() === currentUserProfile?.email.toLowerCase();
                                  return (
                                    <TableRow key={user.email} className="hover:bg-zinc-900/30 border-zinc-900">
                                      <TableCell className="font-semibold text-zinc-300 text-sm whitespace-nowrap">
                                        {user.name || '-'}
                                      </TableCell>
                                      <TableCell className="font-bold text-white text-sm whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                          <span>{user.email}</span>
                                          {isSelf && (
                                            <Badge className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 text-[9px] px-1.5 font-medium">Você</Badge>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="whitespace-nowrap">
                                        {user.role === 'superadmin' ? (
                                          <Badge className="bg-red-500/15 text-red-400 border border-red-500/20 text-[10px]">Superadmin</Badge>
                                        ) : (
                                          <Badge className="bg-zinc-850 text-zinc-400 border border-zinc-800 text-[10px]">Admin</Badge>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-wrap gap-1.5">
                                          {user.role === 'superadmin' ? (
                                            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[9px]">Acesso Total</Badge>
                                          ) : (
                                            <>
                                              {(() => {
                                                const renderedBadges = [
                                                  { key: 'cards', label: 'Cards' },
                                                  { key: 'form', label: 'Formulário' },
                                                  { key: 'rules', label: 'Regras' },
                                                  { key: 'alerts', label: 'Alertas' },
                                                  { key: 'logs', label: 'Logs' }
                                                ].map(({ key, label }) => {
                                                  const val = user.permissions?.[key];
                                                  if (!val || val === 'none' || val === false) return null;
                                                  const isWrite = val === 'write';
                                                  return (
                                                    <Badge 
                                                      key={key} 
                                                      variant="outline" 
                                                      className={`text-[9px] ${
                                                        isWrite 
                                                          ? 'border-indigo-550/30 text-indigo-400 bg-indigo-500/5' 
                                                          : 'border-zinc-800 text-zinc-400 bg-transparent'
                                                      }`}
                                                    >
                                                      {label} {isWrite ? '(Modificar)' : '(Leitura)'}
                                                    </Badge>
                                                  );
                                                }).filter(Boolean);

                                                return renderedBadges.length > 0 ? renderedBadges : (
                                                  <span className="text-zinc-550 text-[11px]">Nenhum acesso</span>
                                                );
                                              })()}
                                            </>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-1.5">
                                          <Button
                                            onClick={() => handleOpenEditUser(user)}
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg"
                                            title="Editar permissões"
                                          >
                                            <Edit2 className="h-3.5 w-3.5" />
                                          </Button>
                                          {!isSelf && (
                                            <Button
                                              onClick={() => handleDeleteUser(user.email)}
                                              variant="ghost"
                                              size="icon"
                                              className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                                              title="Remover usuário"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </div>
                    )}
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
        <DialogContent className="max-w-md w-full bg-zinc-950 border border-zinc-800 text-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
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
                className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-550"
                required
              />
            </div>

            {/* Field: Category */}
            <div className="space-y-1.5">
              <Label htmlFor="serviceCategory" className="text-zinc-300 text-xs font-semibold">Categoria *</Label>
              <Select value={serviceFormCategory} onValueChange={(val) => setServiceFormCategory(val || '')}>
                <SelectTrigger id="serviceCategory" className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  {categoriesList.map((cat) => (
                    <SelectItem key={cat.id} value={cat.name} className="hover:bg-zinc-800">
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

      {/* NETWORK ALERT ADD/EDIT MODAL */}
      <Dialog open={isAlertModalOpen} onOpenChange={(open) => !open && setIsAlertModalOpen(false)}>
        <DialogContent className="max-w-md w-full bg-zinc-950 border border-zinc-800 text-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500 animate-pulse" />
              <span>{editingAlert ? 'Editar Alerta de Instabilidade' : 'Criar Alerta de Instabilidade'}</span>
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Publique avisos de problemas de infraestrutura ou instabilidades no site público para informar operadores e usuários.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAlert} className="space-y-4 mt-4">
            {/* Field: Title */}
            <div className="space-y-1.5">
              <Label htmlFor="alertTitle" className="text-zinc-300 text-xs font-semibold">Título do Alerta *</Label>
              <Input
                id="alertTitle"
                value={alertFormTitle}
                onChange={(e) => setAlertFormTitle(e.target.value)}
                placeholder="Ex: Instabilidade no Backbone, Falha Rota Sul"
                className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500"
                required
              />
            </div>

            {/* Field: Alert Type */}
            <div className="space-y-1.5">
              <Label htmlFor="alertType" className="text-zinc-300 text-xs font-semibold">Tipo do Alerta *</Label>
              <Select value={alertFormType} onValueChange={(val) => setAlertFormType(val || 'Instabilidade Geral')}>
                <SelectTrigger id="alertType" className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="Instabilidade Geral">Instabilidade Geral (🟡)</SelectItem>
                  <SelectItem value="Queda de Link / Fibra">Queda de Link / Fibra (🔴)</SelectItem>
                  <SelectItem value="Lentidão / Latência">Lentidão / Latência (🟡)</SelectItem>
                  <SelectItem value="Manutenção Programada">Manutenção Programada (🔵)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Field: Expiration Mode */}
            <div className="space-y-1.5">
              <Label htmlFor="expirationType" className="text-zinc-300 text-xs font-semibold">Tempo de Duração *</Label>
              <Select
                value={alertFormExpirationType}
                onValueChange={(val: any) => setAlertFormExpirationType(val || 'manual')}
              >
                <SelectTrigger id="expirationType" className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectValue placeholder="Selecione o modo de expiração" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="manual">Ativo até ser desativado manualmente</SelectItem>
                  <SelectItem value="scheduled">Definir data/hora de expiração programada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Scheduled Expiration datetime field (conditional) */}
            {alertFormExpirationType === 'scheduled' && (
              <div className="space-y-1.5">
                <Label htmlFor="expiresAt" className="text-zinc-300 text-xs font-semibold">Data e Hora de Expiração *</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={alertFormExpiresAt}
                  onChange={(e) => setAlertFormExpiresAt(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-white"
                  required
                />
              </div>
            )}

            {/* Field: Description */}
            <div className="space-y-1.5">
              <Label htmlFor="alertDescription" className="text-zinc-300 text-xs font-semibold">Descrição Informativa *</Label>
              <textarea
                id="alertDescription"
                value={alertFormDescription}
                onChange={(e) => setAlertFormDescription(e.target.value)}
                placeholder="Ex: Identificamos lentidão no carregamento de serviços devido ao rompimento de fibra na rota Porto Alegre..."
                className="w-full h-24 bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-550 rounded-md p-3 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAlertModalOpen(false)}
                className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 transition-all"
                disabled={isSavingAlert}
              >
                {isSavingAlert ? 'Salvando...' : 'Salvar Alerta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* USER MANAGEMENT ADD/EDIT MODAL */}
      <Dialog open={isUserModalOpen} onOpenChange={(open) => !open && setIsUserModalOpen(false)}>
        <DialogContent className="max-w-md w-full bg-zinc-950 border border-zinc-800 text-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-indigo-400" />
              <span>{editingUser ? 'Editar Permissões do Usuário' : 'Cadastrar Novo Administrador'}</span>
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Configure as credenciais e as permissões de acesso do operador no painel administrativo do Intradetector.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveUser} className="space-y-4 mt-4">
            {/* Field: Name */}
            <div className="space-y-1.5">
              <Label htmlFor="userName" className="text-zinc-300 text-xs font-semibold">Nome Completo *</Label>
              <Input
                id="userName"
                value={userFormName}
                onChange={(e) => setUserFormName(e.target.value)}
                placeholder="Ex: João Silva"
                className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-550 focus:border-indigo-500"
                required
              />
            </div>

            {/* Field: Email */}
            <div className="space-y-1.5">
              <Label htmlFor="userEmail" className="text-zinc-300 text-xs font-semibold">E-mail de Acesso *</Label>
              <Input
                id="userEmail"
                type="email"
                value={userFormEmail}
                onChange={(e) => setUserFormEmail(e.target.value)}
                placeholder="Ex: usuario@empresa.com"
                className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-550 focus:border-indigo-500"
                disabled={!!editingUser}
                required
              />
            </div>

            {/* Field: Password (only when creating) */}
            {!editingUser && (
              <div className="space-y-1.5">
                <Label htmlFor="userPassword" className="text-zinc-300 text-xs font-semibold">Senha Inicial *</Label>
                <Input
                  id="userPassword"
                  type="password"
                  value={userFormPassword}
                  onChange={(e) => setUserFormPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-550 focus:border-indigo-500"
                  required
                />
              </div>
            )}

            {/* Field: Role */}
            <div className="space-y-1.5">
              <Label htmlFor="userRole" className="text-zinc-300 text-xs font-semibold">Cargo de Acesso *</Label>
              <Select value={userFormRole} onValueChange={(val: any) => setUserFormRole(val || 'admin')}>
                <SelectTrigger id="userRole" className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                  <SelectItem value="superadmin">Superadmin (Acesso Total + Gravação)</SelectItem>
                  <SelectItem value="admin">Admin (Acesso Customizado + Apenas Leitura)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Field: Permissions (conditional) */}
            {userFormRole === 'admin' ? (
              <div className="space-y-3 p-3.5 bg-zinc-900/40 border border-zinc-900 rounded-xl">
                <Label className="text-zinc-300 text-xs font-semibold">Níveis de Acesso por Aba *</Label>
                
                <div className="space-y-2 pt-1">
                  {[
                    { key: 'cards', label: 'Gerenciamento de Cards' },
                    { key: 'form', label: 'Construtor de Formulários' },
                    { key: 'alerts', label: 'Gerenciar Alertas' },
                    { key: 'logs', label: 'Logs de Auditoria' },
                  ].map(({ key, label }) => {
                    const currentVal = userFormPermissions[key];
                    const selectValue = currentVal === 'write' ? 'write' : (currentVal === 'read' || currentVal === true ? 'read' : 'none');
                    return (
                      <div key={key} className="flex items-center justify-between py-1.5 border-b border-zinc-900/40 last:border-0 gap-4">
                        <Label htmlFor={`perm-${key}`} className="text-zinc-400 text-xs font-normal cursor-pointer select-none">{label}</Label>
                        <Select 
                          value={selectValue} 
                          onValueChange={(val) => setUserFormPermissions(prev => ({ ...prev, [key]: val as any }))}
                        >
                          <SelectTrigger id={`perm-${key}`} className="w-[160px] bg-zinc-900 border-zinc-850 text-white text-xs h-8 rounded-lg">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-850 text-white text-xs">
                            <SelectItem value="none">Sem Acesso</SelectItem>
                            <SelectItem value="read">Só Visualizar</SelectItem>
                            <SelectItem value="write">Modificar Configs</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-indigo-400 text-xs flex gap-2">
                <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Superadministradores têm permissão total de leitura e gravação em todas as funcionalidades automaticamente.</span>
              </div>
            )}

            {/* Modal Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800 mt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsUserModalOpen(false)}
                className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 transition-all"
                disabled={isSavingUser}
              >
                {isSavingUser ? 'Salvando...' : 'Salvar Usuário'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* CATEGORY MANAGEMENT MODAL */}
      <Dialog open={isCategoryModalOpen} onOpenChange={(open) => !open && setIsCategoryModalOpen(false)}>
        <DialogContent className="sm:max-w-4xl max-w-4xl w-full bg-zinc-950 border border-zinc-800 text-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-400" />
              <span>Gerenciamento de Categorias & Ícones</span>
            </DialogTitle>
            <DialogDescription className="text-zinc-400 text-xs">
              Crie novas categorias de serviços, escolha seus ícones representativos e gerencie as existentes. Os ícones serão propagados automaticamente para os cards.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
            {/* COLUMN 1: CATEGORY CREATION/EDITION FORM */}
            <div className="space-y-4 pr-0 md:pr-4 md:border-r border-zinc-900">
              <h3 className="text-sm font-semibold text-zinc-200 border-b border-zinc-900 pb-2 flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-indigo-400" />
                <span>{editingCategory ? 'Editar Categoria' : 'Cadastrar Nova Categoria'}</span>
              </h3>
              
              <form onSubmit={handleSaveCategory} className="space-y-4">
                {/* Field: Category Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="catName" className="text-zinc-300 text-xs font-semibold">Nome da Categoria *</Label>
                  <Input
                    id="catName"
                    value={categoryFormName}
                    onChange={(e) => setCategoryFormName(e.target.value)}
                    placeholder="Ex: Redes Sociais, Streaming, VPNs"
                    className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-550 focus:border-indigo-500 text-sm"
                    required
                  />
                </div>

                {/* Field: Category Icon Preset */}
                <div className="space-y-1.5">
                  <Label htmlFor="catIcon" className="text-zinc-300 text-xs font-semibold">Escolher Ícone *</Label>
                  <Select value={categoryFormIcon} onValueChange={(val) => setCategoryFormIcon(val || 'Globe')}>
                    <SelectTrigger id="catIcon" className="bg-zinc-900 border-zinc-800 text-white text-sm">
                      <SelectValue placeholder="Selecione o ícone" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white text-sm">
                      {COMMON_ICONS.map((icon) => (
                        <SelectItem key={icon.value} value={icon.value} className="hover:bg-zinc-800 cursor-pointer">
                          <div className="flex items-center gap-2">
                            {renderCategoryIcon(icon.value)}
                            <span>{icon.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                      <SelectItem value="custom" className="hover:bg-zinc-800 cursor-pointer text-indigo-400">
                        <div className="flex items-center gap-2 font-semibold">
                          <Plus className="h-3.5 w-3.5" />
                          <span>Personalizar Ícone (Lucide Name)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Field: Custom Icon Input (Conditional) */}
                {categoryFormIcon === 'custom' && (
                  <div className="space-y-1.5 animate-in fade-in-50 duration-200">
                    <Label htmlFor="catCustomIcon" className="text-zinc-300 text-xs font-semibold">Nome do Ícone Lucide *</Label>
                    <Input
                      id="catCustomIcon"
                      value={categoryFormCustomIcon}
                      onChange={(e) => setCategoryFormCustomIcon(e.target.value)}
                      placeholder="Ex: Server, Shield, Database, Laptop, Radio"
                      className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-550 focus:border-indigo-500 text-sm font-mono"
                      required
                    />
                    <p className="text-[10px] text-zinc-500 leading-normal">
                      Insira o nome exato da classe do ícone do <a href="https://lucide.dev/icons" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Lucide Icons</a> (ex: Server, Laptop, etc.).
                    </p>
                  </div>
                )}

                {/* Submit and Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-all py-2 h-9"
                    disabled={isSavingCategory}
                  >
                    {isSavingCategory ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Salvando...
                      </span>
                    ) : (
                      editingCategory ? 'Salvar Categoria' : 'Criar Categoria'
                    )}
                  </Button>
                  
                  {editingCategory && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingCategory(null);
                        setCategoryFormName('');
                        setCategoryFormIcon('Globe');
                        setCategoryFormCustomIcon('');
                      }}
                      className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs px-3 h-9"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </div>

            {/* COLUMN 2: ACTIVE CATEGORIES VIEW */}
            <div className="space-y-4 flex flex-col min-w-0">
              <h3 className="text-sm font-semibold text-zinc-200 border-b border-zinc-900 pb-2 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-indigo-400" />
                <span>Categorias Ativas ({categoriesList.length})</span>
              </h3>
              
              <div className="flex-1 max-h-[320px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                {categoriesList.length === 0 ? (
                  <div className="text-center py-12 text-zinc-550 text-xs">
                    Nenhuma categoria cadastrada. Adicione uma no formulário ao lado.
                  </div>
                ) : (
                  categoriesList.map((cat) => {
                    return (
                      <div 
                        key={cat.id} 
                        className="bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-900 hover:border-zinc-850 rounded-xl p-3 flex items-center justify-between transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="bg-zinc-950 border border-zinc-850 p-2 rounded-lg shrink-0">
                            {renderCategoryIcon(cat.icon_name)}
                          </div>
                          <div className="min-w-0 flex-1 pr-1.5">
                            <p className="text-sm font-bold text-white break-words leading-tight">{cat.name}</p>
                            <p className="text-[10px] text-zinc-500 font-mono truncate mt-0.5">{cat.icon_name}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            onClick={() => handleOpenEditCategory(cat)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-indigo-400 hover:text-indigo-350 hover:bg-indigo-500/10 rounded-lg"
                            title="Editar categoria"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteCategory(cat)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-400 hover:text-red-350 hover:bg-red-500/10 rounded-lg"
                            title="Excluir categoria"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-900/60 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCategoryModalOpen(false)}
              className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white font-medium text-xs px-6 py-2 rounded-xl"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
