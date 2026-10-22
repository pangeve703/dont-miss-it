# Email reminder service (optional)

This folder contains a small, free backend that sends optional email reminders for
Don't Miss It. It runs on **Google Apps Script**, so there's no server to rent:

- Sign-ups are stored in a **Google Sheet** you own.
- The script checks every hour and sends each subscriber **at most one email a day**,
  around 8am in their own time zone.
- Emails are sent through **Gmail** from the Google account that deploys it.

Until it's deployed and its URL is added to the app, the email option is hidden and the
app sends nothing anywhere.

## What gets stored

Only for people who turn email reminders on, and only after they confirm their address:

| Stored | Not stored |
| --- | --- |
| Email address, time zone, reminder timing | Amounts, currencies, notes |
| Title and date of active (not completed, not past) reminders | Completed or past reminders |

Turning email reminders off in the app, or using the unsubscribe link in any email,
deletes that person's row. Unconfirmed sign-ups are deleted after 7 days.

## Set it up (about 10 minutes)

1. **Use a separate Google account (recommended).** Reminder emails come *from* the account
   that deploys the script, so create one such as `dontmissit.reminders@gmail.com` rather
   than using your personal Gmail.
2. Signed in to that account, open <https://sheets.new> and name the sheet
   **Don't Miss It – email reminders**.
3. In the sheet, choose **Extensions → Apps Script**. Delete the sample code, paste in the
   whole of [`Code.gs`](Code.gs), and click **Save** (💾).
4. In the toolbar's function menu, choose **`setup`** and click **Run**.
   - Google asks for permission. Click **Review permissions**, choose the account, then
     **Advanced → Go to … (unsafe)** → **Allow**. The "unsafe" warning appears because this
     is your own script that Google hasn't reviewed. It only accesses this sheet and sends
     email as you.
   - This creates the `subscribers` tab and an hourly trigger.
5. Click **Deploy → New deployment**. Click the ⚙️ next to "Select type" and choose
   **Web app**:
   - Description: `Don't Miss It reminders`
   - Execute as: **Me**
   - Who has access: **Anyone**

   Click **Deploy** and copy the **Web app URL** (it ends in `/exec`).
6. Put that URL in [`src/config.ts`](../src/config.ts) as `emailServiceUrl`, then commit and
   push. The email reminder option then appears under **Settings** in the app.

## Updating the script later

Paste the new code, save, then **Deploy → Manage deployments → ✏️ Edit → Version: New
version → Deploy**. The URL stays the same, so the app doesn't need to change.

## Limits (free Gmail account)

- About **100 emails a day** in total, so roughly 90 active subscribers on a busy day. If the
  limit is reached, remaining emails go out the next hour the quota allows.
- At most **20 confirmation emails an hour**, so the sign-up form can't be used to spam people.
- Apps Script's free tier is plenty for an hourly job like this.

If the project outgrows these limits, it can move to a paid email provider. That's a
decision for later.

## Your responsibilities as the operator

- The sheet contains people's email addresses. **Don't share it**, and delete a row if
  someone asks you to.
- Keep the description in the app accurate if you change what's stored.
