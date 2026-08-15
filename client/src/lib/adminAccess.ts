/**
 * One definition of "what may this admin see", shared by the dashboard shell and
 * the dashboard body so the sidebar can never offer a tab whose data the server
 * will refuse.
 *
 * The capability names mirror the tRPC procedure guards in server/_core/trpc.ts:
 *   content    → adminProcedure   (owner, manager, editor)
 *   operations → managerProcedure  (owner, manager)
 *   users      → ownerProcedure    (owner)
 */

export type LocalAdminRole = "owner" | "manager" | "editor";

export type AdminCapability = "content" | "operations" | "users";

export type AdminCapabilities = Record<AdminCapability, boolean>;

export type AdminTab = {
  value: string;
  label: string;
  capability: AdminCapability;
};

export const ADMIN_TABS: AdminTab[] = [
  { value: "overview", label: "نظرة عامة", capability: "operations" },
  { value: "products", label: "المنتجات", capability: "content" },
  { value: "orders", label: "الطلبات", capability: "operations" },
  { value: "inventory", label: "المخزون", capability: "operations" },
  { value: "reviews", label: "المراجعات", capability: "content" },
  { value: "settings", label: "الإعدادات", capability: "operations" },
  { value: "users", label: "المستخدمون", capability: "users" },
];

export function resolveAdminCapabilities(input: { ownerAdmin: boolean; role?: LocalAdminRole | null }): AdminCapabilities {
  const { ownerAdmin, role } = input;
  // The project owner (OWNER_OPEN_ID / role=admin) outranks every local role.
  if (ownerAdmin) return { content: true, operations: true, users: true };
  return {
    content: role === "owner" || role === "manager" || role === "editor",
    operations: role === "owner" || role === "manager",
    users: role === "owner",
  };
}

export function visibleAdminTabs(capabilities: AdminCapabilities) {
  return ADMIN_TABS.filter(tab => capabilities[tab.capability]);
}

/**
 * Keeps the requested tab honest: a URL like /admin?tab=orders opened by an
 * editor resolves to the first tab they are actually allowed to load, instead of
 * rendering a table that fails with FORBIDDEN behind the scenes.
 */
export function resolveAdminTab(requested: string | null | undefined, capabilities: AdminCapabilities) {
  const visible = visibleAdminTabs(capabilities);
  const match = visible.find(tab => tab.value === requested);
  return match?.value ?? visible[0]?.value ?? "products";
}

export function adminRoleLabel(input: { ownerAdmin: boolean; role?: LocalAdminRole | null }) {
  if (input.ownerAdmin) return "مالك المشروع";
  if (input.role === "owner") return "مالك المتجر";
  if (input.role === "manager") return "مدير المتجر";
  return "محرر المتجر";
}

/**
 * Which screen /admin owes the current visitor. The shell and the page both read
 * this, so the layout can never refuse an identity that the page would have let
 * through — the mismatch that kept showing "لا تملك صلاحية الإدارة" to accounts
 * the server was willing to let create the first admin.
 *
 * `canSetup` comes from adminAuth.status and mirrors the server-side guard on
 * adminAuth.setup, so the setup form only appears to identities the mutation
 * accepts.
 *
 * `failed` is checked before every membership branch on purpose. When the status
 * query errors, `configured`/`canSetup`/`hasLocalAdmin` are all merely *absent*,
 * and reading absence as "false" told the visitor «لم يُنشأ حساب مدير محلي بعد»
 * — a claim the app had no evidence for. A failure is its own answer.
 */
export type AdminGate = "loading" | "unavailable" | "setup" | "localLogin" | "ownerLogin" | "denied" | "dashboard";

export function resolveAdminGate(input: {
  loading: boolean;
  failed: boolean;
  signedIn: boolean;
  ownerAdmin: boolean;
  hasLocalAdmin: boolean;
  configured: boolean;
  canSetup: boolean;
}): AdminGate {
  if (input.loading) return "loading";
  if (input.failed) return "unavailable";
  if (!input.configured && (input.ownerAdmin || input.canSetup)) return "setup";
  if (input.ownerAdmin || input.hasLocalAdmin) return "dashboard";
  if (input.configured) return "localLogin";
  if (!input.signedIn) return "ownerLogin";
  return "denied";
}
