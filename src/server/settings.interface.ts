import { NodeAPISettingsWithData } from "node-red";

export interface CustomSettings extends NodeAPISettingsWithData {
  ai?: {
    openaiApiKey?: string;
  };
}
