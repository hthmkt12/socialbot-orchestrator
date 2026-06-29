# Account Setup

Social media accounts are the targets of your automation workflows. The platform supports adding accounts individually or in bulk via CSV import.

## Adding a Single Account

1. Navigate to **Accounts** in the sidebar.
2. Click **Add Account** in the top-right corner.
3. Fill in the following fields:
   - **Username**: The social media account username or email.
   - **Password**: Encrypted at rest using the platform's credential vault. Never stored in plain text.
   - **Platform**: Select Instagram, TikTok, or Facebook from the dropdown.
   - **Daily Action Limit**: The maximum number of automated actions (likes, follows, comments) allowed per day. Start low for new accounts.
4. Click **Create** to save the account.

The account is now ready for warm-up and assignment to macros.

## Bulk Import via CSV

For teams onboarding dozens of accounts:

1. Navigate to **Accounts** and click **Import CSV**.
2. Prepare a CSV file with the following columns:

```
username,password,platform,daily_limit
my_account_1,pass123,instagram,50
my_account_2,pass456,tiktok,30
```

3. Drag and drop or select your CSV file in the import dialog.
4. Review the parsed rows and confirm the import.
5. The platform creates each account individually. A summary shows how many succeeded and how many failed.

### CSV Format Rules

- The first row **must** be a header row with the exact column names above.
- `platform` must be one of: `instagram`, `tiktok`, `facebook`.
- `daily_limit` must be a positive integer.
- Rows with missing or invalid fields are skipped and reported in the failure count.

## Account Lifecycle

Once added, accounts move through the following stages:

1. **Provisioned** — The account exists in the system but has not started any workflow.
2. **Warming Up** — The account is enrolled in an automated warm-up sequence (see Warm-up Schedules).
3. **Active** — Fully graduated, ready for full-action macros.
4. **Cooling Down** — Temporarily paused due to action budget exhaustion. Resets at the next calendar day.
5. **Blocked** — The platform detected a soft or hard block. Blocked accounts are excluded from all runs until manually reviewed.

## Account Health Indicators

Each account displays a health card with key metrics:

- **Engagement Rate**: Ratio of successful actions vs. attempted actions.
- **Risk Score**: Heuristic based on block frequency, action velocity, and account age.
- **Daily Budget**: Remaining actions for the current calendar day.
- **Warm-up Stage**: Current trust-building stage (1-5).
