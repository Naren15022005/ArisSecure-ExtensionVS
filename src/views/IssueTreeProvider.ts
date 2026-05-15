import * as vscode from 'vscode';
import type { ExplanationData } from '../services/ExplanationService';

export type IssueDomain = 'Security' | 'Quality' | 'DevOps' | 'Scalability';

export interface IssueData {
  type: 'vulnerability' | 'secret' | 'quality' | 'devops' | 'scalability';
  domain: IssueDomain;
  title: string;
  message: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  explanation?: ExplanationData;
}

// ── Severity config ───────────────────────────────────────────────────────────

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low'] as const;
type SeverityLevel = typeof SEVERITY_ORDER[number];

const SEVERITY_ICON: Record<SeverityLevel, vscode.ThemeIcon> = {
  critical: new vscode.ThemeIcon('error'),
  high:     new vscode.ThemeIcon('warning'),
  medium:   new vscode.ThemeIcon('info'),
  low:      new vscode.ThemeIcon('circle-outline'),
};

const SEVERITY_LABEL: Record<SeverityLevel, string> = {
  critical: 'Critical',
  high:     'High',
  medium:   'Medium',
  low:      'Low',
};

const DOMAIN_ICON: Record<IssueDomain, string> = {
  Security:    'shield',
  Quality:     'beaker',
  DevOps:      'server',
  Scalability: 'graph',
};

// ── Node types ────────────────────────────────────────────────────────────────

type ArisNode = SeverityGroupItem | IssueItem | SectionItem | DetailItem;

export class DetailItem extends vscode.TreeItem {
  constructor(
    label: string,
    opts?: {
      description?: string;
      tooltip?: string;
      icon?: string;
      command?: vscode.Command;
    }
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    if (opts?.description) this.description = opts.description;
    if (opts?.tooltip)     this.tooltip     = opts.tooltip;
    if (opts?.icon)        this.iconPath    = new vscode.ThemeIcon(opts.icon);
    if (opts?.command)     this.command     = opts.command;
  }
}

export class SectionItem extends vscode.TreeItem {
  readonly children: DetailItem[];

  constructor(label: string, icon: string, children: DetailItem[], expanded = false) {
    super(
      label,
      expanded
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
    );
    this.iconPath = new vscode.ThemeIcon(icon);
    this.children = children;
  }
}

export class SeverityGroupItem extends vscode.TreeItem {
  readonly children: IssueItem[];
  readonly severity: SeverityLevel;

  constructor(severity: SeverityLevel, issues: IssueData[]) {
    super(`${SEVERITY_LABEL[severity]}  (${issues.length})`, vscode.TreeItemCollapsibleState.Expanded);
    this.severity = severity;
    this.iconPath = SEVERITY_ICON[severity];
    this.tooltip  = `${issues.length} ${SEVERITY_LABEL[severity]}-severity issue(s)`;
    this.contextValue = `severity-${severity}`;
    this.children = issues.map(i => new IssueItem(i));
  }
}

export class IssueItem extends vscode.TreeItem {
  readonly issue: IssueData;

  constructor(issue: IssueData) {
    super(
      `[L${issue.line}]  ${issue.title}`,
      issue.explanation
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None
    );
    this.issue = issue;

    const domain3 = issue.domain.substring(0, 3).toUpperCase();
    const msg = issue.message.length > 52
      ? issue.message.substring(0, 52) + '…'
      : issue.message;
    this.description = `[${domain3}]  ${msg}`;

    this.tooltip = new vscode.MarkdownString(
      `**\`${issue.title}\`**\n\n` +
      `${issue.message}\n\n` +
      `| | |\n|---|---|\n` +
      `| Domain | ${issue.domain} |\n` +
      `| Severity | ${issue.severity.toUpperCase()} |\n` +
      `| Line | ${issue.line} |\n\n` +
      (issue.explanation ? `*Expand for full explanation · Click to view remediation*` : `*Click to view remediation*`)
    );

    this.iconPath    = new vscode.ThemeIcon(DOMAIN_ICON[issue.domain]);
    this.contextValue = 'issue';
    this.command = {
      title: 'Show Issue Detail',
      command: 'arisCode.showIssueDetail',
      arguments: [issue],
    };
  }

  getEducationItems(): ArisNode[] {
    const exp = this.issue.explanation;
    if (!exp) return [];

    const nodes: ArisNode[] = [];

    nodes.push(new DetailItem('What is it', {
      description: exp.what,
      tooltip: exp.what,
      icon: 'question',
    }));

    nodes.push(new DetailItem('Why it matters', {
      description: exp.why,
      tooltip: exp.why,
      icon: 'warning',
    }));

    nodes.push(new SectionItem(
      'Risks',
      'error',
      exp.risks.map(r => new DetailItem(r, { icon: 'circle-filled' })),
    ));

    nodes.push(new DetailItem('Standard', {
      description: exp.standard.name,
      tooltip: exp.standard.cweName,
      icon: 'book',
      command: {
        title: 'Open OWASP Reference',
        command: 'vscode.open',
        arguments: [vscode.Uri.parse(exp.standard.owaspUrl)],
      },
    }));

    const exampleItems: DetailItem[] = [
      new DetailItem('Vulnerable', {
        description: exp.example.vulnerable.split('\n').find(l => l.trim() && !l.startsWith('/')) ?? '',
        tooltip: exp.example.vulnerable,
        icon: 'error',
      }),
      new DetailItem('Secure', {
        description: exp.example.secure.split('\n').find(l => l.trim() && !l.startsWith('/')) ?? '',
        tooltip: exp.example.secure,
        icon: 'pass',
      }),
    ];
    if (exp.example.docsUrl) {
      exampleItems.push(new DetailItem('Read official docs', {
        icon: 'link-external',
        command: {
          title: 'Open Docs',
          command: 'vscode.open',
          arguments: [vscode.Uri.parse(exp.example.docsUrl)],
        },
      }));
    }
    nodes.push(new SectionItem('Example', 'code', exampleItems));

    nodes.push(new SectionItem(
      'Remediation steps',
      'checklist',
      exp.remediation.map(step => new DetailItem(
        `${step.order}. ${step.title}`,
        {
          description: step.description,
          tooltip: step.example ? `Example: ${step.example}` : step.description,
          icon: 'check',
        }
      )),
      true,
    ));

    nodes.push(new SectionItem(
      'References',
      'link-external',
      exp.references.map(ref => new DetailItem(ref.name, {
        icon: 'link-external',
        command: {
          title: 'Open Reference',
          command: 'vscode.open',
          arguments: [vscode.Uri.parse(ref.url)],
        },
      })),
    ));

    return nodes;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export class IssueTreeProvider implements vscode.TreeDataProvider<ArisNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<ArisNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private severityGroups: SeverityGroupItem[] = [];
  private rawIssues: IssueData[] = [];
  private treeView?: vscode.TreeView<ArisNode>;

  setTreeView(tv: vscode.TreeView<ArisNode>): void {
    this.treeView = tv;
    this.updateMessage('pending');
  }

  setIssues(issues: IssueData[]): void {
    this.rawIssues = issues;

    const bySeverity = new Map<SeverityLevel, IssueData[]>();
    for (const s of SEVERITY_ORDER) bySeverity.set(s, []);
    for (const issue of issues) bySeverity.get(issue.severity)!.push(issue);

    this.severityGroups = SEVERITY_ORDER
      .filter(s => bySeverity.get(s)!.length > 0)
      .map(s => new SeverityGroupItem(s, bySeverity.get(s)!));

    vscode.commands.executeCommand('setContext', 'arisCode:hasIssues', issues.length > 0);
    this.updateMessage(issues.length === 0 ? 'clean' : 'issues');
    this._onDidChangeTreeData.fire(undefined);
  }

  clearIssues(): void {
    this.rawIssues = [];
    this.severityGroups = [];
    vscode.commands.executeCommand('setContext', 'arisCode:hasIssues', false);
    this.updateMessage('pending');
    this._onDidChangeTreeData.fire(undefined);
  }

  getAllIssues(): IssueData[] {
    return this.rawIssues;
  }

  getTreeItem(element: ArisNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ArisNode): ArisNode[] {
    if (!element)                             return this.severityGroups;
    if (element instanceof SeverityGroupItem) return element.children;
    if (element instanceof IssueItem)         return element.getEducationItems();
    if (element instanceof SectionItem)       return element.children;
    return [];
  }

  private updateMessage(state: 'pending' | 'clean' | 'issues'): void {
    if (!this.treeView) return;
    if (state === 'pending') {
      this.treeView.message = 'Run a scan to detect issues — Ctrl+Shift+Alt+Q';
    } else if (state === 'clean') {
      this.treeView.message = 'No issues detected. Code looks clean!';
    } else {
      this.treeView.message = undefined;
    }
  }
}
