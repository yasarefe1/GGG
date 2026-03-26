import { GoogleGenAI, Type } from "@google/genai";
import { Task, AgentRole } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function planTasks(goal: string): Promise<Task[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `You are the Manager Agent. The user's goal is: "${goal}".
Break this goal down into 2 to 4 sequential, actionable subtasks.
Assign each subtask to one of the following specialized agents: "Researcher", "Coder", or "Writer".
Return the tasks in the order they should be executed.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "A unique short string ID (e.g., task-1)" },
            title: { type: Type.STRING, description: "A short, descriptive title for the task" },
            description: { type: Type.STRING, description: "Detailed instructions for the assigned agent" },
            assignee: { type: Type.STRING, description: "The agent assigned to this task. Must be exactly one of: Researcher, Coder, Writer" }
          },
          required: ["id", "title", "description", "assignee"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from Manager Agent");
  
  try {
    const tasks = JSON.parse(text);
    return tasks.map((t: any) => ({ ...t, status: "pending" }));
  } catch (e) {
    console.error("Failed to parse tasks", e);
    throw new Error("Manager Agent returned invalid plan format.");
  }
}

export async function executeTaskStream(
  task: Task,
  goal: string,
  previousResults: string,
  onChunk: (text: string) => void
): Promise<string> {
  let systemInstruction = "You are a helpful AI agent.";
  if (task.assignee === "Researcher") {
    systemInstruction = "You are an expert Researcher Agent. Your job is to gather information, analyze data, and summarize findings clearly and concisely.";
  } else if (task.assignee === "Coder") {
    systemInstruction = "You are an expert Coder Agent. Your job is to write clean, efficient, and well-documented code based on the requirements.";
  } else if (task.assignee === "Writer") {
    systemInstruction = "You are an expert Writer Agent. Your job is to draft engaging, well-structured, and polished text based on the research and code provided.";
  }

  const prompt = `
Overall Goal: ${goal}

Previous Context / Results from other agents:
${previousResults || "None yet."}

Your Task:
Title: ${task.title}
Description: ${task.description}

Execute your task and provide the final output. Use markdown formatting.`;

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
    config: {
      systemInstruction,
    }
  });

  let fullText = "";
  for await (const chunk of responseStream) {
    if (chunk.text) {
      fullText += chunk.text;
      onChunk(fullText);
    }
  }
  
  return fullText;
}
