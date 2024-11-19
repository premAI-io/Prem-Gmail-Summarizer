import Prem from "npm:@premai/prem-sdk";
import { GmailService } from "./gmail_service.ts";


const apiKey = Deno.env.get("PREMAI_API_KEY");
if (!apiKey) throw new Error("PREMAI_API_KEY is required")

const client = new Prem({
  apiKey: apiKey,
});

const project_id = 7414;

const gmailService = new GmailService();

const tools = [
  {
    type: "function",
    function: {
      name: "get_recent_emails",
      description: "Fetch recent emails from Gmail inbox",
      parameters: {
        type: "object",
        properties: {
          maxResults: {
            type: "number",
            description: "Maximum number of emails to fetch",
          },
        },
        required: ["maxResults"],
      },
    },
  },
];

async function getRecentEmails(maxResults: number) {
  try {
    const emails = await gmailService.getRecentEmails(maxResults);
    return JSON.stringify(emails);
  } catch (error) {
    console.error("Error fetching emails:", error);
    return JSON.stringify({ error: "Failed to fetch emails" });
  }
}

const system_prompt = `You are an AI email assistant that helps summarize emails. 
You can use the get_recent_emails function to fetch recent emails and then provide summaries.`;

const message = [
  {
    role: "user",
    content: "Please fetch my 5 most recent emails and provide a summary of each.",
  },
];

// 1. Define function name to function mapping
const functionNameMap = {
  "get_recent_emails": getRecentEmails,
};

// 2. Helper function to process tool calls and update messages
type ToolFunction = (maxResults: number) => Promise<string>;

async function insertToolMessages(
  messages: Array<{ role: string; content: string }>,
  response: {
    choices: Array<{
      message: {
        role: "user" | "assistant";
        content?: string;
        tool_calls?: Array<{
          id: string;
          function: {
            name: string;
            arguments: string | object;
          };
        }>;
      };
    }>;
  },
  functionNameMap: Record<string, ToolFunction>
): Promise<Array<{ role: string; content: string }>> {
  const responseDict = response.choices[0].message;

  // Add assistant message with raw response
  messages.push({
    role: "assistant",
    content: JSON.stringify(responseDict, null, 2)
  });

  let fullPrompt = "Here are the functions that you called and the response from the functions\n";

  // Process each tool call
  for (const toolCall of responseDict.tool_calls || []) {
    const functionName = toolCall.function.name;
    const functionToCall = functionNameMap[functionName];

    // Handle both string and object cases for arguments
    let functionParams;
    if (typeof toolCall.function.arguments === 'string') {
      try {
        functionParams = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        console.error("Error parsing function arguments:", error);
        functionParams = {};
      }
    } else {
      functionParams = toolCall.function.arguments;
    }

    const functionResponse = await functionToCall(functionParams.maxResults);

    fullPrompt += `
tool id: ${toolCall.id}
function_name: ${functionName}
function_response: ${functionResponse}
`;
  }

  // Add user message with function results
  messages.push({
    role: "user",
    content: fullPrompt
  });

  return messages;
}

// Update your existing code to use these functions
const responseSync = await client.chat.completions.create({
  project_id: project_id,
  system_prompt: system_prompt,
  messages: message,
  tools: tools,
  stream: false,
});

// Process the response and update messages
const updatedMessages = await insertToolMessages(message, responseSync, functionNameMap);

// Print messages for debugging
updatedMessages.forEach(message => {
  console.log("Role:", message.role);
  console.log("Content:", message.content);
  console.log();
});

// Make second API call with updated messages
const finalResponse = await client.chat.completions.create({
  project_id: project_id,
  systemPrompt: system_prompt,
  messages: updatedMessages,
  stream: false,
});

console.log("Final Response:", finalResponse.choices[0].message.content);



