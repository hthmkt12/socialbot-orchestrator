import type { AccountActionType } from './database.types';

/** Per-action-type budget definition for daily and hourly limits. */
export interface ActionBudget {
  /** Maximum actions per day. 0 = unlimited. */
  daily: number;
  /** Maximum actions per hour. 0 = unlimited. */
  hourly: number;
}

export type ActionBudgetMap = Record<AccountActionType, ActionBudget>;

/** Default share of total daily_action_limit per action type, summing to 1.0. */
export const DEFAULT_BUDGET_PERCENTAGES: Record<AccountActionType, number> = {
  like: 0.40,
  follow: 0.25,
  comment: 0.15,
  post: 0.10,
  share: 0.10,
};

/** Labels for each action type (used in UI). */
export const ACTION_TYPE_LABELS: Record<AccountActionType, string> = {
  like: 'Likes',
  follow: 'Follows',
  comment: 'Comments',
  post: 'Posts',
  share: 'Shares',
};

/** Compute default ActionBudgetMap from a total daily limit. */
export function computeDefaultBudgets(dailyLimit: number): ActionBudgetMap {
  return Object.fromEntries(
    (Object.entries(DEFAULT_BUDGET_PERCENTAGES) as [AccountActionType, number][]).map(
      ([type, pct]) => [
        type,
        {
          daily: Math.max(1, Math.round(dailyLimit * pct)),
          hourly: Math.max(1, Math.round(dailyLimit * pct * 0.2)),
        },
      ],
    ),
  ) as ActionBudgetMap;
}
