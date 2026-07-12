import { resolveRole } from "./roles";
import type { B20Event } from "./types";

export interface PresentedEventArg {
  key: string;
  label: string;
  value: unknown;
  kind: "address" | "hash" | "number" | "text" | "unknown";
  hidden?: boolean;
}

export interface PresentedEvent {
  title: string;
  description: string;
  args: PresentedEventArg[];
}

const EVENT_COPY: Record<string, { title: string; description: string }> = {
  RoleGranted: {
    title: "Role granted",
    description: "An issuer-control permission was granted to an account.",
  },
  RoleRevoked: {
    title: "Role revoked",
    description: "An issuer-control permission was removed from an account.",
  },
  LastAdminRenounced: {
    title: "Last admin renounced",
    description: "The final default admin role was renounced.",
  },
  Paused: {
    title: "Token paused",
    description: "Transfers or selected token operations were paused.",
  },
  Unpaused: {
    title: "Token unpaused",
    description: "Previously paused token operations were resumed.",
  },
  PolicyUpdated: {
    title: "Transfer policy updated",
    description: "Issuer-controlled transfer policy settings changed.",
  },
  SupplyCapUpdated: {
    title: "Supply cap updated",
    description: "The issuer changed the token maximum supply cap.",
  },
  BurnedBlocked: {
    title: "Blocked balance burned",
    description: "Tokens from a blocked account were burned.",
  },
  ContractURIUpdated: {
    title: "Contract metadata updated",
    description: "The token contract metadata URI changed.",
  },
  NameUpdated: {
    title: "Token name updated",
    description: "The token display name changed.",
  },
  SymbolUpdated: {
    title: "Token symbol updated",
    description: "The token ticker symbol changed.",
  },
  ExtraMetadataUpdated: {
    title: "Extra metadata updated",
    description: "A custom token metadata field changed.",
  },
  Announcement: {
    title: "Issuer announcement",
    description: "The issuer published an on-chain announcement.",
  },
  EndAnnouncement: {
    title: "Announcement ended",
    description: "An issuer announcement was ended.",
  },
};

const ARG_LABELS: Record<string, string> = {
  role: "Role",
  sender: "Sender",
  account: "Account",
  admin: "Admin",
  updater: "Updater",
  from: "From",
  to: "To",
  owner: "Owner",
  spender: "Spender",
  key: "Key",
  value: "Value",
  oldSupplyCap: "Old cap",
  newSupplyCap: "New cap",
  amount: "Amount",
  policy: "Policy",
  oldPolicy: "Old policy",
  newPolicy: "New policy",
  name: "Name",
  symbol: "Symbol",
  uri: "URI",
};

const PRIORITY_ARGS: Record<string, string[]> = {
  RoleGranted: ["role", "account", "sender"],
  RoleRevoked: ["role", "account", "sender"],
  SupplyCapUpdated: ["newSupplyCap", "oldSupplyCap", "updater"],
  PolicyUpdated: ["newPolicy", "oldPolicy", "updater"],
  BurnedBlocked: ["account", "amount", "sender"],
  ExtraMetadataUpdated: ["key", "value"],
  NameUpdated: ["name", "updater"],
  SymbolUpdated: ["symbol", "updater"],
  ContractURIUpdated: ["uri", "updater"],
};

function isHexLike(text: string): boolean {
  return /^0x[0-9a-fA-F]+$/.test(text);
}

function isAddressLike(text: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(text);
}

function isHashLike(text: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(text);
}

function isLikelyUnreadable(text: string): boolean {
  if (text.includes("�")) return true;
  const nonPrintable = text.replace(/[\x20-\x7e]/g, "").length;
  return text.length > 0 && nonPrintable / text.length > 0.12;
}

function displayValue(key: string, value: unknown): unknown {
  if (key !== "role") return value;
  return resolveRole(value);
}

function argKind(key: string, value: unknown): PresentedEventArg["kind"] {
  const text = String(value);

  if (key === "role" && isLikelyUnreadable(text)) return "unknown";
  if (isAddressLike(text)) return "address";
  if (isHashLike(text)) return "hash";
  if (/^-?\d+$/.test(text)) return "number";
  if (isHexLike(text)) return "hash";
  if (isLikelyUnreadable(text)) return "unknown";
  return "text";
}

function shouldHideArg(key: string, value: unknown): boolean {
  const text = String(value);
  return text === "" || value == null || key === "eventSignature";
}

function sortArgs(eventName: string, entries: [string, unknown][]): [string, unknown][] {
  const priority = PRIORITY_ARGS[eventName] ?? [];

  return [...entries].sort(([a], [b]) => {
    const aIndex = priority.indexOf(a);
    const bIndex = priority.indexOf(b);

    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    }

    return a.localeCompare(b);
  });
}

export function presentEvent(event: B20Event): PresentedEvent {
  const copy = EVENT_COPY[event.name] ?? {
    title: event.name,
    description: "Observed B20 event.",
  };

  const args = sortArgs(event.name, Object.entries(event.args))
    .filter(([key, value]) => !shouldHideArg(key, value))
    .map(([key, value]) => {
      const valueForDisplay = displayValue(key, value);

      return {
        key,
        label: ARG_LABELS[key] ?? key,
        value: valueForDisplay,
        kind: argKind(key, valueForDisplay),
      };
    });

  return {
    title: copy.title,
    description: copy.description,
    args,
  };
}

export function formatEventNumber(value: unknown): string {
  const text = String(value);
  if (!/^-?\d+$/.test(text)) return text;

  try {
    return BigInt(text).toLocaleString("en-US");
  } catch {
    return text;
  }
}
