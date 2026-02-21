// src/config.ts
import fs from "fs";
import os from "os";
import path from "path";

export type Config = {
  dbUrl: string;
  currentUserName?: string;
};

function getConfigFilePath(): string {
  return path.join(os.homedir(), ".gatorconfig.json");
}

function writeConfig(cfg: Config): void {
  const filePath = getConfigFilePath();

  const rawToSave = {
    db_url: cfg.dbUrl,
    current_user_name: cfg.currentUserName,
  };

  fs.writeFileSync(filePath, JSON.stringify(rawToSave, null, 2), {
    encoding: "utf-8",
  });
}

function validateConfig(rawConfig: any): Config {
  if (!rawConfig || typeof rawConfig !== "object") {
    throw new Error("Config is not a valid JSON object");
  }

  if (typeof rawConfig.db_url !== "string" || rawConfig.db_url.length === 0) {
    throw new Error("Config must have a non-empty 'db_url' string");
  }

  if (
    rawConfig.current_user_name !== undefined &&
    typeof rawConfig.current_user_name !== "string"
  ) {
    throw new Error("'current_user_name' must be a string if provided");
  }

  const cfg: Config = {
    dbUrl: rawConfig.db_url,
  };

  if (rawConfig.current_user_name !== undefined) {
    cfg.currentUserName = rawConfig.current_user_name;
  }

  return cfg;
}

export function readConfig(): Config {
  const filePath = getConfigFilePath();
  const raw = fs.readFileSync(filePath, { encoding: "utf-8" });
  const parsed = JSON.parse(raw);
  return validateConfig(parsed);
}

export function setUser(userName: string): void {
  const cfg = readConfig();
  cfg.currentUserName = userName;
  writeConfig(cfg);
}