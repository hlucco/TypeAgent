import { SessionContext } from "@typeagent/agent-sdk";
import { HighspotActionContext } from "./agent/highspotConversationActionHandler.js";
import axios from "axios";

export async function parseAndExecuteQuery(
    query: string,
    tableName: string,
    context: SessionContext<HighspotActionContext>,
): Promise<string> {

    if (!context.agentContext.db) {
        return "Database not initialized";
    }

    const colNames = await context.agentContext.db.getColumnNames(tableName);

    for (let i = 0; i < colNames.length; i++) {
        colNames[i] = `"${colNames[i]}"`;
    }

    console.log(`Column names: ${colNames}`);

    // Incredibely basic prompt for the first version
    // to increase the accuracy of this prompt we will want to restrict
    // the SQL generation to a subset we define and pass into the prompt which we
    // generate dynamically
    const prompt = `Given the table name is ${tableName} and the the column names are ${colNames.join(", ")},
    Generate SQL to query the user table for the following: ${query}.
    Only return the raw SQL query string and nothing else no formatting.
    `;

    const systemPrompt = "You are a text-only assistant. Please produce all output as plain text, without any Markdown formatting or code fences."

    const rawSQL = await callOpenAI(prompt, systemPrompt);

    console.log("Raw SQL: ", rawSQL);

    // TODO add the validation code in here to verify the SQL statement is valid
    // if not valid then pass back to the LLM to fix

    // Generated SQL is used against the database here
    const resultSQL = await context.agentContext.db.query(rawSQL);

    console.log("Result SQL: ", resultSQL);

    // placeholder fomatting prompt
    const resultPrompt = `Parse this output into a short two sentence human readable format: ${resultSQL}`;

    const result = await callOpenAI(resultPrompt, systemPrompt);

    return result;
}

// basic llm calling for now in the future we will want to abstract all of this
// for now just poc want to show sql generation
export async function callOpenAI(prompt: string, systemPrompt: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('Missing OPENAI_API_KEY in environment variables');
    }
  
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: process.env.OPENAI_MODEL, // or 'gpt-4'
          messages: [
            { role: 'user', content: prompt },
            { role: "system", content: systemPrompt }
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );
  
      // The response structure is:
      // {
      //   id: string;
      //   object: string;
      //   created: number;
      //   choices: [
      //     {
      //       index: number;
      //       message: { role: string; content: string };
      //       finish_reason: string;
      //     }
      //   ];
      //   usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      // }
      const assistantMessage = response.data.choices?.[0]?.message?.content;
      if (!assistantMessage) {
        throw new Error('No content returned from OpenAI');
      }
  
      return assistantMessage;
    } catch (error: any) {
      console.error('Error calling OpenAI:', error.message);
      throw new Error('Failed to fetch completion from OpenAI');
    }
  }