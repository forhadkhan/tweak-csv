import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { AgGridReact, AgGridProvider } from 'ag-grid-react';
import { ColDef, GridReadyEvent, GridApi, AllCommunityModule, themeAlpine, colorSchemeDark } from 'ag-grid-community';
import { CsvFile } from '../lib/storage';

const modules = [AllCommunityModule];

interface CsvGridProps {
  file: CsvFile;
  onChange: (data: any[], columns: any[]) => void;
  gridApiRef: React.MutableRefObject<GridApi | null>;
  searchQuery?: string;
  theme?: string;
}

/**
 * AG-Grid Wrapper Component.
 * Supports features like undo/redo, row dragging, search filtering,
 * and handles horizontal scrolling automatically when number of columns
 * multiplied by minWidth exceeds the container width.
 */
export const CsvGrid: React.FC<CsvGridProps> = ({ file, onChange, gridApiRef, searchQuery, theme }) => {
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

  const onCellValueChanged = useCallback(() => {
    if (gridApiRef.current) {
      const rowData: any[] = [];
      gridApiRef.current.forEachNode(node => rowData.push(node.data));
      onChange(rowData, file.columns); // notify parent about data change
    }
  }, [gridApiRef, onChange, file.columns]);

  const onRowDragEnd = useCallback(() => {
    if (gridApiRef.current) {
      const rowData: any[] = [];
      gridApiRef.current.forEachNode(node => rowData.push(node.data));
      onChange(rowData, file.columns); 
    }
  }, [gridApiRef, onChange, file.columns]);

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
          undoRedoCellEditing={true} // Enable Undo / Redo
          undoRedoCellEditingLimit={20}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          onRowDragEnd={onRowDragEnd}
          suppressScrollOnNewData={true}
        />
      </AgGridProvider>
    </div>
  );
};
