import { parse } from "@vue/compiler-sfc";
import * as vscode from "vscode";
import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

const outputChannel = vscode.window.createOutputChannel("Ywlee");
const config = vscode.workspace.getConfiguration("test-extension-vue");
const alias = config.get("alias") as Record<string, string>;

/**
 * 주어진 노드가 InterfaceDeclaration이고, 그 이름이 주어진 문자열과 일치하는지 확인하는 함수
 *
 * @param node - 타입스크립트 노드 (이 노드의 타입과 이름을 확인한다)
 * @param compareText - 비교할 인터페이스 이름 (노드의 이름이 이 문자열과 일치하는지 확인)
 * @returns 만약 노드가 InterfaceDeclaration이고 그 이름이 compareText와 일치하면 해당 노드를 반환. 그렇지 않으면 undefined를 반환.
 */
function getPropsInterface(
  node: ts.Node,
  compareText: string
): ts.InterfaceDeclaration | undefined {
  // 노드가 InterfaceDeclaration인지 확인하고, 그 이름이 compareText와 일치하는지 확인한다.
  // 이 두 조건이 모두 참이면 노드를 반환하고, 그렇지 않으면 undefined를 반환한다.
  return ts.isInterfaceDeclaration(node) && node.name.text === compareText
    ? node
    : undefined;
}

/**
 * 주어진 PropertySignature 노드의 타입을 문자열로 반환하는 함수
 *
 * @param member - 타입스크립트 PropertySignature 노드 (이 노드의 타입을 확인한다)
 * @param sourceFile - 타입스크립트 소스 파일 (노드의 텍스트를 가져오는 데 사용)
 * @returns 노드의 타입에 따라 다른 문자열을 반환. 타입이 없으면 "unknown"을 반환.
 */
function getMemberType(
  member: ts.PropertySignature,
  sourceFile: ts.SourceFile
): string | string[] {
  // member의 타입이 없는 경우 "unknown"을 반환한다.
  if (!member.type) {
    return "unknown";
  }

  // member의 타입이 TypeReferenceNode인 경우, 해당 타입의 이름을 반환한다.
  if (ts.isTypeReferenceNode(member.type)) {
    return member.type.typeName.getText(sourceFile);
  }

  // member의 타입이 UnionTypeNode인 경우, 각 타입의 텍스트를 "|"로 연결하여 반환한다.
  if (ts.isUnionTypeNode(member.type)) {
    return member.type.types.map((type) => type.getText(sourceFile));
  }

  // 위의 모든 조건이 충족되지 않는 경우, member의 타입 텍스트를 그대로 반환한다.
  return member.type.getText(sourceFile);
}

/**
 * 주어진 InterfaceDeclaration의 멤버들의 이름과 타입을 객체로 반환하는 함수
 *
 * @param propsInterface - 타입스크립트 InterfaceDeclaration (이 인터페이스의 멤버들을 확인한다)
 * @param sourceFile - 타입스크립트 소스 파일 (멤버의 이름과 타입을 가져오는 데 사용)
 * @returns 멤버의 이름을 키로, 멤버의 타입을 값으로 하는 객체를 반환
 */
function getPropsFromInterface(
  propsInterface: ts.InterfaceDeclaration,
  sourceFile: ts.SourceFile
) {
  // propsInterfaced의 멤버들을 순회하며, 각 멤버의 이름과 타입을 객체에 추가한다.
  return propsInterface.members.reduce((acc, member) => {
    // 멤버가 PropertySignature이고 이름이 있는 경우에만 처리한다.
    if (ts.isPropertySignature(member) && member.name) {
      // 멤버의 이름을 가져온다.
      const memberName = member.name.getText(sourceFile);
      // 멤버의 타입을 가져온다.
      const memberType = getMemberType(member, sourceFile);

      // 새로운 객체를 반환한다. 이 객체는 이전 객체에 멤버의 이름과 타입을 추가한 것이다.
      return { ...acc, [memberName]: memberType };
    }
    // 멤버가 PropertySignature이 아니거나 이름이 없는 경우, 이전 객체를 그대로 반환한다.
    return acc;
  }, {});
}

/**
 * 주어진 노드와 그 자식 노드들을 방문하여, 이름이 주어진 문자열과 일치하는 InterfaceDeclaration을 찾는 함수
 *
 * @param node - 타입스크립트 노드 (이 노드와 그 자식 노드들을 방문한다)
 * @param compareText - 찾을 인터페이스의 이름 (노드의 이름이 이 문자열과 일치하는지 확인)
 * @returns 이름이 compareText와 일치하는 InterfaceDeclaration을 반환. 찾지 못하면 null을 반환.
 */
function visitNodeAndFindPropsInterface(node: ts.Node, compareText: string) {
  // 찾은 InterfaceDeclaration을 저장할 변수
  let propsInterface = null;

  // 노드를 방문하는 함수
  const visit = (node: ts.Node) => {
    // 현재 노드가 찾고자 하는 InterfaceDeclaration인지 확인
    const foundInterface = getPropsInterface(node, compareText);
    // 찾은 경우, PropsInterface에 저장
    if (foundInterface) {
      propsInterface = foundInterface;
    }

    // 현재 노드의 모든 자식 노드를 방문
    ts.forEachChild(node, visit);
  };

  // 주어진 노드를 방문 시작
  visit(node);

  // 찾은 InterfaceDeclaration을 반환, 찾지 못한 경우 null 반환
  return propsInterface;
}

/**
 * 주어진 노드가 InterfaceDeclaration이고 그 이름이 "Props"인 경우, 그 인터페이스의 멤버들을 출력하는 함수
 *
 * @param node - 타입스크립트 노드 (이 노드가 InterfaceDeclaration인지 확인하고, 그 이름이 "Props"인지 확인한다)
 * @param sourceFile - 타입스크립트 소스 파일 (인터페이스의 멤버들을 가져오는 데 사용)
 */
function handleInterfaceDeclaration(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  definePropsName: string
) {
  let propsName = "";
  let props = {};
  let extendsInterface = "";

  // 노드가 InterfaceDeclaration이고 그 이름이 "Props"인 경우에만 처리한다.
  if (ts.isInterfaceDeclaration(node) && node.name.text === definePropsName) {
    // 인터페이스의 멤버들을 가져온다.
    propsName = node.name.text;
    props = getPropsFromInterface(node, sourceFile);

    // 인터페이스가 다른 인터페이스를 확장하는 경우, 확장하는 인터페이스의 이름을 가져온다.
    if (node.heritageClauses) {
      node.heritageClauses.forEach((heritageClause) => {
        if (heritageClause.token === ts.SyntaxKind.ExtendsKeyword) {
          heritageClause.types.forEach((type) => {
            extendsInterface = type.expression.getText(sourceFile);
          });
        }
      });
    }
  }

  return {
    name: propsName,
    props,
    extendsInterface,
  };
}

/**
 * 주어진 노드가 ImportDeclaration인 경우, 그것의 namedBindings를 확인하고, "Props"를 포함하는 ImportSpecifier를 찾아 처리하는 함수
 *
 * @param node - 타입스크립트 노드 (이 노드가 ImportDeclaration인지 확인하고, 그것의 namedBindings를 확인한다)
 * @param projectRoot - 프로젝트의 루트 경로 (모듈의 실제 경로를 찾는 데 사용)
 */
function handleImportDeclaration(
  node: ts.Node,
  projectRoot: string,
  propsName: string,
  uri: vscode.Uri
) {
  // 노드가 ImportDeclaration이 아니거나 namedBindings가 없는 경우, 함수를 종료한다.
  if (!ts.isImportDeclaration(node) || !node.importClause?.namedBindings) {
    return;
  }

  const namedBindings = node.importClause.namedBindings;

  // namedBindings가 NamedImports가 아닌 경우, 함수를 종료한다.
  if (!ts.isNamedImports(namedBindings)) {
    return;
  }

  let name = "";
  let importedProps = {};
  let importPath = "";

  // NamedImports의 모든 요소를 순회한다.
  namedBindings.elements.forEach((specifier) => {
    // ImportSpecifier가 "Props"를 포함하는 경우에만 처리한다.
    if (ts.isImportSpecifier(specifier) && specifier.name.text === propsName) {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;

        // moduleSpecifier가 StringLiteral인 경우, 그것의 텍스트를 가져온다.
        if (ts.isStringLiteral(moduleSpecifier)) {
          const childImportPath = moduleSpecifier.text;
          importPath = childImportPath;
        }
      }

      const moduleSpecifier = node.moduleSpecifier.getText();
      let modulePath = moduleSpecifier.slice(1, moduleSpecifier.length - 1); // Remove the quotes
      const firstPath = modulePath.split("/")[0];
      const aliasPath = alias[firstPath];

      let filePath = "";

      if (aliasPath) {
        modulePath = modulePath.replace(firstPath, aliasPath);
        filePath = `${projectRoot}/${modulePath}`;
      } else {
        modulePath = getAbsolutePath(uri.fsPath, modulePath);
        filePath = modulePath;
      }

      // modulePath 에 확장자가 없을 경우 index.d.ts 파일을 가져온다
      if (!filePath.includes(".")) {
        filePath = `${filePath}/index.d.ts`;
      }

      // index.d.ts 파일이 없을 경우 index.ts 파일을 가져온다
      if (!fs.existsSync(filePath)) {
        filePath = filePath.replace(".d.ts", ".ts");
      }

      const fileContent = fs.readFileSync(filePath, "utf8");
      const importedFile = ts.createSourceFile(
        filePath,
        fileContent,
        ts.ScriptTarget.Latest,
        true
      );

      // importedFile에서 "Props" 인터페이스를 찾는다.
      const propsInterface = visitNodeAndFindPropsInterface(
        importedFile,
        specifier.name.text
      );

      // "Props" 인터페이스를 찾은 경우, 그것의 멤버들을 출력한다.
      if (propsInterface) {
        const props = getPropsFromInterface(propsInterface, importedFile);
        name = (propsInterface as ts.InterfaceDeclaration).name.text;
        importedProps = props;
      }
    }
  });

  return {
    importedName: name,
    importedProps,
    importedPath: importPath,
  };
}

/**
 * 주어진 스크립트 내용을 파싱하고, 그것의 모든 자식 노드를 순회하여 InterfaceDeclaration과 ImportDeclaration을 처리하는 함수
 *
 * @param scriptContent - 파싱할 스크립트의 내용
 * @param projectRoot - 프로젝트의 루트 경로 (ImportDeclaration을 처리하는 데 사용)
 */
function parseScriptContent(
  scriptContent: string,
  projectRoot: string,
  definePropsName: string,
  defaultOptions: Record<string, string>,
  defineEmits: string[],
  uri: vscode.Uri
) {
  // 주어진 스크립트 내용을 SourceFile로 만든다.
  const sourceFile = ts.createSourceFile(
    "temp.ts",
    scriptContent,
    ts.ScriptTarget.ES5,
    true,
    ts.ScriptKind.TS
  );

  let name = "";
  let props = {};
  let extendsInterface = "";

  // SourceFile의 모든 자식 노드를 순회한다.
  ts.forEachChild(sourceFile, function (node) {
    // 노드가 InterfaceDeclaration인 경우, 그것을 처리한다.
    if (ts.isInterfaceDeclaration(node)) {
      const {
        name: childName,
        props: childProps,
        extendsInterface: childExtendsInterface,
      } = handleInterfaceDeclaration(node, sourceFile, definePropsName);

      name = childName;
      props = childProps;
      extendsInterface = childExtendsInterface;
    }
  });

  let importedName = "";
  let importedProps = {};
  let importedPath = "";

  // SourceFile의 모든 자식 노드를 순회한다.
  ts.forEachChild(sourceFile, function (node) {
    // 노드가 ImportDeclaration인 경우, 그것을 처리한다.
    if (ts.isImportDeclaration(node)) {
      const importedData = handleImportDeclaration(
        node,
        projectRoot,
        extendsInterface || definePropsName,
        uri
      );

      if (!importedData) {
        return;
      }

      importedName = importedData.importedName;
      importedProps = importedData.importedProps;
      importedPath = importedData.importedPath;
    }
  });

  const finalProps = { ...importedProps, ...props };

  outputChannel.appendLine(
    `default options: ${JSON.stringify(defaultOptions)}`
  );

  return {
    finalProps,
    propsName: name,
    props,
    importedName,
    importedProps,
    importedPath,
    defaultOptions,
    defineEmits,
  };
}
/**
 * 주어진 내용을 파싱하고, 그것의 scriptSetup 또는 script의 내용을 처리하는 함수
 *
 * @param content - 파싱할 내용
 * @param projectRoot - 프로젝트의 루트 경로 (스크립트의 내용을 처리하는 데 사용)
 */
export function parseContent(
  content: string,
  projectRoot: string,
  uri: vscode.Uri
) {
  try {
    // 주어진 내용을 파싱한다.
    const parsed = parse(content);
    // 파싱된 결과에서 scriptSetup 또는 script의 내용을 가져온다.
    const scriptContent =
      parsed.descriptor.scriptSetup?.content ||
      parsed.descriptor.script?.content;

    // scriptSetup 또는 script의 내용이 없는 경우, 에러 메시지를 보여주고 함수를 종료한다.
    if (!scriptContent) {
      vscode.window.showErrorMessage("No script found.");
      return;
    }

    const genericArgument = extractGenericArgument(scriptContent);
    if (!genericArgument) {
      return;
    }

    return parseScriptContent(
      scriptContent,
      projectRoot,
      genericArgument?.genericArgument as string,
      genericArgument?.defaultOptions as Record<string, string>,
      genericArgument?.emitEvents as string[],
      uri
    );
  } catch (e) {
    if (e instanceof Error) {
      // 에러가 발생한 경우, 에러 메시지를 출력한다.
      outputChannel.appendLine(`Error: ${e.message}`);
    }
  }
}

function extractGenericArgument(code: string): Record<string, string | object> {
  const sourceFile = ts.createSourceFile(
    "temp.ts",
    code,
    ts.ScriptTarget.Latest,
    true
  );

  let genericArgument: string | null = null;
  let defaultOptions: Record<string, string> | null = null;
  let emitEvents: string[] = [];

  const extractFromCallExpression = (node: ts.CallExpression) => {
    const { expression, typeArguments, arguments: args } = node;

    // Check if the call expression is 'defineProps'
    if (ts.isIdentifier(expression) && expression.text === "defineProps") {
      if (typeArguments && typeArguments.length > 0) {
        const typeArgument = typeArguments[0];
        if (
          ts.isTypeReferenceNode(typeArgument) &&
          ts.isIdentifier(typeArgument.typeName)
        ) {
          genericArgument = typeArgument.typeName.text;
        }
      }
    }

    // Check if the call expression is 'defineEmits'
    if (ts.isIdentifier(expression) && expression.text === "defineEmits") {
      outputChannel.appendLine("defineEmits");
      if (typeArguments && typeArguments.length > 0) {
        const typeArgument = typeArguments[0];
        if (ts.isTypeLiteralNode(typeArgument)) {
          typeArgument.members.forEach((member) => {
            if (ts.isCallSignatureDeclaration(member)) {
              member.parameters.forEach((parameter) => {
                if (
                  ts.isParameter(parameter) &&
                  parameter.type &&
                  ts.isLiteralTypeNode(parameter.type) &&
                  ts.isLiteralExpression(parameter.type.literal)
                ) {
                  if (
                    parameter.type.literal.kind === ts.SyntaxKind.NullKeyword
                  ) {
                    emitEvents.push("null");
                  } else {
                    emitEvents.push(parameter.type.literal.text);
                  }
                }
              });
            }
          });
        }
      }
    }

    if (ts.isIdentifier(expression) && expression.text === "withDefaults") {
      // Extract default options from the arguments
      if (args.length > 1 && ts.isObjectLiteralExpression(args[1])) {
        defaultOptions = args[1].properties.reduce(
          (acc: Record<string, string>, prop) => {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              acc[prop.name.text] = prop.initializer.getText();
            }
            return acc;
          },
          {}
        );
      }
    }

    // Check arguments of the call expression
    args.forEach((arg) => {
      if (ts.isCallExpression(arg)) {
        extractFromCallExpression(arg);
      }
    });
  };

  const visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
    if (ts.isVariableDeclaration(node)) {
      const { initializer } = node;
      if (initializer && ts.isCallExpression(initializer)) {
        extractFromCallExpression(initializer);
      }
    }

    ts.forEachChild(node, visitor);

    return node;
  };

  sourceFile.statements.forEach(visitor);

  outputChannel.appendLine(`emitEvents: ${emitEvents}`);

  return {
    genericArgument: genericArgument || "",
    defaultOptions: defaultOptions || {},
    emitEvents,
  };
}

function getAbsolutePath(selectedFilePath: string, originPath: string) {
  const directoryPath = path.dirname(selectedFilePath);
  const absolutePath = path.resolve(directoryPath, originPath);
  return absolutePath;
}
