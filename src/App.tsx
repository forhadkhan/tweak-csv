import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FileUp, 
  Download, 
  Monitor, 
  Moon, 
  Sun, 
  Plus, 
  X, 
  Search,
  Undo,
  Redo,
  Copy,
  FileJson,
  FileCode2,
  Table2 as TableIcon,
  Github,
  Replace,
  CheckCircle2,
  AlertCircle,
  Save
} from 'lucide-react';
import { CsvGrid } from './components/CsvGrid';
import { 
  AppState, 
  CsvFile, 
  loadState, 
  saveState, 
  createNewFile 
} from './lib/storage';
import { 
  parseFileToCSV, 
  parseRawCsvString, 
  exportToCSV, 
  exportToExcel, 
  exportToJSON, 
  copyToGoogleSheets, 
  copyToClipboardAsCSV,
  exportToMarkdown,
  copyToClipboardAsMarkdown,
  prettifyCsv,
  getCSVString
} from './lib/csvHelper';
import { GridApi } from 'ag-grid-community';

type Theme = 'light' | 'dark' | 'system';

/**
 * Main Application Component for TweakCSV.
 * Orchestrates file handling, drag-and-drop, tab management,
 * find-and-replace, and grid rendering.
 */
export default function App() {
  const [appState, setAppState] = useState<AppState>({ files: [], activeFileId: null });
  const [theme, setTheme] = useState<Theme>('system');
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  const gridApiRef = useRef<GridApi | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 3000);
  }, []);

  const handleAction = async (action: () => any | Promise<any>, successMsg: string) => {
    try {
      await action();
      showToast(successMsg, 'success');
      // Mark the active file as clean upon successful export/copy
      setAppState(prev => ({
        ...prev,
        files: prev.files.map(f => f.id === prev.activeFileId ? { ...f, isDirty: false } : f)
      }));
    } catch (err: any) {
      showToast(`Failed: ${err.message || 'Unknown error'}`, 'error');
    }
  };

  // Load initial state
  useEffect(() => {
    loadState().then(setAppState);
    const savedTheme = localStorage.getItem('swiftcsv_theme') as Theme;
    if (savedTheme) setTheme(savedTheme);
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    saveState(appState);
  }, [appState]);

  // Apply theme
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    localStorage.setItem('swiftcsv_theme', theme);
  }, [theme]);

  // Warn user before closing/reloading the browser tab if there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasDirtyFiles = appState.files.some(f => f.isDirty);
      if (hasDirtyFiles) {
        e.preventDefault();
        e.returnValue = ''; // Required for some browsers
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [appState.files]);

  const activeFile = appState.files.find(f => f.id === appState.activeFileId) || null;

  // Update browser document title to show '*' on dirty files
  useEffect(() => {
    if (activeFile) {
      document.title = `TweakCSV | ${activeFile.name}${activeFile.isDirty ? ' *' : ''}`;
    } else {
      document.title = 'TweakCSV';
    }
  }, [activeFile?.name, activeFile?.isDirty]);

  // Open files using File System Access API if supported
  const handleOpenFile = async () => {
    if ('showOpenFilePicker' in window) {
      try {
        const fileHandles = await (window as any).showOpenFilePicker({
          types: [{
            description: 'CSV Files',
            accept: { 'text/csv': ['.csv'] }
          }],
          multiple: true
        });

        const newFiles: CsvFile[] = [];
        for (const handle of fileHandles) {
          const file = await handle.getFile();
          const { data, columns } = await parseFileToCSV(file);
          const newFile = createNewFile(file.name, data, columns);
          newFile.fileHandle = handle; // Store file handle
          newFiles.push(newFile);
        }

        if (newFiles.length > 0) {
          setAppState(prev => ({
            files: [...prev.files, ...newFiles],
            activeFileId: newFiles[0].id
          }));
          showToast(`Loaded ${newFiles.length} file(s)`, 'success');
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          showToast(err.message || 'Error opening file', 'error');
        }
      }
    } else {
      // Fallback
      fileInputRef.current?.click();
    }
  };

  // Save changes back to original file source destination
  const handleSaveFile = useCallback(async () => {
    if (!activeFile) return;

    try {
      let handle = activeFile.fileHandle;

      if (!handle && 'showSaveFilePicker' in window) {
        try {
          handle = await (window as any).showSaveFilePicker({
            suggestedName: activeFile.name,
            types: [{
              description: 'CSV Files',
              accept: { 'text/csv': ['.csv'] }
            }]
          });
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          throw err;
        }
      }

      const csvContent = getCSVString(activeFile.data);

      if (handle) {
        // Query / Request readwrite permission
        const options = { mode: 'readwrite' as const };
        if ((await handle.queryPermission(options)) !== 'granted') {
          if ((await handle.requestPermission(options)) !== 'granted') {
            throw new Error('Permission to write to file was denied.');
          }
        }

        const writable = await handle.createWritable();
        await writable.write(csvContent);
        await writable.close();

        // Update the file handle and clean state in the app
        setAppState(prev => ({
          ...prev,
          files: prev.files.map(f => f.id === prev.activeFileId ? { ...f, name: handle.name, fileHandle: handle, isDirty: false } : f)
        }));

        showToast(`Saved changes successfully to ${handle.name}`, 'success');
      } else {
        // Fallback for browsers that don't support File System Access API
        exportToCSV(activeFile.data, activeFile.name);
        setAppState(prev => ({
          ...prev,
          files: prev.files.map(f => f.id === prev.activeFileId ? { ...f, isDirty: false } : f)
        }));
        showToast(`Saved (Downloaded) ${activeFile.name}`, 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save file', 'error');
    }
  }, [activeFile, showToast]);

  // Handle Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveFile]);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const newFiles: CsvFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        showToast(`File ${file.name} is not a valid CSV file.`, 'error');
        continue;
      }
      try {
        const { data, columns } = await parseFileToCSV(file);
        newFiles.push(createNewFile(file.name, data, columns));
      } catch (err: any) {
        showToast(err.message || 'Error parsing CSV', 'error');
      }
    }

    if (newFiles.length > 0) {
      setAppState(prev => ({
        files: [...prev.files, ...newFiles],
        activeFileId: newFiles[0].id
      }));
      showToast(`Loaded ${newFiles.length} file(s)`, 'success');
    }
  }, [showToast]);

  const handlePaste = useCallback(async (event: ClipboardEvent) => {
    const pastedText = event.clipboardData?.getData('text');
    if (!pastedText) return;
    
    try {
      const { data, columns } = parseRawCsvString(pastedText);
      const newFile = createNewFile(`Pasted_Data_${Date.now()}.csv`, data, columns);
      setAppState(prev => ({
        files: [...prev.files, newFile],
        activeFileId: newFile.id
      }));
      showToast('Pasted data successfully as new file', 'success');
    } catch (err: any) {
      // It might not be CSV, ignore implicitly
      console.warn("Paste ignored:", err.message);
    }
  }, [showToast]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    let dragCounter = 0;

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        dragCounter++;
        if (dragCounter === 1) {
          setIsDragging(true);
        }
      }
    };

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer?.types.includes('Files')) {
        dragCounter--;
        if (dragCounter === 0) {
          setIsDragging(false);
        }
      }
    };

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);

    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFileUpload]);

  const updateActiveFileData = (data: any[], columns: any[]) => {
    setAppState(prev => ({
      ...prev,
      files: prev.files.map(f => f.id === prev.activeFileId ? { ...f, data, columns, lastModified: Date.now(), isDirty: true } : f)
    }));
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const file = appState.files.find(f => f.id === id);
    if (file && file.isDirty) {
      const confirmClose = window.confirm(
        `Are you sure you want to close "${file.name}"? You have unsaved changes that will be lost.`
      );
      if (!confirmClose) return;
    }

    setAppState(prev => {
      const filtered = prev.files.filter(f => f.id !== id);
      const newActive = prev.activeFileId === id ? (filtered[0]?.id || null) : prev.activeFileId;
      return { files: filtered, activeFileId: newActive };
    });
  };

  const handleUndo = () => {
    if (gridApiRef.current) gridApiRef.current.undoCellEditing();
  };

  const handleRedo = () => {
    if (gridApiRef.current) gridApiRef.current.redoCellEditing();
  };

  const escapeRegExp = (string: string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const handleReplace = () => {
    if (!activeFile || !findText) return;
    
    let replaceCount = 0;
    
    const newData = activeFile.data.map((row: any) => {
      let modified = false;
      const newRow = { ...row };
      
      const columnsToSearch = targetColumn ? [targetColumn] : activeFile.columns.map((c: any) => c.field);
      
      for (const col of columnsToSearch) {
        if (newRow[col] !== null && newRow[col] !== undefined) {
          const originalStr = String(newRow[col]);
          
          let newStr = originalStr;
          if (matchCase) {
             if (originalStr.includes(findText)) {
                newStr = originalStr.replaceAll(findText, replaceText);
             }
          } else {
             const regex = new RegExp(escapeRegExp(findText), 'gi');
             newStr = originalStr.replace(regex, replaceText);
          }
          
          if (newStr !== originalStr) {
            newRow[col] = newStr;
            modified = true;
          }
        }
      }
      if (modified) replaceCount++;
      return newRow;
    });
    
    if (replaceCount > 0) {
      updateActiveFileData(newData, activeFile.columns);
      setIsFindReplaceOpen(false);
      showToast(`Replaced ${replaceCount} row(s) successfully`, 'success');
    } else {
      showToast("No matches found.", 'error');
    }
  };

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : t === 'dark' ? 'system' : 'light');
  };

  return (
    <div 
      className="flex flex-col h-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-[#2b2b2b] dark:text-gray-100 transition-colors"
    >
      {/* Header Pipeline */}
      <header className="flex flex-wrap items-center justify-between px-2 sm:px-4 py-2 border-b border-gray-200 dark:border-[#4b4b4b] bg-white dark:bg-[#363636] shrink-0 gap-y-2">
        <div className="flex items-center gap-2 order-1">
          <div className="p-1.5 bg-blue-600 rounded-md text-white">
            <TableIcon size={20} />
          </div>
          <h1 className="font-bold text-lg tracking-tight hidden sm:block">TweakCSV</h1>
        </div>

        {activeFile && (
          <div className="flex items-center bg-gray-100 dark:bg-[#2b2b2b] rounded-md px-2 py-1 flex-1 min-w-[150px] w-full sm:max-w-xs md:max-w-sm sm:mx-4 dark:border dark:border-[#4b4b4b] order-3 sm:order-2">
            <Search size={16} className="text-gray-500 mr-2 shrink-0" />
            <input 
              type="text" 
              placeholder="Search in file..." 
              className="bg-transparent border-none outline-none w-full text-sm placeholder:text-gray-400"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div className="flex items-center gap-1 sm:gap-2 order-2 sm:order-3 shrink-0">
          {activeFile && (
            <>
              <button onClick={handleUndo} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-[#2a3c49] cursor-pointer" title="Undo">
                <Undo size={18} />
              </button>
              <button onClick={handleRedo} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-[#2a3c49] cursor-pointer" title="Redo">
                <Redo size={18} />
              </button>
              
              <button onClick={() => setIsFindReplaceOpen(true)} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-[#2a3c49] cursor-pointer" title="Find and Replace">
                <Replace size={18} />
              </button>

              <div className="h-6 w-px bg-gray-300 dark:bg-[#4b4b4b] mx-0.5 sm:mx-1 hidden sm:block"></div>
            </>
          )}

          <button onClick={toggleTheme} className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-[#2a3c49] cursor-pointer" title="Toggle Theme">
            {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <Monitor size={18} />}
          </button>

          <a href="https://github.com/forhadkhan/tweak-csv" target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-[#2a3c49] cursor-pointer hidden sm:flex" title="View Source on GitHub">
            <Github size={18} />
          </a>
          
          {activeFile && (
            <button 
              onClick={handleSaveFile}
              className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                activeFile.isDirty
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-[#2b2b2b] dark:hover:bg-[#4b4b4b] dark:text-gray-200 border border-gray-200 dark:border-[#4b4b4b]'
              }`}
              title={activeFile.isDirty ? "Save changes to source file (Ctrl+S)" : "No unsaved changes"}
            >
              <Save size={16} /> <span className="hidden sm:inline">Save</span>
            </button>
          )}

          <div className="relative group">
            <button 
              disabled={!activeFile}
              title={!activeFile ? "To export, please open a file" : undefined}
              className={`flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeFile 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer' 
                  : 'bg-gray-200 dark:bg-[#3d3d3d] text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
            >
              <Download size={16} /> <span className="hidden sm:inline">Export</span>
            </button>
            {activeFile && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#363636] rounded-md shadow-lg border border-gray-100 dark:border-[#4b4b4b] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="py-1 flex flex-col">
                  <button onClick={() => handleAction(() => exportToCSV(activeFile.data, activeFile.name), 'Exported as CSV')} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#2a3c49] text-left text-sm w-full cursor-pointer">
                    <TableIcon size={16} /> CSV
                  </button>
                  <button onClick={() => handleAction(() => exportToExcel(activeFile.data, activeFile.name), 'Exported as Excel')} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#2a3c49] text-left text-sm w-full cursor-pointer">
                    <TableIcon size={16} /> Excel (.xlsx)
                  </button>
                  <button onClick={() => handleAction(() => exportToJSON(activeFile.data, activeFile.name), 'Exported as JSON')} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#2a3c49] text-left text-sm w-full cursor-pointer">
                    <FileJson size={16} /> JSON
                  </button>
                  <button onClick={() => handleAction(() => exportToMarkdown(activeFile.data, activeFile.columns.map(c => c.field), activeFile.name), 'Exported as Markdown')} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#2a3c49] text-left text-sm w-full cursor-pointer">
                    <FileCode2 size={16} /> Markdown
                  </button>
                  <div className="h-px bg-gray-200 dark:bg-[#4b4b4b] my-1"></div>
                  <button onClick={() => handleAction(() => copyToClipboardAsCSV(activeFile.data), 'CSV copied to clipboard')} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#2a3c49] text-left text-sm w-full cursor-pointer">
                    <Copy size={16} /> Copy CSV
                  </button>
                  <button onClick={() => handleAction(() => copyToClipboardAsMarkdown(activeFile.data, activeFile.columns.map(c => c.field)), 'Markdown copied to clipboard')} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#2a3c49] text-left text-sm w-full cursor-pointer">
                    <Copy size={16} /> Copy as Markdown
                  </button>
                  <button onClick={() => handleAction(() => copyToGoogleSheets(activeFile.data, activeFile.columns.map(c => c.field)), 'Copied for Google Sheets')} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 dark:hover:bg-[#2a3c49] text-left text-sm w-full cursor-pointer">
                    <Copy size={16} /> Copy for Sheets
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
 
      {/* Tabs */}
      {appState.files.length > 0 && (
        <div className="flex bg-gray-100 dark:bg-[#363636] border-b border-gray-200 dark:border-[#4b4b4b] overflow-x-auto shrink-0 scrollbar-hide">
          {appState.files.map(file => (
            <div 
              key={file.id}
              onClick={() => setAppState(prev => ({ ...prev, activeFileId: file.id }))}
              className={`flex items-center gap-2 px-4 py-2 cursor-pointer border-r border-gray-200 dark:border-[#4b4b4b] text-sm whitespace-nowrap select-none transition-colors ${
                appState.activeFileId === file.id 
                  ? 'bg-white dark:bg-[#2b2b2b] font-medium border-b-2 border-b-blue-600 border-t-2 border-t-transparent' 
                  : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-[#2a3c49] hover:text-gray-700 dark:hover:text-gray-300 border-t-2 border-t-transparent'
              }`}
            >
              <span>{file.name}{file.isDirty ? ' *' : ''}</span>
              <button 
                onClick={(e) => closeTab(file.id, e)} 
                className="p-0.5 rounded-full hover:bg-gray-300 dark:hover:bg-[#4b4b4b] text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button 
            className="flex items-center justify-center px-4 hover:bg-gray-200 dark:hover:bg-[#2a3c49] text-gray-500 cursor-pointer"
            onClick={handleOpenFile}
          >
            <Plus size={18} />
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 relative overflow-hidden flex flex-col items-center justify-center bg-white dark:bg-[#2b2b2b]">
        
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-blue-50/90 dark:bg-blue-900/40 backdrop-blur-sm border-4 border-dashed border-blue-500 flex flex-col items-center justify-center text-blue-600 dark:text-blue-400">
            <FileUp size={64} className="mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold">Drop CSV files here</h2>
          </div>
        )}

        {!activeFile ? (
          <div className="flex flex-col items-center justify-center max-w-md text-center p-8">
            <div className="w-20 h-20 bg-blue-50 dark:bg-[#363636] rounded-2xl flex items-center justify-center mb-6 text-blue-500">
              <TableIcon size={40} className="opacity-80" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Welcome to TweakCSV</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              A lightning-fast, client-side data editor. Everything happens in your browser—no backend, full privacy.
            </p>
            
            <div className="flex flex-col gap-4 w-full">
              <button 
                onClick={handleOpenFile}
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full py-3 rounded-lg font-medium shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <FileUp size={20} /> Open CSV File
              </button>
              
              <div className="bg-gray-50 dark:bg-[#363636] border border-gray-200 dark:border-[#4b4b4b] rounded-lg p-4 flex flex-col items-center text-sm text-gray-500 dark:text-gray-400 border-dashed">
                <p>or drag and drop here</p>
                <p className="text-xs mt-1 opacity-70">You can also paste raw CSV data directly</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full p-2">
             <CsvGrid 
                file={activeFile} 
                onChange={updateActiveFileData} 
                gridApiRef={gridApiRef}
                searchQuery={searchQuery}
                theme={theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme}
             />
          </div>
        )}

        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept=".csv,text/csv" 
          multiple 
          onChange={(e) => handleFileUpload(e.target.files)} 
        />

        {isFindReplaceOpen && activeFile && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white dark:bg-[#363636] p-4 sm:p-6 rounded-xl shadow-xl w-full max-w-md border border-gray-200 dark:border-[#4b4b4b] overflow-y-auto max-h-[90vh]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Find and Replace</h3>
                <button onClick={() => setIsFindReplaceOpen(false)} className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer">
                  <X size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Find</label>
                  <input type="text" className="w-full px-3 py-2 border rounded border-gray-300 dark:border-[#4b4b4b] bg-transparent text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500" value={findText} onChange={e => setFindText(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Replace with</label>
                  <input type="text" className="w-full px-3 py-2 border rounded border-gray-300 dark:border-[#4b4b4b] bg-transparent text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500" value={replaceText} onChange={e => setReplaceText(e.target.value)} />
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                   <div className="flex-1 w-full">
                     <label className="block text-sm font-medium mb-1">Target Column</label>
                     <select className="w-full px-3 py-2 border rounded border-gray-300 dark:border-[#4b4b4b] bg-white dark:bg-[#2b2b2b] text-sm outline-none focus:border-blue-500 dark:focus:border-blue-500" value={targetColumn} onChange={e => setTargetColumn(e.target.value)}>
                       <option value="">All Columns</option>
                       {activeFile.columns.map(c => (
                         <option key={c.field} value={c.field}>{c.headerName || c.field}</option>
                       ))}
                     </select>
                   </div>
                   <div className="flex items-center gap-2 sm:mt-6">
                     <input type="checkbox" id="matchCase" checked={matchCase} onChange={e => setMatchCase(e.target.checked)} className="cursor-pointer" />
                     <label htmlFor="matchCase" className="text-sm cursor-pointer">Match Case</label>
                   </div>
                </div>
                <div className="flex justify-end gap-2 mt-4 sm:mt-6">
                  <button onClick={() => setIsFindReplaceOpen(false)} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-[#2a3c49] rounded cursor-pointer">Cancel</button>
                  <button onClick={handleReplace} className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded cursor-pointer">
                    Replace All
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Toast Notification */}
        <div className={`fixed bottom-4 right-4 z-[60] transition-all duration-300 transform ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}>
          <div className={`flex items-center gap-2 px-4 py-3 rounded shadow-lg border ${toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-400'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="ml-4 opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
