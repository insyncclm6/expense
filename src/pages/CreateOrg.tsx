import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Receipt, Loader2 } from "lucide-react";
import { toast } from "sonner";

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Education", "Manufacturing",
  "Retail", "Consulting", "Real Estate", "Media", "Other",
];

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CreateOrg() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshOrgs } = useOrg();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Organisation name is required"); return; }
    if (!user) return;

    setSaving(true);
    try {
      const slug = slugify(name) + "-" + Math.random().toString(36).slice(2, 6);

      // Create the org
      const { data: org, error: orgErr } = await supabase
        .from("organizations" as never)
        .insert({
          name: name.trim(),
          slug,
          industry: industry || null,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (orgErr) throw orgErr;

      const orgId = (org as { id: string }).id;

      // Add creator as org admin
      const { error: memErr } = await supabase
        .from("org_memberships" as never)
        .insert({
          org_id: orgId,
          user_id: user.id,
          role: "admin",
        });
      if (memErr) throw memErr;

      await refreshOrgs();
      toast.success(`"${name}" created! Welcome aboard.`);
      navigate("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create organisation");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2">
          <div className="p-2 bg-primary rounded-lg">
            <Receipt className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">Expense Claims</span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Create your organisation</CardTitle>
            <CardDescription>
              Set up your company workspace. You'll be the admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Organisation Name *</Label>
              <Input
                placeholder="Acme Corp"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Create Organisation
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an invite? Ask your admin to add you.
        </p>
      </div>
    </div>
  );
}
