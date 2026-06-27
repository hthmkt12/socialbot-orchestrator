import type { Account, AccountActionType, AccountActionHistory } from './database.types';
import { computeDefaultBudgets, DEFAULT_BUDGET_PERCENTAGES, type ActionBudgetMap } from './action-budget-types';

export interface BudgetCheckResult {
  allowed: boolean;
  dailyRemaining: number;
  dailyBudget: number;
  hourlyRemaining: number;
  hourlyBudget: number;
  reason?: string;
}

export interface AccountBudgetUsage {
  actionType: AccountActionType;
  dailyBudget: number;
  dailyUsed: number;
  dailyRemaining: number;
  usagePct: number;
  hourlyBudget: number;
  hourlyUsed: number;
}

/** Compute the actual ActionBudgetMap for an account (defaults based on daily limit). */
export function getAccountBudgets(account: Account): ActionBudgetMap {
  return computeDefaultBudgets(account.daily_action_limit);
}

/** Aggregate today's successful actions per type from history records. */
export function getTodayActionCounts(
  history: AccountActionHistory[],
  accountId: string,
): Record<AccountActionType, number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const counts: Partial<Record<AccountActionType, number>> = {};
  for (const entry of history) {
    if (entry.account_id !== accountId) continue;
    if (new Date(entry.created_at).getTime() < todayMs) continue;
    if (!entry.success) continue;
    counts[entry.action_type] = (counts[entry.action_type] ?? 0) + 1;
  }

  return Object.fromEntries(
    (Object.keys(DEFAULT_BUDGET_PERCENTAGES) as AccountActionType[]).map(
      (t) => [t, counts[t] ?? 0],
    ),
  ) as Record<AccountActionType, number>;
}

/** Check whether the account has remaining budget for the given action type. */
export function checkActionBudget(
  account: Account,
  actionType: AccountActionType,
  todayCounts: Record<AccountActionType, number>,
  budgets?: ActionBudgetMap,
): BudgetCheckResult {
  const b = budgets ?? getAccountBudgets(account);
  const budget = b[actionType];
  const used = todayCounts[actionType] ?? 0;
  const dailyRemaining = Math.max(0, budget.daily - used);
  const hourlyRemaining = Math.max(0, budget.hourly - 0); // hourly tracked per-session, not persisted

  if (used >= budget.daily) {
    return {
      allowed: false,
      dailyRemaining: 0,
      dailyBudget: budget.daily,
      hourlyRemaining,
      hourlyBudget: budget.hourly,
      reason: `Daily ${actionType} limit reached (${used}/${budget.daily})`,
    };
  }

  return {
    allowed: true,
    dailyRemaining,
    dailyBudget: budget.daily,
    hourlyRemaining,
    hourlyBudget: budget.hourly,
  };
}

/** Compute per-type budget usage for dashboard display. */
export function getBudgetUsages(
  account: Account,
  todayCounts: Record<AccountActionType, number>,
  budgets?: ActionBudgetMap,
): AccountBudgetUsage[] {
  const b = budgets ?? getAccountBudgets(account);
  const types = Object.keys(DEFAULT_BUDGET_PERCENTAGES) as AccountActionType[];

  return types.map((actionType) => {
    const budget = b[actionType];
    const used = todayCounts[actionType] ?? 0;
    return {
      actionType,
      dailyBudget: budget.daily,
      dailyUsed: used,
      dailyRemaining: Math.max(0, budget.daily - used),
      usagePct: Math.min(100, Math.round((used / Math.max(1, budget.daily)) * 100)),
      hourlyBudget: budget.hourly,
      hourlyUsed: 0,
    };
  });
}

