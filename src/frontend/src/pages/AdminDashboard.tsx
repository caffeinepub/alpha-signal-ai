import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActor } from "@/hooks/useActor";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Ban,
  ExternalLink,
  Loader2,
  Shield,
  UserX,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";

function formatDate(nanoseconds: bigint): string {
  const ms = Number(nanoseconds / BigInt(1_000_000));
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminDashboard() {
  const { actor } = useActor();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => actor!.getAllUsers(),
    enabled: !!actor,
  });

  const { data: activeSessions = BigInt(0) } = useQuery({
    queryKey: ["admin-sessions"],
    queryFn: () => actor!.getActiveSessions(),
    enabled: !!actor,
    refetchInterval: 30_000,
  });

  const { data: affiliateClicks = [] } = useQuery({
    queryKey: ["admin-affiliate-clicks"],
    queryFn: () => actor!.getAffiliateClicks(),
    enabled: !!actor,
    refetchInterval: 30_000,
  });

  // Aggregate clicks by exchange
  const clicksByExchange = affiliateClicks.reduce(
    (acc, click) => {
      acc[click.exchange] = (acc[click.exchange] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const banMutation = useMutation({
    mutationFn: (userId: bigint) => actor!.banUser(userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const bannedCount = users.filter((u) => u.isBanned).length;
  const activeCount = users.filter((u) => !u.isBanned).length;

  const stats = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      color: "text-primary",
    },
    {
      label: "Active Sessions",
      value: Number(activeSessions),
      icon: Activity,
      color: "text-bull",
    },
    {
      label: "Admin Users",
      value: adminCount,
      icon: Shield,
      color: "text-hold",
    },
    {
      label: "Banned Users",
      value: bannedCount,
      icon: UserX,
      color: "text-bear",
    },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-hold" />
            Admin Dashboard
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Logged in as{" "}
            <span className="text-foreground font-medium">{user?.name}</span>
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-bull/40 text-bull bg-bull/10 font-mono text-[10px] gap-1"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bull opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-bull" />
          </span>
          {Number(activeSessions)} Active Sessions
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07, duration: 0.3 }}
            className="trading-card p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
                {stat.label}
              </span>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className={`text-2xl font-black font-mono ${stat.color}`}>
              {stat.value}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="trading-card overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-wide">
              Registered Users
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {activeCount} active · {bannedCount} banned
          </span>
        </div>

        {usersLoading ? (
          <div
            data-ocid="admin.users.loading_state"
            className="flex items-center justify-center py-12"
          >
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : users.length === 0 ? (
          <div
            data-ocid="admin.users.empty_state"
            className="flex flex-col items-center justify-center py-12 text-muted-foreground"
          >
            <Users className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">No users registered yet</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table data-ocid="admin.users.table">
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  {[
                    "Name",
                    "Email",
                    "Phone",
                    "Role",
                    "Joined",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <TableHead
                      key={h}
                      className="text-[10px] font-bold font-mono text-muted-foreground/60 uppercase tracking-widest"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u, idx) => (
                  <TableRow
                    key={u.id.toString()}
                    data-ocid={`admin.users.item.${idx + 1}`}
                    className="border-border/10 hover:bg-white/[0.025] transition-colors"
                  >
                    <TableCell className="text-xs font-medium text-foreground py-3">
                      {u.name}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground py-3">
                      {u.email || "—"}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground py-3">
                      {u.phone || "—"}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className={`text-[9px] font-bold font-mono ${
                          u.role === "admin"
                            ? "border-hold/40 text-hold bg-hold/10"
                            : "border-primary/30 text-primary bg-primary/10"
                        }`}
                      >
                        {u.role.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[10px] font-mono text-muted-foreground py-3">
                      {formatDate(u.createdAt)}
                    </TableCell>
                    <TableCell className="py-3">
                      {u.isBanned ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-bear/20 text-bear border border-bear/30">
                          <Ban className="w-2.5 h-2.5" /> BANNED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-bull/20 text-bull border border-bull/30">
                          <Zap className="w-2.5 h-2.5" /> ACTIVE
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      {!u.isBanned && u.role !== "admin" && (
                        <Button
                          size="sm"
                          variant="outline"
                          data-ocid={`admin.ban_button.${idx + 1}`}
                          disabled={banMutation.isPending}
                          onClick={() => banMutation.mutate(u.id)}
                          className="h-6 px-2 text-[10px] font-mono border-bear/40 text-bear hover:bg-bear/10 hover:border-bear/60"
                        >
                          {banMutation.isPending &&
                          banMutation.variables === u.id ? (
                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          ) : (
                            <>
                              <Ban className="w-2.5 h-2.5 mr-1" /> Ban
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>

      {/* Affiliate Click Stats */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="trading-card overflow-hidden"
        data-ocid="admin.affiliate.panel"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-wide">
              Affiliate Clicks
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {affiliateClicks.length} total
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/20 p-0">
          {["binance", "bybit", "okx"].map((exchange, idx) => (
            <div
              key={exchange}
              data-ocid={`admin.affiliate.item.${idx + 1}`}
              className="flex flex-col items-center py-4"
            >
              <span className="text-2xl font-black font-mono text-primary">
                {clicksByExchange[exchange] || 0}
              </span>
              <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest mt-1">
                {exchange}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="flex items-start gap-2 text-xs text-hold bg-hold/10 border border-hold/30 rounded-lg px-4 py-3">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Admin actions are logged and audited. Banned users cannot log in until
          manually unbanned.
        </span>
      </div>
    </div>
  );
}
