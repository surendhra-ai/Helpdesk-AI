import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, Send, Bot, StopCircle, Radio, Sparkles, AlertCircle, User } from 'lucide-react';
import { getFastChatResponse, transcribeAudio } from '../services/geminiService';
import { arrayBufferToBase64, base64ToUint8Array, decodeAudioData, pcmToGeminiBlob } from '../utils';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

interface AIAssistantProps {
  dataContext: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

export const AIAssistant: React.FC<AIAssistantProps> = ({ dataContext }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'live'>('chat');
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1', 
      sender: 'ai', 
      text: 'Hello! I am your Helpdesk AI Assistant. Ask me anything about your ticket data or current team performance.',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Transcription State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Live API State
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [volumeLevel, setVolumeLevel] = useState(0);
  
  // Refs for Live API
  const sessionRef = useRef<any>(null); // LiveSession type is not exported directly in strict type
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, activeTab]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 128)}px`;
    }
  }, [inputText]);

  // --- CHAT & TRANSCRIPTION ---

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMsg: Message = { 
      id: Date.now().toString(), 
      sender: 'user', 
      text: inputText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    const responseText = await getFastChatResponse(userMsg.text, dataContext);
    
    setMessages(prev => [...prev, { 
      id: (Date.now() + 1).toString(), 
      sender: 'ai', 
      text: responseText,
      timestamp: new Date()
    }]);
    setIsTyping(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsTyping(true); // Show loading indicator
          try {
            const transcript = await transcribeAudio(base64Audio);
            setInputText(prev => prev + (prev ? ' ' : '') + transcript);
          } catch (e) {
            console.error(e);
          } finally {
            setIsTyping(false);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Microphone access is required.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- LIVE API ---

  const startLiveSession = async () => {
    if (isLiveConnected) return;
    setLiveStatus('connecting');

    try {
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime; // Reset timing

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = inputCtx.createMediaStreamSource(stream);
      
      // Use ScriptProcessor for raw PCM access (deprecated but simplest for single-file demo as per SDK examples)
      const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
      
      const sessionPromise = ai.live.connect({
        model: LIVE_MODEL,
        callbacks: {
          onopen: () => {
            console.log("Live Session Opened");
            setLiveStatus('connected');
            setIsLiveConnected(true);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
               const outputCtx = outputAudioContextRef.current;
               if (!outputCtx) return;

               // Sync nextStartTime
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);

               const audioBuffer = await decodeAudioData(
                  base64ToUint8Array(base64Audio), 
                  outputCtx, 
                  24000
               );

               const source = outputCtx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(outputCtx.destination);
               source.start(nextStartTimeRef.current);
               
               // Update visualizer (fake volume)
               setVolumeLevel(Math.random() * 100);
               setTimeout(() => setVolumeLevel(0), audioBuffer.duration * 1000);

               nextStartTimeRef.current += audioBuffer.duration;
               sourcesRef.current.add(source);
               
               source.onended = () => sourcesRef.current.delete(source);
            }
          },
          onclose: () => {
            console.log("Live Session Closed");
            cleanupLiveSession();
          },
          onerror: (e) => {
            console.error("Live Session Error", e);
            cleanupLiveSession();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          // Pass the dashboard context as system instruction
          systemInstruction: `You are an intelligent Data Analyst. You are talking to an IT Manager about their Helpdesk performance. 
          Here is the current dashboard data summary: 
          ${dataContext}
          
          Answer questions about this data concisely. Be professional but conversational.`
        }
      });

      sessionRef.current = sessionPromise;

      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = pcmToGeminiBlob(inputData);
        
        sessionPromise.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
        
        // Visualizer input
        let sum = 0;
        for(let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
        const avg = sum / inputData.length;
        if (avg > 0.01) setVolumeLevel(Math.min(100, avg * 500));
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(inputCtx.destination);

    } catch (err) {
      console.error("Failed to start live session:", err);
      setLiveStatus('disconnected');
    }
  };

  const cleanupLiveSession = () => {
    setLiveStatus('disconnected');
    setIsLiveConnected(false);
    
    // Stop audio contexts
    inputAudioContextRef.current?.close();
    outputAudioContextRef.current?.close();
    
    // Stop all playing sources
    sourcesRef.current.forEach(s => s.stop());
    sourcesRef.current.clear();

    // Close session if method exists (SDK dependent, usually implied by closing ws)
    // For now we just reset state as we can't manually close the session object easily without keeping the socket ref
  };

  const stopLiveSession = async () => {
     // Currently no direct .close() on session object in types, but triggering state change
     // In a real app we would call session.close() if exposed or just reload context
     cleanupLiveSession();
     window.location.reload(); // Hard reset for audio contexts to ensure clean slate
  };

  return (
    <div className="max-w-4xl mx-auto h-[600px] flex flex-col md:flex-row gap-6 animate-fade-in">
      {/* Sidebar / Tabs */}
      <div className="w-full md:w-64 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-2 transition-colors">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
          <Bot className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" /> AI Analyst
        </h3>
        
        <button
          onClick={() => setActiveTab('chat')}
          className={`p-3 rounded-lg text-left flex items-center transition-colors ${activeTab === 'chat' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
        >
          <Sparkles className="w-4 h-4 mr-3" /> Chat Assistant
        </button>
        
        <button
          onClick={() => setActiveTab('live')}
          className={`p-3 rounded-lg text-left flex items-center transition-colors ${activeTab === 'live' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium' : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'}`}
        >
          <Radio className="w-4 h-4 mr-3" /> Live Conversation
        </button>

        <div className="mt-auto p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/30">
          <p className="font-semibold mb-1">Models Used:</p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Gemini 2.5 Flash Lite (Chat)</li>
            <li>Gemini 3 Flash (Transcription)</li>
            <li>Gemini 2.5 Live (Audio)</li>
          </ul>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col transition-colors">
        
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 p-4 overflow-y-auto space-y-6 bg-gray-50 dark:bg-gray-900/50">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-end gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border ${msg.sender === 'user' ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300' : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-indigo-600 dark:text-indigo-400'}`}>
                      {msg.sender === 'user' ? <User size={16} /> : <Bot size={16} />}
                    </div>
                    
                    <div className={`p-3.5 rounded-2xl text-sm shadow-sm ${
                      msg.sender === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none' 
                        : 'bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 text-gray-800 dark:text-gray-100 rounded-bl-none'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                  <span className={`text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 px-12 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                   <div className="flex items-end gap-2">
                       <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Bot size={16} />
                       </div>
                       <div className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 p-3 rounded-2xl rounded-bl-none shadow-sm flex gap-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-75"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-150"></div>
                       </div>
                   </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex gap-2 items-end">
               <button
                onMouseDown={startRecording}
                onMouseUp={stopRecording}
                onTouchStart={startRecording}
                onTouchEnd={stopRecording}
                className={`p-3 rounded-full transition-all flex-shrink-0 ${isRecording ? 'bg-red-500 text-white scale-110 shadow-lg' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                title="Hold to Speak"
               >
                 <Mic className="w-5 h-5" />
               </button>
               
               <div className="flex-1 relative">
                 <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type a question or hold Mic to speak..."
                    className="w-full p-3 pr-10 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none min-h-[48px] max-h-32 text-sm overflow-y-auto bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                 />
               </div>
               
               <button
                onClick={handleSendMessage}
                disabled={!inputText.trim()}
                className="p-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
               >
                 <Send className="w-5 h-5" />
               </button>
            </div>
          </>
        )}

        {activeTab === 'live' && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-indigo-900 to-purple-900 text-white relative overflow-hidden">
             
             {/* Visualizer Background */}
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={`w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-20 transition-all duration-100`} style={{ transform: `scale(${1 + volumeLevel/50})` }}></div>
                <div className={`w-48 h-48 bg-purple-500 rounded-full blur-2xl opacity-30 transition-all duration-100 delay-75`} style={{ transform: `scale(${1 + volumeLevel/80})` }}></div>
             </div>

             <div className="z-10 text-center space-y-8">
               <div>
                  <h2 className="text-3xl font-bold mb-2">Live Data Analyst</h2>
                  <p className="text-indigo-200">Have a real-time voice conversation with your data.</p>
               </div>

               <div className="h-32 flex items-center justify-center">
                  {liveStatus === 'connected' ? (
                     <div className="flex gap-2 items-end h-16">
                        {[...Array(5)].map((_, i) => (
                           <div 
                             key={i} 
                             className="w-3 bg-white rounded-full animate-pulse" 
                             style={{ 
                               height: `${Math.max(20, Math.random() * volumeLevel + 20)}%`,
                               animationDuration: `${0.5 + Math.random() * 0.5}s` 
                             }}
                           ></div>
                        ))}
                     </div>
                  ) : liveStatus === 'connecting' ? (
                     <div className="animate-spin w-12 h-12 border-4 border-white border-t-transparent rounded-full"></div>
                  ) : (
                     <Radio className="w-20 h-20 text-indigo-300 opacity-50" />
                  )}
               </div>

               {liveStatus === 'connected' ? (
                 <button
                   onClick={stopLiveSession}
                   className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-full font-bold shadow-lg flex items-center gap-3 transition-transform hover:scale-105"
                 >
                   <StopCircle className="w-6 h-6" /> End Session
                 </button>
               ) : (
                 <button
                   onClick={startLiveSession}
                   disabled={liveStatus === 'connecting'}
                   className="px-8 py-4 bg-white text-indigo-900 hover:bg-indigo-50 rounded-full font-bold shadow-lg flex items-center gap-3 transition-transform hover:scale-105 disabled:opacity-75"
                 >
                   <Mic className="w-6 h-6" /> {liveStatus === 'connecting' ? 'Connecting...' : 'Start Conversation'}
                 </button>
               )}
               
               {liveStatus === 'connected' && (
                 <p className="text-sm text-indigo-300 animate-pulse">Listening...</p>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};