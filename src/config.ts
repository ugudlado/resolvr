import * as vscode from "vscode";

export function getDefaultTargetBranch(): string {
  return vscode.workspace
    .getConfiguration("resolvr")
    .get<string>("defaultTargetBranch", "main");
}
