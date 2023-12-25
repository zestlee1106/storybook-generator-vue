import * as vscode from "vscode";
import * as fs from "fs";
import { parse1 } from "./utils/index";
import * as ts from "typescript";
import * as path from "path";

function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "createStory",
    function (uri: vscode.Uri) {
      // 현재 열려있는 프로젝트의 루트 경로 가져오기
      const projectRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

      if (!projectRoot) {
        vscode.window.showErrorMessage("프로젝트가 열려있지 않습니다.");

        return;
      }

      const configPath = path.join(projectRoot, "tsconfig.json");
      const readConfigFile = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsedConfig = ts.parseJsonConfigFileContent(
        readConfigFile.config,
        ts.sys,
        projectRoot
      );

      fs.readFile(uri.fsPath, "utf8", function (err, data) {
        if (err) {
          throw err;
        }
        vscode.window.showInformationMessage(data);
        const content = parse1(data, parsedConfig, projectRoot);
      });
    }
  );

  context.subscriptions.push(disposable);
}
exports.activate = activate;
