import React, { useState } from 'react';
import { Save, Server, Key, Globe, CheckCircle, AlertCircle, Bot } from 'lucide-react';
import { LLMSettings, LLMProvider } from '../types';
import { checkHealth } from '../services/aiService';

interface SettingsProps {
  currentSettings: LLMSettings;
  onSave: (settings: LLMSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ currentSettings, onSave }) => {
  const [settings, setSettings] = useState<LLMSettings>(currentSettings);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (field: keyof LLMSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setTestStatus('idle');
  };

  const handleProviderChange = (provider: LLMProvider) => {
    let defaults: Partial<LLMSettings> = { provider };
    
    if (provider === 'gemini') {
      defaults.modelName = 'gemini-3-flash-preview';
      defaults.apiKey = ''; // Cleared as we use env
      defaults.baseURL = '';
    } else if (provider === 'openai') {
      defaults.modelName = 'gpt-4o';
      defaults.baseURL = 'https://api.openai.com/v1';
    } else if (provider === 'custom') {
      defaults.modelName = 'llama-3-70b';
      defaults.baseURL = 'http://localhost:11434/v1';
    }

    setSettings(prev => ({ ...prev, ...defaults }));
    setTestStatus('idle');
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus('idle');
    const healthy = await checkHealth(settings);
    setTestStatus(healthy ? 'success' : 'error');
    setIsTesting(false);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
            <Server className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
            LLM Provider Configuration
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Select which AI model handles your data analysis and chat.
          </p>
        </div>

        <div className="p-8 space-y-6">
          {/* Provider Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">AI Provider</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleProviderChange('gemini')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  settings.provider === 'gemini'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="font-bold text-gray-800 dark:text-white mb-1">Google Gemini</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Default. Uses system environment keys.</div>
              </button>

              <button
                onClick={() => handleProviderChange('openai')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  settings.provider === 'openai'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="font-bold text-gray-800 dark:text-white mb-1">OpenAI</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Compatible with GPT-4, GPT-3.5.</div>
              </button>

              <button
                onClick={() => handleProviderChange('custom')}
                className={`p-4 rounded-xl border text-left transition-all ${
                  settings.provider === 'custom'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="font-bold text-gray-800 dark:text-white mb-1">Custom / Local</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Connect to Ollama, Groq, or other endpoints.</div>
              </button>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-6 space-y-6">
            
            {/* Model Name */}
            <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                 <Bot className="w-4 h-4 inline mr-2" /> Model Name
               </label>
               {settings.provider === 'gemini' ? (
                 <select 
                   value={settings.modelName}
                   onChange={(e) => handleChange('modelName', e.target.value)}
                   className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-800 dark:text-white"
                 >
                   <option value="gemini-3-flash-preview">Gemini 3 Flash (Recommended)</option>
                   <option value="gemini-3-pro-preview">Gemini 3 Pro (Complex Reasoning)</option>
                   <option value="gemini-2.5-flash-lite-preview">Gemini 2.5 Flash Lite (Fast)</option>
                 </select>
               ) : (
                 <input
                   type="text"
                   value={settings.modelName}
                   onChange={(e) => handleChange('modelName', e.target.value)}
                   placeholder="e.g. gpt-4o, llama3"
                   className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                 />
               )}
            </div>

            {/* API Key & URL (Non-Gemini) */}
            {settings.provider !== 'gemini' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Globe className="w-4 h-4 inline mr-2" /> Base URL
                  </label>
                  <input
                    type="text"
                    value={settings.baseURL}
                    onChange={(e) => handleChange('baseURL', e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <Key className="w-4 h-4 inline mr-2" /> API Key
                  </label>
                  <input
                    type="password"
                    value={settings.apiKey}
                    onChange={(e) => handleChange('apiKey', e.target.value)}
                    placeholder="sk-..."
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white font-mono text-sm"
                  />
                  <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-500 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Key is stored locally in your browser. Never share your screen while this field is visible.
                  </p>
                </div>
              </>
            )}

            {settings.provider === 'gemini' && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded-lg text-sm flex items-start">
                 <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />
                 <div>
                   <p className="font-bold">System Environment Key Active</p>
                   <p className="mt-1 opacity-90">Your application is using the secure environment variable provided by the platform. No manual key entry required.</p>
                 </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-4">
               <button
                 onClick={handleTestConnection}
                 disabled={isTesting}
                 className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                    testStatus === 'success' ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 
                    testStatus === 'error' ? 'text-red-600 bg-red-50 dark:bg-red-900/20' : 
                    'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                 }`}
               >
                 {isTesting ? 'Checking...' : testStatus === 'success' ? 'Connection Verified' : testStatus === 'error' ? 'Connection Failed' : 'Test Connection'}
               </button>

               <button
                 onClick={() => onSave(settings)}
                 className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-sm transition-transform active:scale-95"
               >
                 <Save className="w-4 h-4 mr-2" />
                 Save Settings
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
