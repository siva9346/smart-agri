# Crop Tracking & Expense Management Module

The Crop Tracking and Expense Management module has been successfully integrated into the **Naveena Uzhavan** app.

## Module Structure

- **Types & Data**: `types.ts`, `dummyData.ts`
- **State Management**: `store.ts` (In-memory singleton store)
- **Screens**:
    - `HomeScreen.tsx`: Lists all registered lands.
    - `CropCycleScreen.tsx`: Displays history of crops.
    - `CropTrackingScreen.tsx`: Daily activity log.
    - `AddDailyRecordScreen.tsx`: Form to record expenses.
    - `ExpenseSummaryScreen.tsx`: High-level financial overview.
    - `ExpenseBreakdownScreen.tsx`: Detailed cost analysis.

## Integration Note

- **Navigation**: New screens added to `FarmerStack` in `RootNavigator.tsx`.
- **Entry Point**: A new "Crop Track" quick action has been added to the `FarmerDashboard`.
