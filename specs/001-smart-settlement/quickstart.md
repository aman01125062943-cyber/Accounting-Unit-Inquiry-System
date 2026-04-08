# Quickstart: Smart Settlement

1. **Backend**:
   Ensure you have the .NET 8 SDK installed. Run the application from the root directory:
   ```bash
   dotnet run
   ```
   Or simply execute `Start_System.bat`.

2. **Frontend**:
   The frontend is served directly from the `wwwroot` folder by the .NET Minimal API backend. Navigate to `http://localhost:5001/smart-settlement.html` (or whatever the route will be mapped to) once the server starts.

3. **Dependencies**:
   The frontend relies on `tailwindcss` via CDN and will include `SheetJS (xlsx)` via CDN for Excel parsing. No extra installation is required.
