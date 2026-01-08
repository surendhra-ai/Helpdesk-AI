import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BrainCircuit, 
  Settings, 
  Menu,
  FileText,
  Upload,
  Calendar,
  Bot,
  Trash2,
  Sun,
  Moon
} from 'lucide-react';
import { Ticket, AgentMetrics, AppView, RawTicket, TimeRange } from './types';
import { calculateAgentMetrics, generateMockData, filterTickets, getPreviousPeriodTickets } from './utils';
import { Dashboard } from './components/Dashboard';
import { InsightsPanel } from './components/InsightsPanel';
import { DataUpload } from './components/DataUpload';
import { AgentTableSkeleton } from './components/Skeletons';
import { AIAssistant } from './components/AIAssistant';

export default function App() {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('last-30-days');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('theme');
        if (saved) return saved as 'light' | 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });
  
  // Initialize Tickets from LocalStorage or Mock
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  useEffect(() => {
    const loadData = () => {
        setIsLoading(true);
        try {
            const savedData = localStorage.getItem('helpdesk_db_tickets');
            if (savedData) {
                const parsed = JSON.parse(savedData, (key, value) => {
                    // Revive dates
                    if (key === 'createdAt' || key === 'resolvedAt') {
                        return value ? new Date(value) : null;
                    }
                    return value;
                });
                if (parsed.length > 0) {
                   setTickets(parsed);
                   // Default to ALL time for loaded data to ensure visibility
                   setTimeRange('all'); 
                   setIsLoading(false);
                   return;
                }
            }
        } catch (e) {
            console.error("Failed to load from DB", e);
        }

        // Fallback to mock data if nothing saved
        const timer = setTimeout(() => {
            const initialData = generateMockData();
            setTickets(initialData);
            setIsLoading(false);
        }, 1000);
        return () => clearTimeout(timer);
    };

    loadData();
  }, []);

  // Filter tickets based on selected time range
  const filteredTickets = useMemo(() => {
    return filterTickets(tickets, timeRange);
  }, [tickets, timeRange]);

  // Get tickets for the previous period for trend analysis
  const previousPeriodTickets = useMemo(() => {
    return getPreviousPeriodTickets(tickets, timeRange);
  }, [tickets, timeRange]);

  // Calculate metrics based on FILTERED tickets
  const filteredAgents = useMemo(() => {
    return calculateAgentMetrics(filteredTickets);
  }, [filteredTickets]);

  const handleDataLoaded = (newTickets: Ticket[]) => {
    setIsLoading(true);
    setTickets(newTickets);
    // SAVE TO DATABASE (LocalStorage)
    try {
        localStorage.setItem('helpdesk_db_tickets', JSON.stringify(newTickets));
        // Clear cached insights because data has changed
        localStorage.removeItem('helpdesk_insights_cache');
    } catch(e) {
        console.error("Quota exceeded", e);
        alert("Data too large to save locally, but analysis will work for this session.");
    }

    setTimeRange('all');
    setView(AppView.DASHBOARD);
    setTimeout(() => setIsLoading(false), 800);
  };

  const handleClearData = () => {
      if(confirm("Are you sure you want to clear the database? This will reset to default demo data.")) {
          localStorage.removeItem('helpdesk_db_tickets');
          localStorage.removeItem('helpdesk_insights_cache');
          window.location.reload();
      }
  };

  const handleTimeRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setIsLoading(true);
      setTimeRange(e.target.value as TimeRange);
      setTimeout(() => setIsLoading(false), 600);
  };

  // Generate Data Context for AI
  const aiDataContext = useMemo(() => {
     const total = filteredTickets.length;
     const open = filteredTickets.filter(t => t.status !== 'Closed').length;
     const closed = filteredTickets.filter(t => t.status === 'Closed').length;
     const avgRating = filteredAgents.length > 0 
        ? (filteredAgents.reduce((acc, a) => acc + a.avgRating, 0) / filteredAgents.length).toFixed(1) 
        : '0';
     const topAgent = filteredAgents.length > 0 ? filteredAgents[0].email : 'N/A';
     
     return `
        Total Tickets: ${total}
        Open Tickets: ${open}
        Closed Tickets: ${closed}
        Average Agent Rating: ${avgRating}/5
        Top Agent by Volume: ${topAgent}
        Time Period: ${timeRange}
        
        Ticket Types: ${Array.from(new Set(filteredTickets.map(t => t.ticketType))).join(', ')}
     `;
  }, [filteredTickets, filteredAgents, timeRange]);

  const navItems = [
    { id: AppView.DASHBOARD, label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
    { id: AppView.AGENTS, label: 'Agent Performance', icon: <Users size={20} /> },
    { id: AppView.AI_INSIGHTS, label: 'AI Insights', icon: <BrainCircuit size={20} /> },
    { id: AppView.AI_ASSISTANT, label: 'AI Assistant', icon: <Bot size={20} /> },
    { id: AppView.DATA_UPLOAD, label: 'Upload Data', icon: <Upload size={20} /> },
  ];

  const getTimeRangeLabel = (range: TimeRange) => {
    switch(range) {
      case 'last-7-days': return 'Last 7 Days';
      case 'last-30-days': return 'Last 30 Days';
      case 'this-month': return 'This Month';
      case 'last-month': return 'Last Month';
      case 'all': return 'All Time';
      default: return 'Custom';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-200">
      {/* Sidebar */}
      <aside className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col fixed h-full z-20`}>
        <div className="h-16 flex items-center justify-center border-b border-gray-100 dark:border-gray-700">
            {isSidebarOpen ? (
                <div className="flex items-center gap-2 font-bold text-xl text-indigo-600 dark:text-indigo-400">
                    <BrainCircuit /> HelpdeskAI
                </div>
            ) : (
                <BrainCircuit className="text-indigo-600 dark:text-indigo-400" />
            )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center p-3 rounded-lg transition-colors ${
                view === item.id 
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium' 
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {isSidebarOpen && <span className="ml-3">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
             <button
              onClick={toggleTheme}
              className="w-full flex items-center p-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm font-medium"
             >
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                {isSidebarOpen && <span className="ml-3">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
             </button>

             <button
              onClick={handleClearData}
              className="w-full flex items-center p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium"
              title="Reset Database"
             >
                <Trash2 size={20} />
                {isSidebarOpen && <span className="ml-3">Reset Data</span>}
             </button>

             <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-full flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Menu size={20} />
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 px-8 flex items-center justify-between transition-colors duration-200">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white">
                {navItems.find(i => i.id === view)?.label}
            </h1>
            
            <div className="flex items-center gap-6">
                {/* Time Range Selector */}
                 <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-gray-500 dark:text-gray-400" />
                    <select 
                      value={timeRange}
                      onChange={handleTimeRangeChange}
                      className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
                    >
                      <option value="last-7-days">Last 7 Days</option>
                      <option value="last-30-days">Last 30 Days</option>
                      <option value="this-month">This Month</option>
                      <option value="last-month">Last Month</option>
                      <option value="all">All Time</option>
                    </select>
                 </div>

                 <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

                 <div className="flex items-center gap-4">
                     <div className="text-sm text-gray-500 dark:text-gray-400">
                        DB Status: <span className="font-medium text-green-600 dark:text-green-400">
                          {localStorage.getItem('helpdesk_db_tickets') ? 'Saved Locally' : 'Demo Mode'}
                        </span>
                     </div>
                     <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
                        AD
                     </div>
                </div>
            </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {view === AppView.DASHBOARD && (
            <Dashboard 
              tickets={filteredTickets} 
              previousTickets={previousPeriodTickets}
              agents={filteredAgents}
              isLoading={isLoading}
              isDarkMode={theme === 'dark'}
            />
          )}

          {view === AppView.AGENTS && (
            isLoading ? <AgentTableSkeleton /> : (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in transition-colors">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                   <h3 className="font-semibold text-gray-700 dark:text-gray-200">Performance Report: {getTimeRangeLabel(timeRange)}</h3>
                   <span className="text-xs text-gray-500 dark:text-gray-400">{filteredTickets.length} tickets analyzed</span>
                </div>
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                            <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Agent</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Total Tickets</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Active</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Avg Resolution</th>
                            <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Rating</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredAgents.length > 0 ? (
                            filteredAgents.map((agent, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100">{agent.email}</td>
                                    <td className="p-4 text-gray-600 dark:text-gray-300">{agent.totalTickets}</td>
                                    <td className="p-4">
                                        <span className="px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
                                            {agent.activeTickets} Active
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600 dark:text-gray-300">{agent.avgResolutionHours.toFixed(2)} hrs</td>
                                    <td className="p-4">
                                        <div className="flex items-center">
                                            <span className={`font-bold mr-2 ${agent.avgRating >= 4 ? 'text-green-600 dark:text-green-400' : agent.avgRating >= 3 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {agent.avgRating.toFixed(1)}
                                            </span>
                                            <span className="text-xs text-gray-400">/ 5</span>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-gray-500 dark:text-gray-400">
                                    No data available. Try selecting 'All Time' or upload a file.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            )
          )}

          {view === AppView.AI_INSIGHTS && (
            <InsightsPanel 
              tickets={filteredTickets} 
              agents={filteredAgents} 
              timeRangeLabel={getTimeRangeLabel(timeRange)}
            />
          )}

          {view === AppView.AI_ASSISTANT && (
            <AIAssistant dataContext={aiDataContext} />
          )}

          {view === AppView.DATA_UPLOAD && (
            <DataUpload onDataLoaded={handleDataLoaded} />
          )}
        </div>
      </main>
    </div>
  );
}