import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Search, Loader2, Edit } from "lucide-react";
import { toast } from "sonner";

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Education", "Manufacturing",
  "Retail", "Consulting", "Real Estate", "Media", "Other",
];

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  is_active: boolean;
  created_at: string;
  memberCount: number;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function useAllOrgs() {
  return useQuery({
    queryKey: ["platform-all-orgs"],
    queryFn: async () => {
      const [orgsRes, membersRes] = await Promise.all([
        supabase.from("organizations" as never)
          .select("id, name, slug, industry, is_active, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("org_memberships" as never)
          .select("org_id, is_active"),
      ]);
      const orgs = (orgsRes.data ?? []) as Omit<OrgRow, "memberCount">[];
      const members = (membersRes.data ?? []) as { org_id: string; is_active: boolean }[];
      const memberMap = new Map<string, number>();
      for (const m of members.filter((x) => x.is_active)) {
        memberMap.set(m.org_id, (memberMap.get(m.org_id) ?? 0) + 1);
      }
      return orgs.map((o): OrgRow => ({ ...o, memberCount: memberMap.get(o.id) ?? 0 }));
    },
  });
}

export default function PlatformOrgs() {
  const { user } = useAuth();
  const { data: orgs, isLoading } = useAllOrgs();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<OrgRow | null>(null);

  const filtered = (orgs ?? []).filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleToggle = async (org: OrgRow) => {
    const { error } = await supabase
      .from("organizations" as never)
      .update({ is_active: !org.is_active })
      .eq("id", org.id);
    if (error) toast.error("Failed to update");
    else {
      toast.success(org.is_active ? "Deactivated" : "Activated");
      qc.invalidateQueries({ queryKey: ["platform-all-orgs"] });
      qc.invalidateQueries({ queryKey: ["platform-stats"] });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-6 w-6" /> Organisations
          </h1>
          <p className="text-muted-foreground text-sm">Create and manage all tenant organisations</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Organisation
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search organisations…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <span className="text-sm text-muted-foreground">{filtered.length} orgs</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{org.industry ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{org.slug}</TableCell>
                    <TableCell className="text-right">{org.memberCount}</TableCell>
                    <TableCell>
                      <Badge variant={org.is_active ? "default" : "outline"}>
                        {org.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditOrg(org)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Switch checked={org.is_active} onCheckedChange={() => handleToggle(org)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      No organisations found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <OrgFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        createdBy={user?.id ?? ""}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["platform-all-orgs"] });
          qc.invalidateQueries({ queryKey: ["platform-stats"] });
          qc.invalidateQueries({ queryKey: ["platform-orgs"] });
        }}
      />
      {editOrg && (
        <OrgFormDialog
          open={!!editOrg}
          onOpenChange={(o) => { if (!o) setEditOrg(null); }}
          mode="edit"
          org={editOrg}
          createdBy={user?.id ?? ""}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["platform-all-orgs"] });
            setEditOrg(null);
          }}
        />
      )}
    </div>
  );
}

// ── OrgFormDialog ─────────────────────────────────────────────────────────────

interface OrgFormDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  org?: OrgRow;
  createdBy: string;
  onSuccess: () => void;
}

function OrgFormDialog({ open, onOpenChange, mode, org, createdBy, onSuccess }: OrgFormDialogProps) {
  const [name, setName] = useState(org?.name ?? "");
  const [industry, setIndustry] = useState(org?.industry ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    try {
      if (mode === "create") {
        const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);
        const { error } = await supabase
          .from("organizations" as never)
          .insert({ name: name.trim(), slug, industry: industry || null, created_by: createdBy });
        if (error) throw error;
        toast.success("Organisation created!");
      } else if (org) {
        const { error } = await supabase
          .from("organizations" as never)
          .update({ name: name.trim(), industry: industry || null })
          .eq("id", org.id);
        if (error) throw error;
        toast.success("Organisation updated!");
      }
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Organisation" : "Edit Organisation"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
