<div align="center">
  <h1>Tweak CSV</h1>
  <p><b>Lightweight Local CSV Editor</b></p>
  <p>
    <a href="https://forhadkhan.github.io/tweak-csv/"><b>🔴 Live - Try Now</b></a>
  </p>
</div>

<br />

**TweakCSV** is a lightning-fast, client-side data editor that allows you to manage and manipulate tabular data directly in your browser. Designed for privacy and performance, no data ever leaves your device.

## Features

- **Local Processing:** All data processing happens directly in the browser using IndexedDB. No server required.
- **Privacy First:** Because it is entirely client-side, your data remains secure and private.
- **Rich Grid Interaction:** Sort, filter, format, and resize columns easily using a fast grid interface powered by AG Grid. Includes drag-and-drop row reordering.
- **Tabbed Workspace:** Open and edit multiple CSV files in a tabbed environment.
- **Drag & Drop Seamlessly:** Upload files easily using robust drag-and-drop functionality, pasting from clipboard, or standard file selection.
- **Find and Replace:** Powerful Find and Replace functionality with exact match and targeted column features.
- **Undo/Redo Support:** Revert or reapply changes instantly.
- **Exports & Clipboard Integration:** Export your modified data into CSV, Excel (.xlsx), JSON, and Markdown. Easily "Copy CSV", "Copy as Markdown" or "Copy for Sheets" right to your clipboard.
- **Direct Local Saving:** Save changes directly back to the original source file on your hard drive with native browser write access (`Ctrl+S`/`Cmd+S`), avoiding standard download redos.
- **Unsaved Changes Guard:** Prevents accidental loss of work by prompting users when closing active tabs or reloading/closing the browser with modified data.
- **Visual Modification Indicators:** Tabs and document titles dynamically append a `*` indicator (e.g., `data.csv *`) to clearly highlight active unsaved files.
- **Toast Notifications:** Gentle visual feedback for completed actions and errors.
- **Dark & Light Themes:** Toggle between dark mode, light mode, and system preference with a polished user interface.

## Technologies Used

- **React** for user interface construction.
- **Tailwind CSS** for comprehensive styling and responsive design.
- **AG Grid** for high-performance data rendering and manipulation.
- **Vite** for fast, modern frontend tooling.
- **Lucide React** for clear, scalable SVG iconography.
- **Papa Parse** for robust CSV parsing and generation.
- **SheetJS (xlsx)** for reliable Excel file creation.
- **SweetAlert2** for elegant, customizable alerts and modals.

## Request a Feature

If you have ideas to improve TweakCSV or found a bug, please [open an issue](https://github.com/forhadkhan/tweak-csv/issues) carefully detailing your request or the problem encountered.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
