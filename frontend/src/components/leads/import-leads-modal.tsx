'use client';

import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { useCreateBulkLeads } from '@/hooks/use-api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LeadSource, PropertyType } from '@/types';
import {
  Upload,
  Download,
  FileSpreadsheet,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from 'lucide-react';

interface ImportLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedLeadRow {
  name: string;
  phone: string;
  email?: string;
  source?: LeadSource;
  budget?: number;
  propertyType?: PropertyType;
  notes?: string;
  isValid: boolean;
  errorReason?: string;
}

const VALID_SOURCES = new Set([
  'WEBSITE',
  'REFERRAL',
  'SOCIAL_MEDIA',
  'COLD_CALL',
  'WALK_IN',
  'OTHER',
]);

const VALID_PROPERTY_TYPES = new Set([
  'APARTMENT',
  'VILLA',
  'PLOT',
  'COMMERCIAL',
  'PENTHOUSE',
]);

const HEADER_ALIASES: Record<string, string> = {
  name: 'name',
  fullname: 'name',
  'full name': 'name',
  leadname: 'name',
  'lead name': 'name',
  phone: 'phone',
  phonenumber: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  mobilenumber: 'phone',
  'mobile number': 'phone',
  contact: 'phone',
  email: 'email',
  'email address': 'email',
  'e-mail': 'email',
  source: 'source',
  leadsource: 'source',
  'lead source': 'source',
  budget: 'budget',
  propertytype: 'propertyType',
  'property type': 'propertyType',
  type: 'propertyType',
  notes: 'notes',
  note: 'notes',
  comments: 'notes',
  remark: 'notes',
  remarks: 'notes',
};

function normalizeHeader(header: string): string {
  const key = header.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const compact = key.replace(/\s/g, '');
  return HEADER_ALIASES[key] || HEADER_ALIASES[compact] || compact;
}

function mapSource(value?: string): LeadSource {
  if (!value) return 'OTHER';
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return (VALID_SOURCES.has(normalized) ? normalized : 'OTHER') as LeadSource;
}

function mapPropertyType(value?: string): PropertyType | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return VALID_PROPERTY_TYPES.has(normalized)
    ? (normalized as PropertyType)
    : undefined;
}

function cellToString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

export function ImportLeadsModal({ open, onOpenChange }: ImportLeadsModalProps) {
  const createBulkLeads = useCreateBulkLeads();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedLeadRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const downloadSampleExcel = () => {
    const sample = [
      {
        name: 'Rahul Verma',
        phone: '+91 98123 45678',
        email: 'rahul@example.com',
        source: 'WEBSITE',
        budget: 12000000,
        propertyType: 'APARTMENT',
        notes: 'Interested in 3BHK in Mumbai',
      },
      {
        name: 'Ananya Sen',
        phone: '+91 97654 32100',
        email: 'ananya@example.com',
        source: 'REFERRAL',
        budget: 20000000,
        propertyType: 'VILLA',
        notes: 'Looking for luxury villa',
      },
      {
        name: 'Karan Mehta',
        phone: '+91 96543 21099',
        email: 'karan@example.com',
        source: 'SOCIAL_MEDIA',
        budget: 8500000,
        propertyType: 'APARTMENT',
        notes: 'Ready for site visit',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sample);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');
    XLSX.writeFile(workbook, 'sample_leads.xlsx');
  };

  const rowsFromSheet = (sheet: XLSX.WorkSheet): ParsedLeadRow[] => {
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
    });

    if (rawRows.length === 0) {
      throw new Error('The file does not contain any lead rows.');
    }

    const firstRowKeys = Object.keys(rawRows[0] || {});
    const mappedHeaders = firstRowKeys.map(normalizeHeader);
    if (!mappedHeaders.includes('name') || !mappedHeaders.includes('phone')) {
      throw new Error('File must include "name" and "phone" columns.');
    }

    return rawRows.map((raw) => {
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw)) {
        const mapped = normalizeHeader(key);
        if (mapped) normalized[mapped] = cellToString(value);
      }

      const rowName = normalized.name || '';
      const rowPhone = normalized.phone || '';
      const isValid = Boolean(rowName && rowPhone);
      let errorReason = '';
      if (!rowName) errorReason = 'Missing name';
      else if (!rowPhone) errorReason = 'Missing phone';

      const budgetValue = normalized.budget
        ? Number(String(normalized.budget).replace(/[,₹$\s]/g, ''))
        : undefined;

      return {
        name: rowName,
        phone: rowPhone,
        email: normalized.email || undefined,
        source: mapSource(normalized.source),
        budget:
          budgetValue !== undefined && !Number.isNaN(budgetValue)
            ? budgetValue
            : undefined,
        propertyType: mapPropertyType(normalized.propertyType),
        notes: normalized.notes || undefined,
        isValid,
        errorReason,
      };
    });
  };

  const parseFile = useCallback((file: File) => {
    const lowerName = file.name.toLowerCase();
    const isExcel =
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.csv');

    if (!isExcel) {
      setParseError('Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      setParsedRows([]);
      setFileName('');
      return;
    }

    setFileName(file.name);
    setParseError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) {
          setParseError('The selected file is empty.');
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setParseError('No sheet found in the Excel file.');
          return;
        }

        const sheet = workbook.Sheets[firstSheetName];
        const rows = rowsFromSheet(sheet);
        setParsedRows(rows);
      } catch (err) {
        setParsedRows([]);
        setParseError(
          err instanceof Error ? err.message : 'Failed to parse the uploaded file.',
        );
      }
    };

    reader.onerror = () => {
      setParseError('Failed to read the selected file.');
    };

    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const validRows = parsedRows.filter((r) => r.isValid);

  const handleUploadSubmit = async () => {
    if (validRows.length === 0) return;

    try {
      const payload = validRows.map(({ isValid: _isValid, errorReason: _error, ...lead }) => lead);
      await createBulkLeads.mutateAsync(payload);
      resetState();
      onOpenChange(false);
    } catch {
      // Error shown below via mutation state
    }
  };

  const resetState = () => {
    setFileName('');
    setParsedRows([]);
    setParseError('');
    setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetState();
        onOpenChange(val);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Import Excel Leads
          </DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to import leads in bulk for your AI calling agent.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <FileSpreadsheet className="h-5 w-5 shrink-0 text-blue-600" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Need a template?</p>
                <p className="text-xs text-muted-foreground">
                  Columns: name, phone, email, source, budget, propertyType, notes
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadSampleExcel} className="shrink-0">
              <Download className="mr-2 h-4 w-4" />
              Sample Excel
            </Button>
          </div>

          {parsedRows.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium text-sm">
                Click to select or drag and drop your file
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .xlsx, .xls, and .csv
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-600" />
                  <span className="font-medium text-sm truncate">{fileName}</span>
                  <Badge variant="outline" className="ml-1 shrink-0">
                    {validRows.length} valid lead{validRows.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={resetState}>
                  <Trash2 className="h-4 w-4 text-destructive mr-1" />
                  Clear File
                </Button>
              </div>

              <div className="rounded-lg border max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium">Phone</th>
                      <th className="px-3 py-2 text-left font-medium">Email</th>
                      <th className="px-3 py-2 text-left font-medium">Source</th>
                      <th className="px-3 py-2 text-left font-medium">Budget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-3 py-2">
                          {row.isValid ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 flex items-center w-fit gap-1 text-[10px]">
                              <CheckCircle2 className="h-3 w-3" /> Valid
                            </Badge>
                          ) : (
                            <Badge
                              variant="destructive"
                              className="flex items-center w-fit gap-1 text-[10px]"
                            >
                              <AlertCircle className="h-3 w-3" /> {row.errorReason}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium">{row.name || '—'}</td>
                        <td className="px-3 py-2">{row.phone || '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.email || '—'}
                        </td>
                        <td className="px-3 py-2">{row.source}</td>
                        <td className="px-3 py-2">
                          {row.budget ? `₹${row.budget.toLocaleString()}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parseError && (
            <p className="text-sm font-medium text-destructive">{parseError}</p>
          )}
          {createBulkLeads.isError && (
            <p className="text-sm font-medium text-destructive">
              {(createBulkLeads.error as Error)?.message || 'Failed to import leads.'}
            </p>
          )}
        </div>

        <DialogFooter className="pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createBulkLeads.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUploadSubmit}
            disabled={validRows.length === 0 || createBulkLeads.isPending}
          >
            {createBulkLeads.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Upload {validRows.length > 0 ? `${validRows.length} Leads` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
