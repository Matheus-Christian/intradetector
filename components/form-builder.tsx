import React, { useState } from 'react';
import { FormField, FormSchema } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface FormBuilderProps {
  schema: FormSchema;
  onChange: (schema: FormSchema) => void;
}

export default function FormBuilder({ schema, onChange }: FormBuilderProps) {
  const handleAddField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      label: 'Novo Campo',
      type: 'select',
      required: true,
      options: ['Opção 1', 'Opção 2'],
    };
    onChange([...schema, newField]);
  };

  const handleUpdateField = (index: number, updates: Partial<FormField>) => {
    const newSchema = [...schema];
    newSchema[index] = { ...newSchema[index], ...updates };
    onChange(newSchema);
  };

  const handleDeleteField = (index: number) => {
    const newSchema = [...schema];
    newSchema.splice(index, 1);
    onChange(newSchema);
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === schema.length - 1) return;

    const newSchema = [...schema];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newSchema[index];
    newSchema[index] = newSchema[targetIndex];
    newSchema[targetIndex] = temp;
    onChange(newSchema);
  };

  return (
    <div className="space-y-6">
      {schema.map((field, index) => (
        <div key={field.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs font-semibold">Título do Campo</Label>
                <Input
                  value={field.label}
                  onChange={(e) => handleUpdateField(index, { label: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 text-white"
                  placeholder="Ex: Região Afetada"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300 text-xs font-semibold">Tipo de Resposta</Label>
                <Select
                  value={field.type}
                  onValueChange={(val: any) => handleUpdateField(index, { type: val as 'select' | 'text' })}
                >
                  <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="select">Múltipla Escolha (Lista)</SelectItem>
                    <SelectItem value="text">Resposta em Texto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0">
              <div className="flex items-center gap-2 mr-2">
                <Label className="text-zinc-300 text-xs font-semibold cursor-pointer" htmlFor={`req-${field.id}`}>Obrigatório</Label>
                <Switch
                  id={`req-${field.id}`}
                  checked={field.required}
                  onCheckedChange={(checked) => handleUpdateField(index, { required: checked })}
                />
              </div>

              <div className="flex gap-1 border-x border-zinc-800 px-2 mr-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={() => handleMoveField(index, 'up')} disabled={index === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400" onClick={() => handleMoveField(index, 'down')} disabled={index === schema.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => handleDeleteField(index)}
                title="Excluir Campo"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {field.type === 'select' && (
            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
              <Label className="text-zinc-300 text-xs font-semibold">Opções (uma por linha)</Label>
              <textarea
                rows={4}
                value={(field.options || []).join('\n')}
                onChange={(e) => {
                  // Split by newline but keep empty lines while typing
                  const opts = e.target.value.split('\n');
                  handleUpdateField(index, { options: opts });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation(); // Prevent form submit on Enter
                  }
                }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all placeholder-zinc-650"
                placeholder="Ex: São Paulo (SP)&#10;Rio de Janeiro (RJ)"
              />
            </div>
          )}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={handleAddField}
        className="w-full border-dashed border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-xl py-6 gap-2"
      >
        <Plus className="h-4 w-4" />
        Adicionar Novo Campo
      </Button>
    </div>
  );
}
