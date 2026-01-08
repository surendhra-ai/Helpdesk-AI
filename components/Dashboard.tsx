import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Ticket, AgentMetrics } from '../types';
import { StatsCard } from './StatsCard';
import { Ticket as TicketIcon, Clock, AlertCircle, BarChart2, Users } from 'lucide-react';
import { DashboardSkeleton } from './Skeletons';

interface DashboardProps {
  tickets: Ticket[];
  previousTickets?: Ticket[];
  agents: AgentMetrics[];
  isLoading?: boolean;
  isDarkMode?: boolean;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6', '#64748b'];

export const Dashboard: React.FC<DashboardProps> = ({ tickets, previousTickets = [], agents, isLoading, isDarkMode }) => {
  
  const stats = useMemo(() => {
    const calculateStats = (data: Ticket[]) => {
        const total = data.length;
        const open = data.filter(t => t.status !== 'Closed').length;
        const closed = data.filter(t => t.status === 'Closed').length;
        const resolutionSum = data.reduce((acc, t) => acc + (t.status === 'Closed' ? t.resolutionTimeHours : 0), 0);
        const avgResolution = closed > 0 ? resolutionSum / closed : 0;
        const ratingSum = data.reduce((acc, t) => acc + (t.status === 'Closed' ? t.rating : 0), 0);
        const avgRating = closed > 0 ? ratingSum / closed : 0;
        return { total, open, closed, avgResolution, avgRating };
    };

    const current = calculateStats(tickets);
    const prev = calculateStats(previousTickets);

    // Helper for percentage diff
    const getPctDiff = (curr: number, pre: number) => {
        if (pre === 0) return curr === 0 ? 0 : 100;
        return ((curr - pre) / pre) * 100;
    };

    const formatTrend = (diff: number, suffix = '%') => {
        return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}${suffix}`;
    };

    const totalDiff = getPctDiff(current.total, prev.total);
    const resolutionDiff = getPctDiff(current.avgResolution, prev.avgResolution);
    const ratingDiff = current.avgRating - prev.avgRating; // Absolute diff for rating
    const openDiff = getPctDiff(current.open, prev.open);

    return { 
        current, 
        trends: {
            total: {
                text: formatTrend(totalDiff),
                isPositive: totalDiff <= 0 
            },
            resolution: {
                text: formatTrend(resolutionDiff),
                isPositive: resolutionDiff <= 0
            },
            rating: {
                text: formatTrend(ratingDiff, ''),
                isPositive: ratingDiff >= 0
            },
            open: {
                text: formatTrend(openDiff),
                isPositive: openDiff <= 0
            }
        }
    };
  }, [tickets, previousTickets]);

  const ticketByType = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => {
      // Ensure ticketType is a string and has a value
      const type = (t.ticketType || 'Unspecified').trim() || 'Unspecified';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.keys(counts)
        .map(key => ({ name: key, value: counts[key] }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Limit to top 10 types to prevent legend clutter
  }, [tickets]);

  const agentLoad = useMemo(() => {
    return agents.map(a => ({
      name: a.email.split('@')[0] || 'Unknown',
      tickets: a.totalTickets,
      rating: parseFloat(a.avgRating.toFixed(1))
    })).slice(0, 10); // Top 10
  }, [agents]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Chart Theme Helpers
  const chartTextColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const chartGridColor = isDarkMode ? '#374151' : '#e5e7eb';
  const tooltipStyle = {
      backgroundColor: isDarkMode ? '#1f2937' : '#fff',
      borderColor: isDarkMode ? '#374151' : '#f3f4f6',
      color: isDarkMode ? '#f3f4f6' : '#1f2937',
      borderRadius: '8px', 
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Total Tickets" 
          value={stats.current.total} 
          icon={<TicketIcon size={20} />} 
          trend={stats.trends.total.text} 
          trendUp={stats.trends.total.isPositive} 
        />
        <StatsCard 
          title="Avg Resolution Time" 
          value={`${stats.current.avgResolution.toFixed(1)} hrs`} 
          icon={<Clock size={20} />} 
          trend={stats.trends.resolution.text} 
          trendUp={stats.trends.resolution.isPositive} 
        />
        <StatsCard 
          title="CSAT Rating" 
          value={`${stats.current.avgRating.toFixed(1)} / 5`} 
          icon={<Users size={20} />} 
          trend={stats.trends.rating.text} 
          trendUp={stats.trends.rating.isPositive} 
        />
        <StatsCard 
          title="Pending Tickets" 
          value={stats.current.open} 
          icon={<AlertCircle size={20} />} 
          trend={stats.trends.open.text} 
          trendUp={stats.trends.open.isPositive} 
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[450px] transition-colors">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Ticket Distribution by Type</h3>
          <div className="w-full h-full min-h-0">
            {ticketByType.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" key={`pie-${tickets.length}-${isDarkMode}`}>
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                    data={ticketByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => percent > 0.05 ? `${(name || '').substring(0, 15)}...` : ''} 
                    outerRadius="80%"
                    fill="#8884d8"
                    dataKey="value"
                    >
                    {ticketByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ color: chartTextColor }} />
                </PieChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                    <BarChart2 className="w-12 h-12 mb-2 opacity-20" />
                    <p>No ticket data available for this period</p>
                </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col h-[450px] transition-colors">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">Agent Workload vs Rating</h3>
          <div className="w-full h-full min-h-0">
            {agentLoad.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" key={`bar-${tickets.length}-${isDarkMode}`}>
                <BarChart data={agentLoad} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGridColor} />
                    <XAxis 
                        dataKey="name" 
                        tick={{fontSize: 11, fill: chartTextColor}}
                        interval={0}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                        stroke={chartGridColor}
                    />
                    <YAxis yAxisId="left" orientation="left" stroke="#6366f1" tick={{fontSize: 12, fill: chartTextColor}} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" domain={[0, 5]} tick={{fontSize: 12, fill: chartTextColor}} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{fill: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}} />
                    <Legend verticalAlign="top" height={36} wrapperStyle={{ color: chartTextColor }} />
                    <Bar yAxisId="left" dataKey="tickets" name="Tickets" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    <Bar yAxisId="right" dataKey="rating" name="Avg Rating" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                    <BarChart2 className="w-12 h-12 mb-2 opacity-20" />
                    <p>No agent data available for this period</p>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};