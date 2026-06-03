'use client';

import React, { useState, useEffect, useRef } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { Service, FormSchema } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { toast } from 'sonner';
import { Loader2, ChevronsUpDown, Check, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: Service | null;
  schema: FormSchema;
  onSuccess: () => void;
  activeAlert?: any | null;
  services: Service[];
  showRelatedServices?: boolean;
}

// Searchable combobox sub-component
function SearchableSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  id: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <div
          id={id}
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full flex items-center justify-between bg-zinc-900 border border-zinc-800 text-left font-normal h-10 px-3 rounded-md cursor-pointer hover:border-zinc-700 transition-colors',
            value ? 'text-white' : 'text-zinc-500'
          )}
        >
          <span className="truncate text-sm">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-zinc-400" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 bg-zinc-900 border-zinc-800 w-[var(--radix-popover-trigger-width)]"
        align="start"
        sideOffset={4}
      >
        <Command className="bg-zinc-900">
          <CommandInput
            placeholder="Pesquisar..."
            className="text-white placeholder-zinc-500 border-b border-zinc-800"
          />
          <CommandList className="max-h-56 overflow-y-auto">
            <CommandEmpty className="py-4 text-center text-sm text-zinc-500">
              Nenhuma opção encontrada.
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt === value ? '' : opt);
                    setOpen(false);
                  }}
                  className="text-zinc-300 hover:bg-zinc-800 aria-selected:bg-zinc-800 cursor-pointer whitespace-normal py-2"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4 shrink-0',
                      value === opt ? 'opacity-100 text-indigo-400' : 'opacity-0'
                    )}
                  />
                  <span className="whitespace-normal leading-snug">{opt}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function ReportModal({
  isOpen,
  onClose,
  service,
  schema,
  onSuccess,
  activeAlert,
  services,
  showRelatedServices = true,
}: ReportModalProps) {
  const supabase = getSupabaseClient();
  const [dynamicData, setDynamicData] = useState<Record<string, string>>({});
  const [isResolved, setIsResolved] = useState<string>('false');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [relatedServiceIds, setRelatedServiceIds] = useState<string[]>([]);
  const [relatedSearch, setRelatedSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Reset form when modal opens or service changes
  useEffect(() => {
    if (isOpen) {
      setDynamicData({});
      setIsResolved('false');
      setRelatedServiceIds([]);
      setRelatedSearch('');
      setIsDropdownOpen(false);
    }
  }, [isOpen, service]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const availableServices = (services || []).filter(s => s.id !== service?.id);
  const filteredServices = availableServices.filter(s =>
    s.name.toLowerCase().includes(relatedSearch.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!service) return;

    // Validate required fields
    for (const field of schema) {
      if (field.required && !dynamicData[field.id]) {
        toast.error(`Por favor, preencha o campo: ${field.label}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Manage visitor session ID in sessionStorage
      let visitorSessionId = sessionStorage.getItem('visitor_session_id');
      if (!visitorSessionId) {
        visitorSessionId = crypto.randomUUID();
        sessionStorage.setItem('visitor_session_id', visitorSessionId);
      }

      const customFieldsWithAlert: Record<string, any> = {
        ...dynamicData,
        visitor_session_id: visitorSessionId,
      };

      if (activeAlert) {
        customFieldsWithAlert.active_alert = activeAlert.title;
      }

      // Enviar relato do serviço principal
      const mainReport = {
        service_id: service.id,
        region: dynamicData['region'] || null,
        connection_type: dynamicData['connection_type'] || null,
        issue_type: dynamicData['issue_type'] || null,
        device: dynamicData['device'] || null,
        custom_fields: customFieldsWithAlert,
        tests_done: null,
        is_resolved: isResolved === 'true',
      };

      const { error: mainError } = await supabase.from('reports').insert(mainReport);
      if (mainError) throw mainError;

      // Enviar relatos dos serviços relacionados sequencialmente com um atraso de 200ms
      for (const id of relatedServiceIds) {
        // Aguarda 200ms antes do próximo envio
        await new Promise(resolve => setTimeout(resolve, 200));

        const relatedReport = {
          service_id: id,
          region: dynamicData['region'] || null,
          connection_type: dynamicData['connection_type'] || null,
          issue_type: dynamicData['issue_type'] || null,
          device: dynamicData['device'] || null,
          custom_fields: customFieldsWithAlert,
          tests_done: null,
          is_resolved: isResolved === 'true',
        };

        const { error: relatedError } = await supabase.from('reports').insert(relatedReport);
        if (relatedError) throw relatedError;
      }

      if (relatedServiceIds.length > 0) {
        toast.success(`Relato para ${service.name} e outros ${relatedServiceIds.length} serviços enviado com sucesso!`);
      } else {
        toast.success(`Relato para ${service.name} enviado com sucesso!`);
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao enviar relato:', error);
      toast.error(`Falha ao enviar relato: ${error.message || 'Erro de conexão'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full bg-zinc-950 border border-zinc-800 text-white rounded-2xl shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <span>Relatar Instabilidade</span>
            {service && (
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                {service.name}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-sm">
            Selecione as informações técnicas da instabilidade para nos ajudar a identificar o problema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {schema.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label htmlFor={field.id} className="text-zinc-300 text-xs font-semibold">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </Label>
              {field.type === 'select' ? (
                <SearchableSelect
                  id={field.id}
                  value={dynamicData[field.id] || ''}
                  onChange={(val) => setDynamicData((prev) => ({ ...prev, [field.id]: val }))}
                  options={field.options || []}
                  placeholder="Pesquise ou selecione..."
                  required={field.required}
                />
              ) : (
                <Input
                  id={field.id}
                  value={dynamicData[field.id] || ''}
                  onChange={(e) => setDynamicData((prev) => ({ ...prev, [field.id]: e.target.value }))}
                  required={field.required}
                  className="bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500"
                  placeholder="Digite aqui..."
                />
              )}
            </div>
          ))}

          {/* O problema foi resolvido? */}
          <div className="space-y-2 pt-1">
            <Label className="text-zinc-300 text-xs font-semibold block">O problema foi resolvido?</Label>
            <div className="flex gap-3">
              {[
                { value: 'false', label: 'Não, ainda persiste' },
                { value: 'true', label: 'Sim, foi resolvido' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setIsResolved(opt.value)}
                  className={cn(
                    'flex-1 py-2 px-3 rounded-xl text-xs font-semibold border transition-all',
                    isResolved === opt.value
                      ? opt.value === 'false'
                        ? 'bg-red-500/10 border-red-500/40 text-red-400'
                        : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Relacionar com outros serviços (Opcional) */}
          {showRelatedServices && (
            <div className="space-y-2 pt-3.5 border-t border-zinc-900">
              <Label className="text-zinc-300 text-xs font-semibold block">Relacionar com outros serviços afetados? (Opcional)</Label>
              
              {/* Selected items tags */}
              {relatedServiceIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2 max-h-24 overflow-y-auto p-2 bg-zinc-900/35 border border-zinc-900 rounded-lg">
                  {relatedServiceIds.map(id => {
                    const s = services.find(srv => srv.id === id);
                    if (!s) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[11px] font-semibold">
                        {s.name}
                        <button
                          type="button"
                          onClick={() => setRelatedServiceIds(prev => prev.filter(item => item !== id))}
                          className="hover:text-indigo-200 transition-colors cursor-pointer ml-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Combobox Search */}
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Pesquisar outros serviços afetados..."
                    value={relatedSearch}
                    onChange={(e) => {
                      setRelatedSearch(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-555 rounded-md h-9 pl-9 pr-8 text-xs focus:outline-none focus:border-zinc-700 transition-all"
                  />
                  {relatedSearch && (
                    <button
                      type="button"
                      onClick={() => setRelatedSearch('')}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-md shadow-2xl z-50 py-1 text-xs">
                    {filteredServices.length === 0 ? (
                      <div className="py-2.5 text-center text-zinc-500">Nenhum outro serviço encontrado.</div>
                    ) : (
                      filteredServices.map(s => {
                        const isSelected = relatedServiceIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setRelatedServiceIds(prev => prev.filter(id => id !== s.id));
                              } else {
                                setRelatedServiceIds(prev => [...prev, s.id]);
                              }
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2 flex items-center justify-between transition-colors hover:bg-zinc-850",
                              isSelected ? "text-indigo-400 bg-zinc-850/50" : "text-zinc-300"
                            )}
                          >
                            <span>{s.name}</span>
                            {isSelected && <Check className="h-3.5 w-3.5" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 transition-all"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Enviando...
                </span>
              ) : (
                'Enviar Relato'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
