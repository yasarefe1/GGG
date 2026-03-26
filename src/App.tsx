import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Search, Code2, PenTool, Play, CheckCircle2, CircleDashed, Loader2, Github, Terminal, ChevronRight, User, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { AgentRole, Task, Agent } from './types';
import { planTasks, executeTaskStream } from './lib/gemini';

const INITIAL_AGENTS: Agent[] = [
  { id: "a1", role: "Manager", name: "Nexus", description: "Breaks down goals into actionable tasks.", status: "idle" },
  { id: "a2", role: "Researcher", name: "Atlas", description: "Gathers information and analyzes data.", status: "idle" },
  { id: "a3", role: "Coder", name: "Cipher", description: "Writes clean, efficient code.", status: "idle" },
  { id: "a4", role: "Writer", name: "Scribe", description: "Drafts engaging and polished text.", status: "idle" },
];

const ROLE_ICONS: Record<AgentRole, React.ElementType> = {
  Manager: BrainCircuit,
  Researcher: Search,
  Coder: Code2,
  Writer: PenTool,
};

export default function App() {
  const [goal, setGoal] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [tasks]);

  const updateAgentStatus = (role: AgentRole, status: Agent["status"]) => {
    setAgents(prev => prev.map(a => a.role === role ? { ...a, status } : a));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goal.trim() || isProcessing) return;

    setIsProcessing(true);
    setTasks([]);
    setOverallProgress(0);

    try {
      // Step 1: Manager plans tasks
      updateAgentStatus("Manager", "thinking");
      const plannedTasks = await planTasks(goal);
      setTasks(plannedTasks);
      updateAgentStatus("Manager", "idle");

      // Step 2: Execute tasks sequentially
      let contextAccumulator = "";
      
      for (let i = 0; i < plannedTasks.length; i++) {
        const task = plannedTasks[i];
        setActiveTaskId(task.id);
        updateTask(task.id, { status: "in-progress" });
        updateAgentStatus(task.assignee, "working");

        try {
          const finalResult = await executeTaskStream(
            task,
            goal,
            contextAccumulator,
            (chunk) => {
              updateTask(task.id, { result: chunk });
            }
          );
          
          contextAccumulator += `\n\n--- Result from ${task.title} ---\n${finalResult}`;
          updateTask(task.id, { status: "completed", result: finalResult });
        } catch (err) {
          console.error(`Task ${task.id} failed:`, err);
          updateTask(task.id, { status: "failed", result: "Task execution failed." });
          break; // Stop execution on failure
        } finally {
          updateAgentStatus(task.assignee, "idle");
          setOverallProgress(((i + 1) / plannedTasks.length) * 100);
        }
      }
    } catch (error) {
      console.error("Workflow failed:", error);
      alert("Failed to plan or execute tasks. Check console for details.");
      updateAgentStatus("Manager", "idle");
    } finally {
      setIsProcessing(false);
      setActiveTaskId(null);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Nexus Agents</h1>
            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-xs font-medium text-zinc-400 border border-zinc-700 ml-2">
              v1.0.0-beta
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://github.com" 
              target="_blank" 
              rel="noreferrer"
              className="flex items-center gap-2 text-sm font-medium text-zinc-400 hover:text-zinc-50 transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>Star on GitHub</span>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Sidebar: Agents */}
        <div className="lg:col-span-3 space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">Active Swarm</h2>
            <div className="space-y-3">
              {agents.map(agent => {
                const Icon = ROLE_ICONS[agent.role];
                const isWorking = agent.status !== "idle";
                
                return (
                  <div 
                    key={agent.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all duration-300",
                      isWorking 
                        ? "bg-zinc-900/80 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]" 
                        : "bg-zinc-900/30 border-zinc-800"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          isWorking ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">{agent.name}</h3>
                          <p className="text-xs text-zinc-500">{agent.role}</p>
                        </div>
                      </div>
                      {isWorking && (
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {agent.description}
                    </p>
                    
                    {isWorking && (
                      <div className="mt-3 text-xs font-medium text-emerald-400 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {agent.status === "thinking" ? "Planning..." : "Executing task..."}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content: Terminal & Tasks */}
        <div className="lg:col-span-9 flex flex-col h-[calc(100vh-8rem)]">
          
          {/* Input Area */}
          <div className="mb-6">
            <form onSubmit={handleStart} className="relative">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-500">
                <Terminal className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                disabled={isProcessing}
                placeholder="Enter a complex goal (e.g., 'Research quantum computing and write a beginner's guide')"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-32 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isProcessing || !goal.trim()}
                className="absolute right-2 top-2 bottom-2 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:hover:bg-emerald-600 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Running</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Execute</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Task Timeline / Output */}
          <div className="flex-1 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 custom-scrollbar">
            {tasks.length === 0 && !isProcessing ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-4">
                <BrainCircuit className="w-12 h-12 opacity-20" />
                <p>Awaiting instructions. Enter a goal to initialize the swarm.</p>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Overall Progress */}
                {tasks.length > 0 && (
                  <div className="mb-8">
                    <div className="flex justify-between text-xs text-zinc-400 mb-2">
                      <span>Mission Progress</span>
                      <span>{Math.round(overallProgress)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-emerald-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${overallProgress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {tasks.map((task, index) => {
                    const AgentIcon = ROLE_ICONS[task.assignee];
                    const isActive = activeTaskId === task.id;
                    const isCompleted = task.status === "completed";
                    
                    return (
                      <motion.div
                        key={task.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={cn(
                          "relative pl-8 before:absolute before:left-[11px] before:top-8 before:bottom-[-2rem] before:w-[2px] last:before:hidden",
                          isCompleted ? "before:bg-emerald-500/30" : "before:bg-zinc-800"
                        )}
                      >
                        {/* Timeline Node */}
                        <div className={cn(
                          "absolute left-0 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-zinc-950 z-10",
                          isCompleted ? "border-emerald-500 text-emerald-500" : 
                          isActive ? "border-emerald-400 text-emerald-400" : 
                          "border-zinc-700 text-zinc-700"
                        )}>
                          {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : 
                           isActive ? <Loader2 className="w-3 h-3 animate-spin" /> : 
                           <CircleDashed className="w-3 h-3" />}
                        </div>

                        {/* Task Card */}
                        <div className={cn(
                          "rounded-xl border p-5 transition-colors",
                          isActive ? "bg-zinc-900/80 border-emerald-500/30" : 
                          isCompleted ? "bg-zinc-900/40 border-zinc-800/80" : 
                          "bg-zinc-900/20 border-zinc-800/50"
                        )}>
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="text-base font-medium text-zinc-100">{task.title}</h4>
                              <p className="text-sm text-zinc-400 mt-1">{task.description}</p>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 text-xs font-medium text-zinc-300">
                              <AgentIcon className="w-3 h-3" />
                              {task.assignee}
                            </div>
                          </div>

                          {/* Task Result / Output */}
                          {(isActive || isCompleted || task.result) && (
                            <div className="mt-4 pt-4 border-t border-zinc-800/50">
                              <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800">
                                <ReactMarkdown>{task.result || "..."}</ReactMarkdown>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

