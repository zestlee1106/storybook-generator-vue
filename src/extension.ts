import * as vscode from "vscode";
import * as fs from "fs";
import { parseContent } from "./utils/get-args";
import * as path from "path";
import { generateStorybook } from "./utils/generate";

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "createStory",
    function (uri: vscode.Uri) {
      if (!uri) {
        vscode.window.showErrorMessage("파일을 선택해주세요.");

        return;
      }

      // 현재 열려있는 프로젝트의 루트 경로 가져오기
      const projectRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

      if (!projectRoot) {
        vscode.window.showErrorMessage("프로젝트가 열려있지 않습니다.");

        return;
      }

      let propsData;

      fs.readFile(uri.fsPath, "utf8", function (err, data) {
        const filePath = path.dirname(uri.fsPath);
        const parentDirName = capitalizeFirstLetter(path.basename(filePath));
        const storybookPath = path.join(
          filePath,
          `${parentDirName}.stories.ts`
        );

        if (fs.existsSync(storybookPath)) {
          vscode.window.showErrorMessage("이미 스토리북이 존재합니다.");

          return;
        }

        if (err) {
          throw err;
        }
        const props = parseContent(data, projectRoot, uri);

        if (!props) {
          return;
        }

        propsData = props;

        generateStorybook(uri, propsData);
      });
    }
  );

  context.subscriptions.push(disposable);
}
exports.activate = activate;
