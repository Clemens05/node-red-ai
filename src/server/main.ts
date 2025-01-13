import { OpenAI } from "openai";
import type { NodeAPI } from "node-red";
import { CustomSettings } from "./settings.interface";
import { ChatBody } from "./body.interface";
import { ChatCompletionMessageParam } from "openai/resources";

function getSettings(red: NodeAPI): CustomSettings {
  return red.settings as CustomSettings;
}

function getSystemPrompt(flows: any[]): string {
  return `You are an AI assistant for Node-RED. You have direct access to modify the flows.
          Here are some important rules:
          1. You can read and modify the flows directly
          2. When you want to modify flows, wrap the new flow JSON in \`\`\`json ... \`\`\`
          3. Always validate JSON before suggesting changes
          4. Explain your changes clearly
          5. Be careful with existing node connections
          6. Always return the FULL flow JSON, not just the modified part
          
          Current flows: ${JSON.stringify(flows, null, 2)}`;
}

function main(red: NodeAPI) {
  const settings = getSettings(red);

  const openai = new OpenAI({
    apiKey: settings.ai?.openaiApiKey,
  });

  red.httpAdmin.post("/chat", async (req, res) => {
    const body = req.body as ChatBody;

    const systemPrompt = getSystemPrompt(body.flows);

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...body.history.map((msg) => ({
        role: msg.sender,
        content: msg.text,
      })),
      { role: "user", content: body.message },
    ];

    const completion = await openai.chat.completions.create({
      model: body.model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    const response = completion.choices[0].message.content;

    if (!response) {
      res.status(500).json({
        status: "error",
        error: "No response from OpenAI",
        details: null,
      });
      return;
    }

    if (response.includes("```json")) {
      const flowJson = response.match(/```json\n([\s\S]*?)\n```/);
      if (flowJson && flowJson[1]) {
        const flows = JSON.parse(flowJson[1]);
        res.json({
          status: "success",
          message: response,
          flows: flows,
        });
        return;
      }
    }

    res.json({ status: "success", message: response, flows: null });
  });
}

module.exports = main;
