import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ENV } from "./env";
import { DATABASE_UNAVAILABLE_MESSAGE, isDatabaseUnavailable } from "./errors";
import { createRateLimiter, formatRetryAfter, RATE_LIMITS, type RateLimiterOptions } from "./rateLimit";
import { getRateLimitKey } from "./requestIp";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

/**
 * A dropped database connection is a dependency outage, not an application bug,
 * so it answers 503 instead of 500. This sits on the base procedure rather than
 * on individual routers so no future procedure can forget it — the storefront's
 * own status query used to answer a bare 500 and the dashboard read that as
 * "no admin account exists yet".
 */
const translateInfrastructureErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && isDatabaseUnavailable(result.error)) {
    throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: DATABASE_UNAVAILABLE_MESSAGE, cause: result.error });
  }
  return result;
});

const baseProcedure = t.procedure.use(translateInfrastructureErrors);
export const publicProcedure = baseProcedure;

/**
 * True only when the request identity matches a *configured* owner. Comparing
 * against ENV.ownerOpenId without this guard would make the empty string — the
 * value when OWNER_OPEN_ID is unset — a valid owner identity.
 */
export function isOwnerIdentity(user: TrpcContext["user"]) {
  if (user?.role === "admin") return true;
  return Boolean(ENV.ownerOpenId && user?.openId && user.openId === ENV.ownerOpenId);
}

/**
 * Per-client throttle for a single procedure. The limiter is created once at
 * module load so the window survives across requests.
 */
function rateLimited(scope: string, options: RateLimiterOptions, message: string) {
  const limiter = createRateLimiter(options);
  return t.middleware(async ({ ctx, next }) => {
    const decision = limiter.check(getRateLimitKey(ctx.req, scope));
    if (!decision.allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `${message} حاول مجددًا بعد ${formatRetryAfter(decision.retryAfterMs)}.`,
      });
    }
    return next({ ctx });
  });
}

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = baseProcedure.use(requireUser);

export const adminProcedure = baseProcedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (ctx.localAdmin || isOwnerIdentity(ctx.user)) {
      return next({ ctx });
    }

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }),
);

function requireLocalRole(roles: Array<"owner" | "manager" | "editor">, forbiddenMessage: string) {
  return t.middleware(async opts => {
    const { ctx, next } = opts;
    if (isOwnerIdentity(ctx.user)) return next({ ctx });
    if (ctx.localAdmin && roles.includes(ctx.localAdmin.role)) return next({ ctx });
    if (!ctx.user && !ctx.localAdmin) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    throw new TRPCError({ code: "FORBIDDEN", message: forbiddenMessage });
  });
}

export const managerProcedure = baseProcedure.use(requireLocalRole(["owner", "manager"], "هذه العملية تتطلب صلاحية مدير أو مالك المتجر"));
export const ownerProcedure = baseProcedure.use(requireLocalRole(["owner"], "هذه العملية متاحة لمالك المتجر فقط"));

/** Public procedures that an attacker would grind, each with its own budget. */
export const adminLoginProcedure = baseProcedure.use(
  rateLimited("adminAuth.login", RATE_LIMITS.adminLogin, "محاولات دخول كثيرة من هذا الجهاز."),
);
/**
 * First-run claim. Authentication is checked before the throttle so an anonymous
 * flood cannot spend the budget the real owner needs, and the throttle then caps
 * how fast a signed-in visitor can guess ADMIN_SETUP_TOKEN.
 */
export const adminSetupProcedure = protectedProcedure.use(
  rateLimited("adminAuth.setup", RATE_LIMITS.adminSetup, "محاولات إعداد كثيرة من هذا الجهاز."),
);
export const orderCreateProcedure = baseProcedure.use(
  rateLimited("orders.create", RATE_LIMITS.orderCreate, "تم إنشاء طلبات كثيرة من هذا الجهاز."),
);
export const onlineCheckoutProcedure = baseProcedure.use(
  rateLimited("orders.createOnlineCheckout", RATE_LIMITS.orderCreate, "تم بدء عمليات دفع كثيرة من هذا الجهاز."),
);
export const orderTrackProcedure = baseProcedure.use(
  rateLimited("orders.track", RATE_LIMITS.orderTrack, "عمليات تتبع كثيرة من هذا الجهاز."),
);
export const reviewSubmitProcedure = baseProcedure.use(
  rateLimited("reviews.submit", RATE_LIMITS.reviewSubmit, "تم إرسال مراجعات كثيرة من هذا الجهاز."),
);
