import React, { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, FileSpreadsheet, AlertCircle, FileText } from 'lucide-react';
import { RawTicket, Ticket } from '../types';
import { parseRawData } from '../utils';

interface DataUploadProps {
  onDataLoaded: (tickets: Ticket[]) => void;
}

export const DataUpload: React.FC<DataUploadProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    setLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet);

      if (!rawData || rawData.length === 0) {
        throw new Error("The file appears to be empty.");
      }

      // Robust Column Mapping with Fuzzy Matching
      const normalizeHeader = (h: string) => h.toLowerCase().trim().replace(/[\s_-]/g, '');
      
      const columnMap: Record<string, string> = {
        // Ticket Type
        'tickettype': 'TicketType', 'type': 'TicketType', 'module': 'TicketType', 
        'category': 'TicketType', 'classification': 'TicketType', 'item': 'TicketType', 'issuetype': 'TicketType',

        // Resolution Date
        'resolutionby': 'ResolutionBy', 'resolveddate': 'ResolutionBy', 
        'resolvedon': 'ResolutionBy', 'completedon': 'ResolutionBy', 'closedon': 'ResolutionBy', 'resolutiontime': 'ResolutionBy',

        // Assignees
        'assignedto': 'Assign', 'assign': 'Assign', 'assignee': 'Assign', 
        'assignees': 'Assign', 'agent': 'Assign', 'handledby': 'Assign', 'allocatedto': 'Assign', 'user': 'Assign',

        // Creation Date
        'createdon': 'Creation', 'creation': 'Creation', 'created': 'Creation', 
        'date': 'Creation', 'opendate': 'Creation', 'timestamp': 'Creation', 'postingdate': 'Creation', 'submittedon': 'Creation',

        // Subject
        'subject': 'Subject', 'title': 'Subject', 'issue': 'Subject', 'description': 'Subject', 'summary': 'Subject', 'name': 'Subject',

        // Status
        'workflowstate': 'Status', 'state': 'Status', 'status': 'Status', 'stage': 'Status', 'currentstatus': 'Status',

        // Customer
        'customer': 'Customer', 'client': 'Customer', 'caller': 'Customer', 'raisedby': 'Customer', 'contact': 'Customer', 'sender': 'Customer',

        // Priority
        'priority': 'Priority', 'urgency': 'Priority', 'severity': 'Priority', 'impact': 'Priority',

        // Owner
        'owner': 'Owner', 'createdby': 'Owner', 'author': 'Owner',

        // Rating
        'rating': 'Rating', 'feedback': 'Rating', 'csat': 'Rating', 'score': 'Rating', 'stars': 'Rating',

        // ID
        'sr': 'Sr', 'id': 'Sr', 'ticketid': 'Sr', 'number': 'Sr', 'ref': 'Sr'
      };

      const jsonData = rawData.map((row: any) => {
        const newRow: any = {};
        Object.keys(row).forEach(key => {
            const normalized = normalizeHeader(key);
            if (columnMap[normalized]) {
                newRow[columnMap[normalized]] = row[key];
            } else {
                newRow[key] = row[key];
            }
        });
        
        // Defaults if missing
        if (!newRow.TicketType) newRow.TicketType = 'Unspecified';
        if (!newRow.Status) newRow.Status = 'Open';
        if (!newRow.Subject) newRow.Subject = 'No Subject';
        
        // Fallback for Assign if missing, try Owner, else Unassigned
        if (!newRow.Assign && newRow.Owner) newRow.Assign = newRow.Owner;
        
        return newRow;
      }) as RawTicket[];

      const tickets = parseRawData(jsonData);
      
      if (tickets.length === 0) {
        throw new Error("Could not parse any tickets. Please check your column headers.");
      }

      onDataLoaded(tickets);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center transition-colors">
        <div className="mb-6 flex justify-center">
          <div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-full">
            <FileSpreadsheet className="w-12 h-12 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Upload Data File</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Upload your Helpdesk export (Excel or CSV). Data will be <strong>saved locally</strong> to your browser.
        </p>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-xl p-10 transition-all cursor-pointer
            flex flex-col items-center justify-center
            ${isDragging 
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            }
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept=".csv, .xlsx, .xls" 
            className="hidden" 
          />
          
          {loading ? (
             <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 dark:border-indigo-400 mb-4"></div>
                <p className="text-gray-600 dark:text-gray-300 font-medium">Processing & Saving...</p>
             </div>
          ) : (
            <>
              <UploadCloud className={`w-12 h-12 mb-4 ${isDragging ? 'text-indigo-600' : 'text-gray-400 dark:text-gray-500'}`} />
              <p className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-1">
                Click to upload or drag and drop
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                XLSX, XLS, or CSV (max 10MB)
              </p>
            </>
          )}
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-lg flex items-center text-left">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800 dark:text-red-300">Upload Failed</p>
              <p className="text-sm text-red-700 dark:text-red-400 whitespace-pre-line">{error}</p>
            </div>
          </div>
        )}

        <div className="mt-8 text-left bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg border border-gray-100 dark:border-gray-700">
          <h4 className="font-semibold text-gray-700 dark:text-gray-200 text-sm mb-2 flex items-center">
             <FileText className="w-4 h-4 mr-2" />
             Common Column Mappings
          </h4>
          <div className="flex flex-wrap gap-2">
             <span className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-300">Ticket Type / Module</span>
             <span className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-300">Status / State</span>
             <span className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-300">Assign To / Agent</span>
             <span className="text-xs bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 px-2 py-1 rounded text-gray-600 dark:text-gray-300">Created On / Date</span>
          </div>
        </div>
      </div>
    </div>
  );
};