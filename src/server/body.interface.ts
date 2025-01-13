export interface ChatBody {
  model: string;
  message: string;
  history: { sender: "user" | "assistant" | "system"; text: string }[];
  flows: any[];
}
