const openaiApi = require("openai");
const fs = require("fs-extra");
const path = require("path");

module.exports = function (RED) {
  function AIChatPlugin(config) {
    // RED.nodes.createNode(this, config);
    // const node = this;

    // Get settings from Node-RED runtime
    const settings = RED.settings;

    if (!settings.aiChat?.openai) {
      //   node.error("AI Chat settings not found in settings.js");
      settings.aiChat = settings.aiChat || {};
      settings.aiChat.openai = settings.aiChat.openai || {};
    }

    const openai = new openaiApi.OpenAI({
      apiKey: settings.aiChat?.openai?.apiKey,
    });

    // Function to read flows.json
    async function getFlowsFile() {
      const flowFilePath = settings.flowFile || "flows.json";
      try {
        const flows = await fs.readJson(flowFilePath);
        return flows;
      } catch (err) {
        // node.error("Error reading flows file: " + err.message);
        return null;
      }
    }

    // Function to write flows.json
    async function saveFlowsFile(flows) {
      const flowFilePath = settings.flowFile;
      try {
        await fs.writeJson(flowFilePath, flows, { spaces: 4 });
        return true;
      } catch (err) {
        // node.error("Error writing flows file: " + err.message);
        return false;
      }
    }

    // Register the HTTP endpoint
    RED.httpAdmin.post("/chat", async function (req, res) {
      if (!settings.aiChat?.openai?.apiKey) {
        return res.status(401).json({
          error: "OpenAI API key not configured",
        });
      }

      try {
        const { message, history = [], flows } = req.body;
        const currentFlows = flows || (await getFlowsFile());

        const systemPrompt = `You are an AI assistant for Node-RED. You have direct access to modify the flows.
                Here are some important rules:
                1. You can read and modify the flows directly
                2. When you want to modify flows, wrap the new flow JSON in \`\`\`json ... \`\`\`
                3. Always validate JSON before suggesting changes
                4. Explain your changes clearly
                5. Be careful with existing node connections
                6. Always return the FULL flow JSON, not just the modified part
                
                Current flows: ${JSON.stringify(currentFlows, null, 2)}`;

        const messages = [
          { role: "system", content: systemPrompt },
          ...history.map((msg) => ({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.text,
          })),
          { role: "user", content: message },
        ];

        const completion = await openai.chat.completions.create({
          model: settings.aiChat?.openai?.model || "gpt-4",
          messages: messages,
          temperature: settings.aiChat?.openai?.temperature || 0.7,
          max_tokens: settings.aiChat?.openai?.maxTokens || 2000,
        });

        const aiResponse = completion.choices[0].message.content;
        let modifiedFlows = null;

        if (aiResponse.includes("```json")) {
          try {
            const flowJson = aiResponse.match(/```json\n([\s\S]*?)\n```/);
            if (flowJson && flowJson[1]) {
              modifiedFlows = JSON.parse(flowJson[1]);
              await saveFlowsFile(modifiedFlows);
            }
          } catch (e) {
            // node.error("Failed to parse/save modified flows: " + e.message);
          }
        }

        return res.json({
          response: {
            message: aiResponse,
            flows: modifiedFlows,
          },
          status: "success",
        });
      } catch (error) {
        // node.error("Error in AI Chat: " + error.message);
        return res.status(500).json({
          error: "Internal server error",
          details: error.message,
          status: "error",
        });
      }
    });
  }

  //   RED.nodes.registerType("ai-chat", AIChatPlugin);

  AIChatPlugin();
};
