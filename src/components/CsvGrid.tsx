import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { AgGridReact, AgGridProvider } from 'ag-grid-react';
import { ColDef, GridReadyEvent, GridApi, AllCommunityModule, themeAlpine, colorSchemeDark } from 'ag-grid-community';
import { CsvFile } from '../lib/storage';

const modules = [AllCommunityModule];

interface CsvGridProps {
  file: CsvFile;
  onDirty: () => void;
  onRowDragEnd: () => void;
  gridApiRef: React.MutableRefObject<GridApi | null>;
  searchQuery?: string;
  theme?: string;
}

/**
 * AG-Grid Wrapper Component.
 * Supports features like undo/redo, row dragging, search filtering,
 * and handles horizontal scrolling automatically when number of columns
 * multiplied by minWidth exceeds the container width.
 *
 * Data is owned internally by AG Grid so that undoRedoCellEditing works
 * correctly. The parent reads data from gridApiRef just-in-time (save/export)
 * rather than on every cell change which would reset the undo stack.
 */
export const CsvGrid: React.FC<CsvGridProps> = ({ file, onDirty, onRowDragEnd, gridApiRef, searchQuery, theme }) => {
  const gridRef = useRef<AgGridReact>(null);

  const gridTheme = useMemo(() => {
    return theme === 'dark' ? themeAlpine.withPart(colorSchemeDark) : themeAlpine;
  }, [theme]);

  // Extend column definitions with sorting, resizing, filtering
  const defaultColDef = useMemo<ColDef>(() => {
    return {
      flex: 1,
      minWidth: 100,
      editable: true,
      sortable: true,
      filter: true,
      resizable: true,
    };
  }, []);

  const columnDefs = useMemo(() => {
    if (!file.columns || file.columns.length === 0) return [];
    
    const dragColumn: ColDef = {
      headerName: '',
      field: '_dragHandle',
      rowDrag: true,
      width: 40,
      minWidth: 40,
      maxWidth: 40,
      sortable: false,
      filter: false,
      editable: false,
      resizable: false,
      pinned: 'left',
      lockPosition: 'left',
    };
    
    return [dragColumn, ...file.columns];
  }, [file.columns]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    gridApiRef.current = params.api;
    if (searchQuery) {
      params.api.setGridOption('quickFilterText', searchQuery);
    }
  }, [gridApiRef, searchQuery]);

  // Only notify parent that data is dirty — do NOT push row data here.
  // Pushing data on every cell change would reset AG Grid's undo stack.
  const handleCellValueChanged = useCallback(() => {
    onDirty();
  }, [onDirty]);

  // Row drag re-orders data; flush back to parent and mark dirty.
  const handleRowDragEnd = useCallback(() => {
    onRowDragEnd();
  }, [onRowDragEnd]);

  useEffect(() => {
    if (gridApiRef.current && searchQuery !== undefined) {
      gridApiRef.current.setGridOption('quickFilterText', searchQuery);
    }
  }, [searchQuery, gridApiRef]);

  return (
    <div className="w-full h-full">
      <AgGridProvider modules={modules}>
        <AgGridReact
          theme={gridTheme}
          ref={gridRef}
          rowData={file.data}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowDragManaged={true}
          animateRows={true}
          undoRedoCellEditing={true}
          undoRedoCellEditingLimit={20}
          onGridReady={onGridReady}
          onCellValueChanged={handleCellValueChanged}
          onRowDragEnd={handleRowDragEnd}
          suppressScrollOnNewData={true}
        />
      </AgGridProvider>
    </div>
  );
};
