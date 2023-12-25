import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as ejs from "ejs";
import * as prettier from "prettier";

const outputPannel = vscode.window.createOutputChannel("Ywlee_Storybook");

interface PropsData {
  finalProps: {};
  propsName: string;
  props: {};
  importedName: string;
  importedProps: {};
  importedPath: string;
  defaultOptions: object;
  defineEmits: string[];
}

export async function generateStorybook(
  uri: vscode.Uri,
  propsData?: PropsData
) {
  const filePath = path.dirname(uri.fsPath);
  const parentDirName = capitalizeFirstLetter(path.basename(filePath));
  const storybookPath = path.join(filePath, `${parentDirName}.stories.ts`);

  if (!fs.existsSync(storybookPath)) {
    try {
      const templatePath = path.join(
        __dirname,
        "../../",
        "/src/templates",
        "storybook.ejs"
      );
      const template = fs.readFileSync(templatePath, "utf-8");
      const result = ejs.render(template, {
        componentName: parentDirName,
        finalProps: propsData?.finalProps,
        importedName: propsData?.importedName,
        props: propsData?.props,
        importedPath: propsData?.importedPath,
        defaultOptions: propsData?.defaultOptions,
        defineEmits: propsData?.defineEmits,
      });

      const formatted = await prettier.format(result, { parser: "typescript" });
      fs.writeFileSync(storybookPath, formatted);

      vscode.window.showInformationMessage("생성 완료");
    } catch (e) {
      vscode.window.showErrorMessage("생성 실패");

      if (e instanceof Error) {
        outputPannel.appendLine(e.message);
      }
    }
  }
}

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
