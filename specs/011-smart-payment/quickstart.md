# Quickstart: Smart Payment (Settlement)

## How to test the feature
1. Run IIS Express or `npm start` to boot the HKServer application.
2. Go to the "السداد الذكي" page.
3. Import an Excel file that has `رقم تسوية السداد`, `تاريخ تسوية السداد` among other required headers.
4. Review the results in the table. Make a manual edit to one of the fields (e.g., `رقم حساب المستفيد`).
5. Click **تنفيذ التسوية**.
6. Check the SQLite DB or the Returns page to ensure the edited field and the newly added `SettlementNo`/`SettlementDate` are correctly persisted with `Status = تم التسوية`.
