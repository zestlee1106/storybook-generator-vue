import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "createStory",
    async (resource: vscode.Uri) => {
      if (resource) {
        // 현재 열려있는 프로젝트의 루트 경로 가져오기
        const projectRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

        if (!projectRoot) {
          vscode.window.showErrorMessage("프로젝트가 열려있지 않습니다.");

          return;
        }

        // 선택한 폴더 경로 가져오기
        const folderPath = resource.fsPath;

        // 파일 이름만 가져오기
        const fileNameWithExtension = path.basename(folderPath);

        // 파일 정보 분석
        const fileInfo = path.parse(fileNameWithExtension);

        // 확장자를 제외한 파일 이름 가져오기
        const fileNameWithoutExtension = fileInfo.name;

        const filePath = path.join(projectRoot, fileNameWithoutExtension);

        vscode.window.showInformationMessage(filePath);

        if (!fs.existsSync(filePath)) {
          fs.mkdirSync(filePath);

          const storybookPath = path.join(
            filePath,
            `${fileNameWithoutExtension}.stories.tsx`
          );

          fs.writeFileSync(storybookPath, `import * from 'fs'`);

          vscode.window.showInformationMessage("생성 완료");
        }

        vscode.window.showInformationMessage("이미 있음");

        vscode.window.showInformationMessage("하이욤");
      }
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
