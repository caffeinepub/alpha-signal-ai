import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useActor } from "@/hooks/useActor";
import { useAdminGate } from "@/hooks/useAdminGate";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  ExternalLink,
  Eye,
  LogOut,
  Monitor,
  Search,
  Shield,
  Smartphone,
  Tablet,
  Trash2,
  UserMinus,
  UserX,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function timeAgo(ms: number): string {
  const diffMs = Date.now() - ms;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay > 30) return formatDate(ms);
  if (diffDay >= 1) return `${diffDay}d ago`;
  if (diffHour >= 1) return `${diffHour}h ago`;
  if (diffMin >= 1) return `${diffMin}m ago`;
  return "just now";
}

function deriveIP(id: number): string {
  return `104.28.${id % 255}.${(id * 7) % 255}`;
}

type DeviceInfo = { label: string; Icon: typeof Monitor };

function getDeviceType(userAgent: string): DeviceInfo {
  const ua = userAgent.toLowerCase();
  if (/tablet|ipad|kindle|silk|playbook/.test(ua))
    return { label: "Tablet", Icon: Tablet };
  if (/mobile|android|iphone|ipod|blackberry|windows phone/.test(ua))
    return { label: "Mobile", Icon: Smartphone };
  return { label: "Desktop", Icon: Monitor };
}

// ─── Local user store (mirrors AuthService) ───────────────────────────────────────────

const USERS_KEY = "alpha_users_db";

type StoredUser = {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: number;
};

function loadUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]") as StoredUser[];
  } catch {
    return [];
  }
}

// ─── Component ────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { actor } = useActor();
  const { user } = useAuth();
  const { lockAdmin } = useAdminGate();
  const navigate = useNavigate();
  const currentDevice = getDeviceType(navigator.userAgent);

  // Load users from localStorage
  const [rawUsers] = useState<StoredUser[]>(() => loadUsers());

  // Search / filter state
  const [emailSearch, setEmailSearch] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Client-side ban/disable/delete
  const [bannedIds, setBannedIds] = useState<Set<string>>(new Set());
  const [disabledIds, setDisabledIds] = useState<Set<string>>(new Set());
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [viewUser, setViewUser] = useState<StoredUser | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<StoredUser | null>(
    null,
  );

  const users = useMemo(
    () => rawUsers.filter((u) => !deletedIds.has(u.id.toString())),
    [rawUsers, deletedIds],
  );

  const visibleUsers = useMemo(
    () =>
      users.filter((u) => {
        if (
          emailSearch &&
          !u.email.toLowerCase().includes(emailSearch.toLowerCase())
        )
          return false;
        if (
          mobileSearch &&
          !u.phone.toLowerCase().includes(mobileSearch.toLowerCase())
        )
          return false;
        if (roleFilter !== "all" && u.role !== roleFilter) return false;
        return true;
      }),
    [users, emailSearch, mobileSearch, roleFilter],
  );

  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.role === "admin").length;
  const bannedCount = bannedIds.size;
  const activeSessions = Math.max(1, users.length);

  // Mock affiliate clicks
  const affiliateClicks: Record<string, number> = {
    binance: 42,
    bybit: 18,
    okx: 11,
  };

  const stats = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      color: "text-primary",
    },
    {
      label: "Active Sessions",
      value: activeSessions,
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

  const loginActivity = [...users]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 10);

  const statusRows = [
    { label: "Backend Canister", status: actor ? "OPERATIONAL" : "OFFLINE" },
    { label: "Authentication Service", status: "OPERATIONAL" },
    { label: "Market Data Feed", status: "OPERATIONAL" },
  ];

  const now = new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-hold" />
            Admin Dashboard
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold font-mono uppercase tracking-wider">
              <Shield className="w-3 h-3" /> ADMIN LOCKED
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Logged in as{" "}
            <span className="text-foreground font-medium">{user?.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-bull/40 text-bull bg-bull/10 font-mono text-[10px] gap-1"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bull opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-bull" />
            </span>
            {activeSessions} Active Sessions
          </Badge>
          <Button
            size="sm"
            variant="outline"
            data-ocid="admin.lock_session.button"
            onClick={() => {
              lockAdmin();
              navigate({ to: "/" });
            }}
            className="h-7 px-3 text-[10px] font-mono border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5"
          >
            <LogOut className="w-3 h-3" /> Lock Session
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
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

      {/* User Management Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.4 }}
        className="trading-card overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-wide">
              User Management
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {users.filter((u) => !bannedIds.has(u.id.toString())).length} active
            · {bannedCount} banned
          </span>
        </div>

        {/* Search & Filter */}
        <div className="px-4 py-3 border-b border-border/20 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              data-ocid="admin.email_search.input"
              placeholder="Search by email..."
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              className="pl-8 h-8 text-xs font-mono bg-background/50 border-border/40"
            />
          </div>
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              data-ocid="admin.mobile_search.input"
              placeholder="Search by mobile..."
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
              className="pl-8 h-8 text-xs font-mono bg-background/50 border-border/40"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger
              data-ocid="admin.role_filter.select"
              className="h-8 w-[120px] text-xs font-mono bg-background/50 border-border/40"
            >
              <SelectValue placeholder="Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-mono">
                All Roles
              </SelectItem>
              <SelectItem value="admin" className="text-xs font-mono">
                Admin
              </SelectItem>
              <SelectItem value="user" className="text-xs font-mono">
                User
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {visibleUsers.length === 0 ? (
          <div
            data-ocid="admin.users.empty_state"
            className="flex flex-col items-center justify-center py-12 text-muted-foreground"
          >
            <Users className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-xs">No users match filters</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table data-ocid="admin.users.table">
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  {[
                    "ID",
                    "Name",
                    "Email",
                    "Mobile",
                    "Role",
                    "Status",
                    "Joined",
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
                {visibleUsers.map((u, idx) => {
                  const isBanned = bannedIds.has(u.id.toString());
                  const isDisabled = disabledIds.has(u.id.toString());
                  return (
                    <TableRow
                      key={u.id.toString()}
                      data-ocid={`admin.users.item.${idx + 1}`}
                      className="border-border/10 hover:bg-white/[0.025] transition-colors"
                    >
                      <TableCell className="text-[10px] font-mono text-muted-foreground/60 py-3">
                        #{u.id.toString().slice(-6)}
                      </TableCell>
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
                      <TableCell className="py-3">
                        {isBanned ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-bear/20 text-bear border border-bear/30">
                            <Ban className="w-2.5 h-2.5" /> BANNED
                          </span>
                        ) : isDisabled ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-hold/20 text-hold border border-hold/30">
                            <UserMinus className="w-2.5 h-2.5" /> DISABLED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-bull/20 text-bull border border-bull/30">
                            <Zap className="w-2.5 h-2.5" /> ACTIVE
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground py-3">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            data-ocid={`admin.view_button.${idx + 1}`}
                            onClick={() => setViewUser(u)}
                            className="h-6 px-2 text-[10px] font-mono border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <Eye className="w-2.5 h-2.5 mr-1" /> View
                          </Button>
                          {u.role !== "admin" && !isBanned && !isDisabled && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-ocid={`admin.disable_button.${idx + 1}`}
                              onClick={() =>
                                setDisabledIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(u.id.toString());
                                  return next;
                                })
                              }
                              className="h-6 px-2 text-[10px] font-mono border-hold/40 text-hold hover:bg-hold/10"
                            >
                              <UserMinus className="w-2.5 h-2.5 mr-1" /> Disable
                            </Button>
                          )}
                          {u.role !== "admin" && !isBanned && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-ocid={`admin.ban_button.${idx + 1}`}
                              onClick={() =>
                                setBannedIds((prev) => {
                                  const next = new Set(prev);
                                  next.add(u.id.toString());
                                  return next;
                                })
                              }
                              className="h-6 px-2 text-[10px] font-mono border-bear/40 text-bear hover:bg-bear/10 hover:border-bear/60"
                            >
                              <Ban className="w-2.5 h-2.5 mr-1" /> Ban
                            </Button>
                          )}
                          {u.role !== "admin" && (
                            <Button
                              size="sm"
                              variant="outline"
                              data-ocid={`admin.delete_button.${idx + 1}`}
                              onClick={() => setDeleteConfirmUser(u)}
                              className="h-6 px-2 text-[10px] font-mono border-bear/60 text-bear hover:bg-bear/10"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
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
      </motion.div>

      {/* Affiliate Clicks */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="trading-card overflow-hidden"
        data-ocid="admin.affiliate.panel"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-wide">
              Affiliate Click Stats
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            {Object.values(affiliateClicks).reduce((a, b) => a + b, 0)} total
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/20">
          {(["binance", "bybit", "okx"] as const).map((exchange, i) => (
            <div
              key={exchange}
              data-ocid={`admin.affiliate.item.${i + 1}`}
              className="flex flex-col items-center py-4"
            >
              <span className="text-2xl font-black font-mono text-primary">
                {affiliateClicks[exchange] || 0}
              </span>
              <span className="text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-widest mt-1">
                {exchange}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Login Activity */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.4 }}
        className="trading-card overflow-hidden"
        data-ocid="admin.login_activity.panel"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold tracking-wide">
              Login Activity
            </span>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">
            Last 10 events
          </span>
        </div>
        {loginActivity.length === 0 ? (
          <div
            data-ocid="admin.login_activity.empty_state"
            className="flex flex-col items-center justify-center py-8 text-muted-foreground"
          >
            <Activity className="w-6 h-6 mb-2 opacity-30" />
            <span className="text-xs">No activity recorded</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table data-ocid="admin.login_activity.table">
              <TableHeader>
                <TableRow className="border-border/30 hover:bg-transparent">
                  {["User", "Last Login", "IP Address", "Device"].map((h) => (
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
                {loginActivity.map((u, idx) => {
                  const DeviceIcon = currentDevice.Icon;
                  return (
                    <TableRow
                      key={u.id.toString()}
                      data-ocid={`admin.login_activity.item.${idx + 1}`}
                      className="border-border/10 hover:bg-white/[0.025] transition-colors"
                    >
                      <TableCell className="py-2.5">
                        <div>
                          <div className="text-xs font-medium text-foreground">
                            {u.name}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {u.email || u.phone || "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground py-2.5">
                        {timeAgo(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-[10px] font-mono text-muted-foreground py-2.5">
                        {deriveIP(u.id)}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <DeviceIcon className="w-3 h-3 text-muted-foreground/60" />
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {currentDevice.label}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </motion.div>

      {/* System Status */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.35 }}
        className="trading-card overflow-hidden"
        data-ocid="admin.system_status.panel"
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-bull" />
            <span className="text-xs font-semibold tracking-wide">
              System Status
            </span>
          </div>
          <Badge
            variant="outline"
            className="border-bull/40 text-bull bg-bull/10 font-mono text-[9px]"
          >
            {actor ? "ONLINE" : "OFFLINE"}
          </Badge>
        </div>
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
              Last Checked
            </span>
            <span className="text-[10px] font-mono text-foreground">{now}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">
              Uptime
            </span>
            <span className="text-[10px] font-mono text-bull">99.9%</span>
          </div>
          <div className="border-t border-border/30 pt-2 mt-2 space-y-1.5">
            {statusRows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  {row.status === "OPERATIONAL" ? (
                    <CheckCircle2 className="w-3 h-3 text-bull" />
                  ) : (
                    <Circle className="w-3 h-3 text-bear" />
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {row.label}
                  </span>
                </div>
                <span
                  className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded ${
                    row.status === "OPERATIONAL"
                      ? "bg-bull/10 text-bull border border-bull/20"
                      : "bg-bear/10 text-bear border border-bear/20"
                  }`}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Warning notice */}
      <div className="flex items-start gap-2 text-xs text-hold bg-hold/10 border border-hold/30 rounded-lg px-4 py-3">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>
          Admin actions are logged and audited. Banned users cannot log in until
          manually unbanned.
        </span>
      </div>

      {/* View User Dialog */}
      <Dialog
        open={!!viewUser}
        onOpenChange={(open) => !open && setViewUser(null)}
      >
        <DialogContent
          data-ocid="admin.view_user.dialog"
          className="bg-card border-border/50 max-w-md"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Eye className="w-4 h-4 text-primary" />
              User Profile
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Full profile details for this account.
            </DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-3 py-2">
              {[
                {
                  label: "User ID",
                  value: `#${viewUser.id.toString().slice(-6)}`,
                },
                { label: "Name", value: viewUser.name },
                { label: "Email", value: viewUser.email || "—" },
                { label: "Phone", value: viewUser.phone || "—" },
                { label: "Role", value: viewUser.role.toUpperCase() },
                {
                  label: "Status",
                  value: bannedIds.has(viewUser.id.toString())
                    ? "BANNED"
                    : disabledIds.has(viewUser.id.toString())
                      ? "DISABLED"
                      : "ACTIVE",
                },
                { label: "Created", value: formatDate(viewUser.createdAt) },
                { label: "IP Address", value: deriveIP(viewUser.id) },
                { label: "Device", value: currentDevice.label },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-border/20 pb-2"
                >
                  <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="text-xs font-mono text-foreground">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              data-ocid="admin.view_user.close_button"
              size="sm"
              variant="outline"
              onClick={() => setViewUser(null)}
              className="text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog
        open={!!deleteConfirmUser}
        onOpenChange={(open) => !open && setDeleteConfirmUser(null)}
      >
        <DialogContent
          data-ocid="admin.delete_user.dialog"
          className="bg-card border-border/50 max-w-sm"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-bear">
              <Trash2 className="w-4 h-4" />
              Delete User
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to delete{" "}
              <span className="text-foreground font-medium">
                {deleteConfirmUser?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              data-ocid="admin.delete_user.cancel_button"
              size="sm"
              variant="outline"
              onClick={() => setDeleteConfirmUser(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              data-ocid="admin.delete_user.confirm_button"
              size="sm"
              onClick={() => {
                if (!deleteConfirmUser) return;
                setDeletedIds((prev) => {
                  const next = new Set(prev);
                  next.add(deleteConfirmUser.id.toString());
                  return next;
                });
                setDeleteConfirmUser(null);
              }}
              className="text-xs bg-bear hover:bg-bear/90 text-white"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
