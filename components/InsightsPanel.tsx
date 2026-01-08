import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, UserCheck, TrendingDown, Users, Layers, RefreshCw } from 'lucide-react';
import { Ticket, AgentMetrics, AIRecommendation } from '../types';
import { getAIInsights } from '../services/geminiService';

interface InsightsPanelProps {
  tickets: Ticket[];
  agents: AgentMetrics[];
  timeRangeLabel: string;
}

const CACHE_KEY = 'helpdesk_insights_cache';

export const InsightsPanel: React.FC<InsightsPanelProps> = ({ tickets, agents, timeRangeLabel }) => {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<AIRecommendation | null>(null);

  // Load from cache when time range changes
  useEffect(() => {
    try {
      const cacheStr = localStorage.getItem(CACHE_KEY);
      if (cacheStr) {
        const cache = JSON.parse(cacheStr);
        if (cache[timeRangeLabel]) {
          setInsight(cache[timeRangeLabel]);
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load insights cache", e);
    }
    setInsight(null);
  }, [timeRangeLabel]);

  // We do NOT automatically clear insights when tickets change slightly to avoid flickering,
  // but the user can manually regenerate.
  // Major data changes (uploads) clear the cache in App.tsx.

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const result = await getAIInsights(tickets, agents, timeRangeLabel);
      setInsight(result);
      
      // Save to cache
      try {
        const cacheStr = localStorage.getItem(CACHE_KEY);
        const cache = cacheStr ? JSON.parse(cacheStr) : {};
        cache[timeRangeLabel] = result;
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (e) {
        console.error("Failed to save insight to cache", e);
      }

    } catch (e) {
      alert("Failed to generate insights. Ensure API Key is valid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-indigo-900 rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between shadow-xl relative overflow-hidden">
        {/* Decorative Circles */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-indigo-800 opacity-50 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full bg-purple-800 opacity-50 blur-3xl"></div>

        <div className="relative z-10 mb-6 md:mb-0">
          <h2 className="text-3xl font-bold mb-2 flex items-center">
            <Sparkles className="mr-3 text-yellow-400" /> 
            AI Intelligence Hub
          </h2>
          <p className="text-indigo-200 max-w-lg">
            Generating insights for: <span className="font-semibold text-white">{timeRangeLabel}</span>.
            Get resource recommendations, performance analysis, and strategies to reduce tickets.
          </p>
        </div>
        
        <button 
          onClick={handleGenerate}
          disabled={loading || tickets.length === 0}
          className={`relative z-10 px-6 py-3 bg-white text-indigo-900 font-bold rounded-lg shadow-lg hover:bg-indigo-50 transition-all transform hover:scale-105 flex items-center ${loading || tickets.length === 0 ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          {loading ? (
            <span className="flex items-center"><span className="animate-spin mr-2 h-4 w-4 border-2 border-indigo-900 border-t-transparent rounded-full"></span> Analyzing...</span>
          ) : (
            <span className="flex items-center">
                {insight ? <RefreshCw className="mr-2 w-4 h-4" /> : <ArrowRight className="mr-2 w-4 h-4" />}
                {insight ? 'Regenerate Analysis' : 'Analyze Data'}
            </span>
          )}
        </button>
      </div>

      {insight && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
          {/* Executive Summary */}
          <div className="col-span-1 md:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
              Executive Summary <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">({insight.periodContext})</span>
            </h3>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {insight.summary}
            </p>
          </div>

          {/* Team Analysis - New Section */}
          <div className="col-span-1 md:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
             <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
              <Layers className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              Team Level Recommendations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {insight.teamAnalysis?.map((team, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2">{team.teamName}</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{team.insight}</p>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">💡 {team.recommendation}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Resource Allocation */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-l-4 border-l-blue-500 dark:border-l-blue-500 transition-colors">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center">
              <Users className="w-5 h-5 mr-2 text-blue-500" />
              Resource Allocation
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{insight.resourceAllocation}</p>
          </div>

          {/* Ticket Reduction */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-l-4 border-l-green-500 dark:border-l-green-500 transition-colors">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center">
              <TrendingDown className="w-5 h-5 mr-2 text-green-500" />
              Reduction Strategy
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm">{insight.ticketReductionStrategy}</p>
          </div>

          {/* Performance Spotlight */}
          <div className="col-span-1 md:col-span-2 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
             <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
              <UserCheck className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              Individual Performance Spotlight
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                <span className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-wider">Top Performer</span>
                <p className="font-bold text-gray-800 dark:text-gray-200 mt-1">{insight.agentPerformance.topPerformer}</p>
              </div>
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Needs Attention</span>
                <p className="font-bold text-gray-800 dark:text-gray-200 mt-1">{insight.agentPerformance.needsAttention}</p>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-2 italic">"{insight.agentPerformance.suggestion}"</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};