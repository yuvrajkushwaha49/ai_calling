'use client';

import { useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, Upload, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageLoader, EmptyState } from '@/components/common/loading';
import { ErrorMessage } from '@/components/common/error-message';
import {
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from '@/hooks/use-api';
import { projectSchema, type ProjectFormData } from '@/lib/validations';
import { formatCurrency, formatDate } from '@/lib/utils';
import { PROPERTY_TYPE_LABELS } from '@/lib/constants';
import type { Project } from '@/types';
import { useAuthStore } from '@/stores/auth-store';
import { knowledgeService } from '@/services';
import { useRouter } from 'next/navigation';

export default function ProjectsPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProjectId, setUploadProjectId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const { data: projects, isLoading, isError, error } = useProjects();
  const { data: projectDetail } = useProject(detailId || '');
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      propertyType: 'APARTMENT',
    },
  });

  const startPdfUpload = (projectId: string) => {
    setUploadProjectId(projectId);
    setUploadMsg('');
    fileInputRef.current?.click();
  };

  const handlePdfSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadProjectId || !token) return;
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setUploadMsg('Please select a PDF file.');
      return;
    }
    setUploading(true);
    setUploadMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('projectId', uploadProjectId);
      fd.append('title', file.name);
      fd.append('sourceType', 'PDF');
      await knowledgeService.upload(token, fd);
      const projectName =
        projects?.find((p) => p.id === uploadProjectId)?.name || 'this project';
      setUploadMsg(`PDF uploaded for ${projectName}. Open Knowledge Base to review.`);
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProjectId(null);
    }
  };

  const openCreate = () => {
    setEditingProject(null);
    form.reset({ propertyType: 'APARTMENT' });
    setDialogOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditingProject(project);
    form.reset({
      name: project.name,
      companyName: project.companyName || '',
      location: project.location,
      builder: project.builder,
      propertyType: project.propertyType,
      startingPrice: Number(project.startingPrice),
      endingPrice: Number(project.endingPrice),
      possessionDate: project.possessionDate?.split('T')[0] || '',
      reraNumber: project.reraNumber || '',
      amenities: project.amenities?.join(', ') || '',
      description: project.description || '',
      websiteUrl: project.websiteUrl || '',
    });
    setDialogOpen(true);
  };

  const onSubmit = async (data: ProjectFormData) => {
    const payload = {
      ...data,
      companyName: data.companyName || '',
      websiteUrl: data.websiteUrl || '',
      amenities: data.amenities
        ? data.amenities.split(',').map((a) => a.trim()).filter(Boolean)
        : [],
    };
    if (editingProject) {
      await updateProject.mutateAsync({ id: editingProject.id, data: payload });
    } else {
      await createProject.mutateAsync(payload);
    }
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject.mutateAsync(id);
    }
  };

  return (
    <DashboardLayout title="Projects">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => void handlePdfSelected(e)}
      />
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={openCreate} className="bg-gradient-to-r from-blue-600 to-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Create Project
          </Button>
        </div>

        {uploading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading PDF for this project…
          </p>
        )}
        {uploadMsg && (
          <p className="text-sm text-green-700 dark:text-green-400">{uploadMsg}</p>
        )}

        {isLoading && <PageLoader />}
        {isError && <ErrorMessage message={(error as Error).message} />}

        {projects && projects.length === 0 && (
          <EmptyState
            title="No projects yet"
            description="Create your first real estate project to get started."
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            }
          />
        )}

        {projects && projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{project.name}</h3>
                    <p className="text-sm text-muted-foreground">{project.location}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {PROPERTY_TYPE_LABELS[project.propertyType]}
                  </span>
                </div>
                <div className="mt-4 space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Builder:</span> {project.builder}</p>
                  <p>
                    <span className="text-muted-foreground">Price:</span>{' '}
                    {formatCurrency(Number(project.startingPrice))} – {formatCurrency(Number(project.endingPrice))}
                  </p>
                  {project.reraNumber && (
                    <p><span className="text-muted-foreground">RERA:</span> {project.reraNumber}</p>
                  )}
                  <p>
                    <span className="text-muted-foreground">Leads:</span>{' '}
                    {project._count?.leads ?? 0}
                  </p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDetailId(project.id)}>
                    <Eye className="mr-1 h-3 w-3" />
                    View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => startPdfUpload(project.id)}
                  >
                    <Upload className="mr-1 h-3 w-3" />
                    Upload PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/knowledge?projectId=${project.id}`)}
                  >
                    Docs
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(project)}>
                    <Pencil className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(project.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Create Project'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Project Name</Label>
                <Input {...form.register('name')} />
              </div>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input {...form.register('companyName')} placeholder="Used in AI call intro" />
              </div>
              <div className="space-y-2">
                <Label>Website URL</Label>
                <Input
                  {...form.register('websiteUrl')}
                  placeholder="https://example.com/project"
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input {...form.register('location')} />
              </div>
              <div className="space-y-2">
                <Label>Builder</Label>
                <Input {...form.register('builder')} />
              </div>
              <div className="space-y-2">
                <Label>Property Type</Label>
                <Select
                  value={form.watch('propertyType')}
                  onValueChange={(v) => form.setValue('propertyType', v as ProjectFormData['propertyType'])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Starting Price</Label>
                <Input type="number" {...form.register('startingPrice')} />
              </div>
              <div className="space-y-2">
                <Label>Maximum Price</Label>
                <Input type="number" {...form.register('endingPrice')} />
              </div>
              <div className="space-y-2">
                <Label>Possession Date</Label>
                <Input type="date" {...form.register('possessionDate')} />
              </div>
              <div className="space-y-2">
                <Label>RERA Number</Label>
                <Input {...form.register('reraNumber')} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Amenities (comma separated)</Label>
                <Input {...form.register('amenities')} placeholder="Pool, Gym, Clubhouse" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea {...form.register('description')} rows={3} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={createProject.isPending || updateProject.isPending}>
              {editingProject ? 'Update Project' : 'Create Project'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {projectDetail && (
            <>
              <DialogHeader>
                <DialogTitle>{projectDetail.name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 text-sm">
                  <p><span className="text-muted-foreground">Location:</span> {projectDetail.location}</p>
                  <p><span className="text-muted-foreground">Builder:</span> {projectDetail.builder}</p>
                  {projectDetail.companyName && (
                    <p><span className="text-muted-foreground">Company:</span> {projectDetail.companyName}</p>
                  )}
                  {projectDetail.websiteUrl && (
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Website:</span>{' '}
                      <a
                        href={projectDetail.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        {projectDetail.websiteUrl}
                      </a>
                    </p>
                  )}
                  <p><span className="text-muted-foreground">Type:</span> {PROPERTY_TYPE_LABELS[projectDetail.propertyType]}</p>
                  <p>
                    <span className="text-muted-foreground">Price Range:</span>{' '}
                    {formatCurrency(Number(projectDetail.startingPrice))} – {formatCurrency(Number(projectDetail.endingPrice))}
                  </p>
                  {projectDetail.possessionDate && (
                    <p><span className="text-muted-foreground">Possession:</span> {formatDate(projectDetail.possessionDate)}</p>
                  )}
                  {projectDetail.reraNumber && (
                    <p><span className="text-muted-foreground">RERA:</span> {projectDetail.reraNumber}</p>
                  )}
                </div>
                {projectDetail.description && (
                  <p className="text-sm">{projectDetail.description}</p>
                )}
                {projectDetail.amenities?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {projectDetail.amenities.map((a) => (
                      <span key={a} className="rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                <div>
                  <h4 className="mb-2 font-semibold">Recent Leads ({projectDetail._count?.leads ?? 0})</h4>
                  {projectDetail.leads?.map((lead) => (
                    <div key={lead.id} className="border-b py-2 text-sm last:border-0">
                      {lead.name} · {lead.phone}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
