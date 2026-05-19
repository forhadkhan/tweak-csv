/**
 * Utility functions for parsing, processing, and exporting CSV data.
 * Leverages PapaParse for CSV mapping and SheetJS for Excel exports.
 */
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export const parseFileToCSV = async (file: File): Promise<{ data: any[], columns: any[] }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          reject(new Error("Failed to parse CSV: " + results.errors[0].message));
          return;
        }

        const data = results.data;
        let fields: string[] = [];
        
        if (results.meta.fields && results.meta.fields.length > 0) {
          fields = results.meta.fields;
        } else if (data.length > 0) {
          fields = Object.keys(data[0] as object);
        }

        const columns = fields.map(f => ({
          field: f,
          headerName: f,
          editable: true,
        }));

        resolve({ data, columns });
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};

export const parseRawCsvString = (csvString: string): { data: any[], columns: any[] } => {
    const results = Papa.parse(csvString, { header: true, skipEmptyLines: true });
    if (results.errors.length > 0 && results.data.length === 0) {
        throw new Error("Failed to parse CSV string: " + results.errors[0].message);
    }

    const data = results.data;
    let fields: string[] = [];
    
    if (results.meta.fields && results.meta.fields.length > 0) {
      fields = results.meta.fields;
    } else if (data.length > 0) {
      fields = Object.keys(data[0] as object);
    }

    const columns = fields.map(f => ({
      field: f,
      headerName: f,
      editable: true,
    }));

    return { data, columns };
};

export const exportToCSV = (data: any[], filename: string) => {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filename.endsWith('.csv') ? filename : `${filename}.csv`);
};

export const exportToJSON = (data: any[], filename: string) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
};

export const exportToExcel = (data: any[], filename: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
  const extension = '.xlsx';
  XLSX.writeFile(workbook, filename.endsWith(extension) ? filename : `${filename}${extension}`);
};

export const copyToGoogleSheets = async (data: any[], fields: string[]) => {
  // Map data to a TSV format which is perfectly pasted into Google Sheets.
  // We need to keep header order.
  const headerRow = fields.join('\t');
  const rows = data.map(item => fields.map(f => item[f] ?? '').join('\t'));
  const tsv = [headerRow, ...rows].join('\n');
  
  await navigator.clipboard.writeText(tsv);
};

export const copyToClipboardAsCSV = async (data: any[]) => {
  const csv = Papa.unparse(data);
  await navigator.clipboard.writeText(csv);
};

export const exportToMarkdown = (data: any[], fields: string[], filename: string) => {
  if (data.length === 0) return;
  
  let md = '| ' + fields.join(' | ') + ' |\n';
  md += '| ' + fields.map(() => '---').join(' | ') + ' |\n';
  
  data.forEach(item => {
    md += '| ' + fields.map(f => String(item[f] ?? '').replace(/\|/g, '\\|')).join(' | ') + ' |\n';
  });
  
  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
  downloadBlob(blob, filename.replace(/\.[^/.]+$/, "") + '.md');
};

export const copyToClipboardAsMarkdown = async (data: any[], fields: string[]) => {
  if (data.length === 0) return;
  
  let md = '| ' + fields.join(' | ') + ' |\n';
  md += '| ' + fields.map(() => '---').join(' | ') + ' |\n';
  
  data.forEach(item => {
    md += '| ' + fields.map(f => String(item[f] ?? '').replace(/\|/g, '\\|')).join(' | ') + ' |\n';
  });
  
  await navigator.clipboard.writeText(md);
};

export const prettifyCsv = (data: any[]): string => {
  return Papa.unparse(data, {
      quotes: false, 
      quoteChar: '"',
      escapeChar: '"',
      delimiter: ",",
      header: true,
      newline: "\r\n",
    });
}

export const getCSVString = (data: any[]): string => {
  return Papa.unparse(data);
};

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
