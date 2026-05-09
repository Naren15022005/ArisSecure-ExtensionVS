// Minimal VSCode API mock for Jest unit tests

const workspace = {
  getConfiguration: jest.fn().mockReturnValue({
    get: jest.fn().mockReturnValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  }),
  workspaceFolders: [{ uri: { fsPath: '/tmp/test-workspace' } }],
};

const window = {
  showInformationMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showInputBox: jest.fn(),
  activeTextEditor: undefined,
  createOutputChannel: jest.fn().mockReturnValue({
    appendLine: jest.fn(),
    dispose: jest.fn(),
  }),
  withProgress: jest.fn((_opts: unknown, task: () => Promise<void>) => task()),
};

const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
};

const languages = {
  createDiagnosticCollection: jest.fn().mockReturnValue({
    set: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn(),
  }),
};

const Uri = {
  joinPath: jest.fn(),
  file: jest.fn(),
};

const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
const ProgressLocation = { Notification: 15 };
const DiagnosticSeverity = { Error: 0, Warning: 1, Information: 2, Hint: 3 };

class Range {
  constructor(
    public startLine: number,
    public startChar: number,
    public endLine: number,
    public endChar: number
  ) {}
}

class Diagnostic {
  source?: string;
  constructor(
    public range: Range,
    public message: string,
    public severity: number
  ) {}
}

const ExtensionContext = {};

module.exports = {
  workspace,
  window,
  commands,
  languages,
  Uri,
  ConfigurationTarget,
  ProgressLocation,
  DiagnosticSeverity,
  Range,
  Diagnostic,
  ExtensionContext,
};
