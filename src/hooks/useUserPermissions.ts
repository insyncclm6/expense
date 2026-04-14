import { useState, useEffect } from "react";
import { getRolePermissions, type Permissions } from "@/lib/rolePermissions";
import { supabase } from "@/integrations/supabase/client";

export function useUserPermissions(): {
  permissions: Permissions;
  userRoles: string[];
  userId: string | undefined;
  isLoading: boolean;
} {
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | undefined>();
  const [hasSubordinates, setHasSubordinates] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.id) {
        setUserId(session.user.id);

        const [rolesRes, subsRes] = await Promise.all([
          supabase
            .from("user_roles" as never)
            .select("role")
            .eq("user_id", session.user.id),
          supabase
            .from("profiles" as never)
            .select("id", { count: "exact", head: true })
            .eq("reports_to", session.user.id),
        ]);

        setUserRoles((rolesRes.data ?? []).map((r: { role: string }) => r.role));
        setHasSubordinates((subsRes.count ?? 0) > 0);
      }
      setIsLoading(false);
    };

    load();
  }, []);

  const permissions = getRolePermissions(userRoles, hasSubordinates);
  return { permissions, userRoles, userId, isLoading };
}
