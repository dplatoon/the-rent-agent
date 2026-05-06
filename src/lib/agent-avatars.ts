import CA from "@/assets/agents/CA.png";
import NY from "@/assets/agents/NY.png";
import TX from "@/assets/agents/TX.png";
import FL from "@/assets/agents/FL.png";
import WA from "@/assets/agents/WA.png";
import IL from "@/assets/agents/IL.png";
import CO from "@/assets/agents/CO.png";
import GA from "@/assets/agents/GA.png";
import AZ from "@/assets/agents/AZ.png";
import MA from "@/assets/agents/MA.png";
import NV from "@/assets/agents/NV.png";
import OR from "@/assets/agents/OR.png";

export const AGENT_AVATARS: Record<string, string> = {
  CA, NY, TX, FL, WA, IL, CO, GA, AZ, MA, NV, OR,
};

export function getAgentAvatar(id: string): string | undefined {
  return AGENT_AVATARS[id.toUpperCase()];
}
